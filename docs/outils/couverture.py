# Contrôle de couverture : tout ce que dit le document HTML doit se retrouver
# dans le .docx produit.
#
# Raison d'être : la conversion procède par réécritures successives, et une
# réécriture qui ne correspond à rien ne lève aucune erreur — elle laisse
# simplement le bloc en place, où l'étape suivante peut l'ignorer. C'est
# exactement ce qui a fait disparaître le tableau des paliers : le document
# s'ouvrait très bien, il lui manquait juste une page.
#
# Usage : python3 couverture.py <source.html> <sortie.docx>

import html
import re
import sys

from docx import Document


def texte_html(p):
    t = open(p, encoding="utf-8").read()
    # Le <title> est une métadonnée, pas du corps de texte : il est reporté
    # dans les propriétés du document, pas dans une page.
    t = re.sub(r"<title>[\s\S]*?</title>", " ", t)
    t = re.sub(r"<(script|style)[\s\S]*?</\1>", " ", t)
    t = re.sub(r"<!--[\s\S]*?-->", " ", t)
    # Les balises en ligne ne créent pas de frontière de mot : « 1<sup>er</sup> »
    # est un seul mot. Les remplacer par une espace inventerait une coupure que
    # le document n'a pas, et le contrôle crierait sur une différence fictive.
    enligne = r"sup|sub|b|i|em|strong|code|kbd|span|cite|a|small|abbr"
    t = re.sub(rf"</?(?:{enligne})(?:\s[^>]*)?>", "", t)
    t = html.unescape(re.sub(r"<[^>]+>", " ", t))
    return re.sub(r"\s+", " ", t)


def texte_docx(p):
    d = Document(p)
    morceaux = [x.text for x in d.paragraphs]
    for t in d.tables:
        morceaux += [c.text for r in t.rows for c in r.cells]
    return re.sub(r"\s+", " ", " ".join(morceaux))


def normalise(s):
    # On compare des mots, pas de la ponctuation : la conversion insère des
    # tirets de liaison (« V1-01 — Titre ») et des crochets autour des
    # pastilles. Les garder ferait crier le contrôle sur des différences qui
    # ne retirent rien au lecteur.
    s = s.replace("’", "'")
    s = re.sub(r"[^0-9a-zà-öø-ÿ' ]+", " ", s.lower())
    return re.sub(r"\s+", " ", s)


src, dest = sys.argv[1], sys.argv[2]
source = normalise(texte_html(src))
produit = normalise(texte_docx(dest))

# On découpe en fragments assez longs pour être significatifs, assez courts
# pour situer précisément ce qui manque.
# On compare des occurrences de mots, pas des suites de mots : la conversion
# a le droit de réordonner (la référence passe devant le titre) et d'insérer
# (numéros d'étape, crochets). Elle n'a pas le droit de perdre. Une phrase
# tronquée, un tableau évaporé, un pied de page oublié se voient tous ici.
from collections import Counter

avant = Counter(source.split())
apres = Counter(produit.split())

perdus = {m: (n, apres[m]) for m, n in avant.items() if apres[m] < n}

total = sum(avant.values())
manquant = sum(n - a for n, a in perdus.values())

print(f"{dest}")
print(f"  {total - manquant}/{total} occurrences de mots retrouvées")
for m, (n, a) in sorted(perdus.items(), key=lambda kv: kv[1][0] - kv[1][1], reverse=True)[:12]:
    print(f"  MANQUE  « {m} » : {n} dans la source, {a} dans le document")
sys.exit(1 if perdus else 0)
