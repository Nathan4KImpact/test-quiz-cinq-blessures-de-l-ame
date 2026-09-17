#!/bin/bash
# Lance toute la suite de tests.
#
# Chaque parcours navigateur tourne sur un mock FRAÎCHEMENT redémarré : la
# fausse base vit en mémoire et les suites la modifient (mots de passe,
# passations). Sans cette remise à zéro, une suite échoue selon ce qui a
# tourné avant elle — un échec qui ne dit rien sur le code testé.
#
# Usage :  bash tests/run.sh

cd "$(dirname "$0")/.." || exit 1
PORT=8700
fail=0

echo "--- vérification de syntaxe ---"
for f in js/*.js api/*.js api/*/*.js tests/*.js; do
  if ! node --check "$f" 2>/dev/null; then
    echo "ÉCHEC  syntaxe : $f"; node --check "$f"; fail=1
  fi
done
[ $fail -eq 0 ] && echo "OK     tous les fichiers .js sont syntaxiquement valides"

run_unit() {
  printf "%-22s " "$1"
  out=$(node "tests/$1.js" 2>&1)
  if echo "$out" | grep -qE "^FAIL|ASSERTION\(S\) EN ÉCHEC"; then
    echo "ÉCHEC"; echo "$out" | grep -E "^FAIL|Error" | head -8; fail=1
  else
    echo "OK ($(echo "$out" | grep -c '^OK') assertions)"
  fi
}

run_browser() {
  fuser -k "$PORT/tcp" 2>/dev/null; sleep 0.5
  (node tests/mock-server.js "$PORT" > /dev/null 2>&1 &); sleep 1.2
  printf "%-22s " "$1"
  out=$(node "tests/$1.js" "$PORT" 2>&1)
  # Une suite passe si aucune ligne ne commence par FAIL et qu'aucune
  # exception n'a interrompu le script.
  if echo "$out" | grep -qE "^FAIL|ASSERTION\(S\) EN ÉCHEC"; then
    echo "ÉCHEC"; echo "$out" | grep -E "^FAIL|Error|TimeoutError" | head -8; fail=1
  else
    echo "OK ($(echo "$out" | grep -c '^OK') assertions)"
  fi
}

echo
echo "--- unitaires (sans navigateur) ---"
run_unit test-routes
run_unit test-relances

echo
echo "--- parcours navigateur (mock neuf à chaque fois) ---"
run_browser drive-identite
run_browser drive-affichage

fuser -k "$PORT/tcp" 2>/dev/null
echo
[ $fail -eq 0 ] && echo "TOUT PASSE" || echo "AU MOINS UNE SUITE EN ÉCHEC"
exit $fail
