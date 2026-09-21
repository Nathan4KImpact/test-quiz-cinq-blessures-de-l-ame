# Transforme un document HTML de mise en page riche en HTML sobre, lisible
# par LibreOffice pour produire un .docx éditable.
#
# La conversion directe perdrait silencieusement trois choses :
#   - les réponses repliées dans <details> (elles n'existent pas pour Word) ;
#   - les numéros d'étapes, produits par un compteur CSS ;
#   - la grille des paliers de score, qui deviendrait une pile de lignes.
# Chacune est donc reconstruite en balisage que Word comprend.

import re
import sys

STYLE = """
<style>
  body { font-family: "Calibri", sans-serif; font-size: 11pt; color: #1b2721; }
  h1 { font-family: "Georgia", serif; font-size: 26pt; color: #1b2721; }
  h2 { font-family: "Georgia", serif; font-size: 17pt; color: #2c7a52;
       border-bottom: 1px solid #cfe0d5; padding-bottom: 4pt; }
  h3 { font-size: 12pt; color: #1b2721; }
  p, li { line-height: 1.4; }
  .meta { color: #7a8b81; font-size: 9pt; }
  .chips { color: #2c7a52; font-size: 9pt; }
  blockquote { font-family: "Georgia", serif; font-style: italic; color: #4f6157; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #cfe0d5; padding: 5pt 7pt; text-align: left;
           vertical-align: top; font-size: 10pt; }
  th { background: #dcefe3; }
</style>
"""


def depuis_fichier(src, dest):
    h = open(src, encoding="utf-8").read()

    # 1. Feuilles, scripts et styles d'origine : remplacés par un style sobre.
    #    TOUS les blocs <style> partent — il y en a deux depuis l'incorporation
    #    des polices, et n'en retirer qu'un laisserait la mise en page riche
    #    que LibreOffice interprète mal.
    h = re.sub(r'<link[^>]*>', '', h)
    h = re.sub(r'<script[\s\S]*?</script>', '', h)
    h = re.sub(r'<style[\s\S]*?</style>', '', h)
    h = re.sub(r'(</title>)', r'\1' + STYLE, h, count=1)

    # 2. « Situations courantes » : un <details> replié n'existe pas dans Word.
    h = re.sub(r'<summary>([\s\S]*?)</summary>', r'<h3>\1</h3>', h)
    h = re.sub(r'</?details[^>]*>', '', h)

    # 3. Étapes numérotées : le compteur CSS ne survit pas, on inscrit le
    #    numéro dans le titre. La numérotation repart à 1 par liste.
    def numerote(bloc):
        n = [0]

        def une(m):
            n[0] += 1
            return f'{m.group(1)}{n[0]}. '

        return re.sub(r'(<h3[^>]*>)', une, bloc.group(0))

    h = re.sub(r'<ol class="steps">[\s\S]*?</ol>', numerote, h)

    # 4. Paliers de score : une grille de cartes devient un tableau.
    def paliers(bloc):
        lignes = re.findall(
            r'<span class="range">([\s\S]*?)</span>\s*'
            r'<span class="name">([\s\S]*?)</span>\s*'
            r'<span class="note">([\s\S]*?)</span>',
            bloc.group(0),
        )
        corps = "".join(
            f"<tr><td>{a}</td><td>{b}</td><td>{c}</td></tr>" for a, b, c in lignes
        )
        return (
            '<table><thead><tr><th>Score</th><th>Palier</th>'
            "<th>Lecture</th></tr></thead><tbody>" + corps + "</tbody></table>"
        )

    # Le bloc se termine par la fermeture de la dernière carte suivie de celle
    # de la grille : deux </div> consécutifs, seul endroit du bloc où ce motif
    # apparaisse. Ne pas s'appuyer sur l'indentation, qui a déjà menti une fois.
    h = re.sub(r'<div class="tiers">[\s\S]*?</div>\s*</div>', paliers, h)

    # 5. Chronique : la référence vit dans une colonne séparée par la grille.
    #    On la ramène en tête du titre pour qu'elle reste citable.
    h = re.sub(
        r'<div class="ref">([\s\S]*?)</div>\s*<div class="item-body">\s*<h3>([\s\S]*?)</h3>',
        r'<div class="item-body"><h3>\1 &mdash; \2</h3>',
        h,
    )

    # 6. Pastilles d'état : rendues en texte, sinon elles disparaissent.
    h = re.sub(r'<span class="chip [^"]*">([\s\S]*?)</span>', r'[\1] ', h)
    #    ... et leur conteneur devient un paragraphe : un <div> n'est pas une
    #    balise de bloc pour le convertisseur, son texte serait perdu.
    h = re.sub(r'<div class="chips">([\s\S]*?)</div>', r'<p>\1</p>', h)

    # 7. Traçabilité : deux <span> dans une grille. Sans balise de bloc, ce
    #    texte n'existe pour personne d'autre qu'un navigateur — il devient
    #    un tableau de deux colonnes.
    def trace(bloc):
        paires = re.findall(
            r'<span[^>]*>([\s\S]*?)</span>\s*<span[^>]*>([\s\S]*?)</span>',
            bloc.group(0),
        )
        corps = "".join(f"<tr><td>{a.strip()}</td><td>{b.strip()}</td></tr>"
                        for a, b in paires)
        return ('<table><thead><tr><th>Livraison</th><th>Contenu</th></tr>'
                "</thead><tbody>" + corps + "</tbody></table>")

    h = re.sub(r'<div class="trace">[\s\S]*?</div>\s*</div>', trace, h)

    # 8. Cartouche d'identité : une liste de définitions devient un tableau.
    #    Les balises sont acceptées avec attributs : cinq <dd> portent une
    #    classe, et un motif exigeant la balise nue les avait laissées de côté.
    def identite(bloc):
        paires = re.findall(r'<dt[^>]*>([\s\S]*?)</dt>\s*<dd[^>]*>([\s\S]*?)</dd>', bloc.group(0))
        corps = "".join(f"<tr><td>{a.strip()}</td><td>{b.strip()}</td></tr>"
                        for a, b in paires)
        return "<table><tbody>" + corps + "</tbody></table>"

    h = re.sub(r'<dl class="identity">[\s\S]*?</dl>', identite, h)

    # 9. Le pied de page n'est pas dans une balise de bloc : sans cela, la
    #    date de mise à jour et la portée du document disparaissent.
    h = re.sub(r'<footer[^>]*>([\s\S]*?)</footer>', r'<hr><p>\1</p>', h)

    open(dest, "w", encoding="utf-8").write(h)
    print(f"{dest} écrit ({len(h)} caractères)")


if __name__ == "__main__":
    depuis_fichier(sys.argv[1], sys.argv[2])
