# Construit un .docx éditable à partir du HTML sobre produit par pour-word.py.
#
# Pourquoi ne pas convertir le HTML riche directement : l'image ne contient
# que le noyau de LibreOffice, sans son module Writer — aucun filtre de
# conversion n'est disponible. On écrit donc l'OOXML nous-mêmes, ce qui a
# l'avantage de produire un document aux styles Word natifs (Titre 1, 2, 3),
# donc navigable par le volet de navigation et modifiable par l'association.
#
# Usage : python3 en-docx.py <source.html> <sortie.docx> "<Titre>"

import re
import sys
from html.parser import HTMLParser

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Pt, RGBColor

VERT = RGBColor(0x2C, 0x7A, 0x52)
GRIS = RGBColor(0x55, 0x65, 0x5C)

BLOCS = {"h1", "h2", "h3", "p", "li", "blockquote", "td", "th"}


class Lecteur(HTMLParser):
    """Aplatit le HTML en une suite de blocs, en gardant gras / italique /
    largeur fixe pour les fragments qui les portent."""

    def __init__(self):
        super().__init__()
        self.blocs = []          # (type, runs) ou ("table", lignes)
        self.pile = []           # balises de bloc ouvertes
        self.runs = []           # (texte, gras, italique, mono)
        self.gras = self.ital = self.mono = 0
        self.table = None        # lignes en cours
        self.ligne = None

    # -- utilitaires -------------------------------------------------
    def vide(self, type_):
        texte = "".join(r[0] for r in self.runs).strip()
        if texte:
            self.blocs.append((type_, self.compacte()))
        self.runs = []

    def compacte(self):
        out = []
        for t, g, i, m in self.runs:
            if out and out[-1][1:] == (g, i, m):
                out[-1] = (out[-1][0] + t, g, i, m)
            else:
                out.append((t, g, i, m))
        # rogne les blancs de bord
        while out and not out[0][0].strip():
            out.pop(0)
        while out and not out[-1][0].strip():
            out.pop()
        if out:
            out[0] = (out[0][0].lstrip(), *out[0][1:])
            out[-1] = (out[-1][0].rstrip(), *out[-1][1:])
        return out

    # -- balises -----------------------------------------------------
    def handle_starttag(self, tag, attrs):
        if tag in ("strong", "b"):
            self.gras += 1
        elif tag in ("em", "i", "cite"):
            self.ital += 1
        elif tag in ("code", "kbd"):
            self.mono += 1
        elif tag == "table":
            self.table = []
        elif tag == "tr" and self.table is not None:
            self.ligne = []
        elif tag in BLOCS:
            self.pile.append(tag)
            self.runs = []
        elif tag == "br":
            self.runs.append((" ", 0, 0, 0))

    def handle_endtag(self, tag):
        if tag in ("strong", "b"):
            self.gras = max(0, self.gras - 1)
        elif tag in ("em", "i", "cite"):
            self.ital = max(0, self.ital - 1)
        elif tag in ("code", "kbd"):
            self.mono = max(0, self.mono - 1)
        elif tag in ("td", "th") and self.ligne is not None:
            self.ligne.append("".join(r[0] for r in self.runs).strip())
            self.runs = []
            if self.pile and self.pile[-1] == tag:
                self.pile.pop()
        elif tag == "tr" and self.table is not None:
            if self.ligne:
                self.table.append(self.ligne)
            self.ligne = None
        elif tag == "table":
            if self.table:
                self.blocs.append(("table", self.table))
            self.table = None
        elif tag in BLOCS:
            if self.pile and self.pile[-1] == tag:
                self.pile.pop()
            if self.ligne is None:
                self.vide(tag)

    def handle_data(self, data):
        if not self.pile and self.ligne is None:
            return
        texte = re.sub(r"\s+", " ", data)
        if texte:
            self.runs.append((texte, self.gras, self.ital, self.mono))


def ecris(src, dest, titre):
    brut = open(src, encoding="utf-8").read()
    brut = re.sub(r"<(script|style)[\s\S]*?</\1>", "", brut)
    brut = re.sub(r"<!--[\s\S]*?-->", "", brut)

    lecteur = Lecteur()
    lecteur.feed(brut)

    doc = Document()
    normal = doc.styles["Normal"]
    normal.font.name = "Calibri"
    normal.font.size = Pt(10.5)

    doc.core_properties.title = titre
    doc.core_properties.author = "Vie Florissante"

    for type_, contenu in lecteur.blocs:
        if type_ == "table":
            entete, *lignes = contenu
            t = doc.add_table(rows=1, cols=len(entete))
            t.style = "Table Grid"
            for c, texte in zip(t.rows[0].cells, entete):
                c.text = ""
                r = c.paragraphs[0].add_run(texte)
                r.bold = True
                r.font.size = Pt(9.5)
            for ligne in lignes:
                cells = t.add_row().cells
                for c, texte in zip(cells, ligne):
                    c.text = ""
                    c.paragraphs[0].add_run(texte).font.size = Pt(9.5)
            doc.add_paragraph()
            continue

        if type_ == "h1":
            p = doc.add_heading(level=0)
        elif type_ in ("h2", "h3"):
            p = doc.add_heading(level=2 if type_ == "h2" else 3)
        elif type_ == "li":
            p = doc.add_paragraph(style="List Bullet")
        elif type_ == "blockquote":
            p = doc.add_paragraph()
            p.paragraph_format.left_indent = Pt(18)
        else:
            p = doc.add_paragraph()

        for texte, gras, ital, mono in contenu:
            r = p.add_run(texte)
            r.bold = bool(gras)
            r.italic = bool(ital) or type_ == "blockquote"
            if mono:
                r.font.name = "Consolas"
                r.font.size = Pt(9.5)
            if type_ == "h2":
                r.font.color.rgb = VERT
            elif type_ == "blockquote":
                r.font.color.rgb = GRIS

    doc.save(dest)
    print(f"{dest} écrit — {len(lecteur.blocs)} blocs")


if __name__ == "__main__":
    ecris(sys.argv[1], sys.argv[2], sys.argv[3])
