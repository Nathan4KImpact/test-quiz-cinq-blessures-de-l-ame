#!/bin/bash
# Régénère les .pdf et .docx à partir des .html de docs/.
#
# La source de vérité est le HTML : c'est lui qu'on modifie, lui qui est
# lisible dans un diff, et lui qui alimente les deux formats remis à
# l'association. Les binaires en sont dérivés, jamais l'inverse.
#
# Usage :  bash docs/outils/generer.sh

cd "$(dirname "$0")/../.." || exit 1
O=docs/outils
T=$(mktemp -d)
fail=0

for nom in guide-accompagnant chronique-des-versions; do
  src="docs/$nom.html"
  [ -f "$src" ] || { echo "ABSENT  $src"; fail=1; continue; }

  titre=$(sed -n 's:.*<title>\(.*\)</title>.*:\1:p' "$src" | head -1)

  node "$O/en-pdf.js" "$src" "docs/$nom.pdf" || fail=1
  python3 "$O/pour-word.py" "$src" "$T/$nom.html" > /dev/null || fail=1
  python3 "$O/en-docx.py" "$T/$nom.html" "docs/$nom.docx" "$titre" || fail=1

  # Contrôle : la conversion procède par réécritures, et une réécriture qui
  # ne correspond à rien ne lève aucune erreur — elle perd simplement un
  # bloc. Le document s'ouvre très bien, il lui manque une page.
  python3 "$O/couverture.py" "$src" "docs/$nom.docx" || fail=1
done

rm -rf "$T"
[ $fail -eq 0 ] && echo "DOCUMENTS À JOUR" || echo "AU MOINS UNE ÉTAPE EN ÉCHEC"
exit $fail
