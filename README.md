# Test des 5 blessures de l'âme

Ce test a pour but d'identifier les blessures dont la Leaman est porteuse,
ainsi que les comportements qu'elle adopte le plus souvent, afin de proposer
un accompagnement psychologique et spirituel adéquat.

> « Bien-aimée, je souhaite que tu prospères à tous égards et sois en bonne
> santé, comme prospère l'état de ton âme. » (3 Jean 1:2)

## À propos

Application web (adaptée mobile) qui fait passer le test des 5 blessures
émotionnelles inspirées de l'approche de Lise Bourbeau — **Trahison**,
**Rejet**, **Abandon**, **Humiliation**, **Injustice** — puis génère un
rapport personnalisé : score par blessure, blessure dominante, explications
et 3 actions concrètes pour chacune.

- 50 affirmations (10 par blessure), notées de 1 (Non) à 3 (Oui)
- Calcul automatique des scores et de la blessure dominante
- Rapport détaillé (besoins clés, compréhension, signes, actions) pour les 5 blessures
- 100 % client-side : aucune réponse n'est envoyée à un serveur : les réponses
  restent uniquement dans le navigateur (`localStorage`), et permettent de
  reprendre le test après une fermeture accidentelle
- Bouton pour réserver une séance de coaching (ouvre un e-mail pré-rempli)
  et bouton pour imprimer / enregistrer le résultat en PDF
- Interface responsive (mobile-first), sans dépendance ni étape de build

## Lancer le projet en local

Le site est statique (HTML/CSS/JS vanilla), il suffit de le servir :

```bash
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

Ou en ouvrant directement `index.html` dans un navigateur.

## Déploiement

Comme il s'agit d'un site 100 % statique, il peut être déployé tel quel sur
GitHub Pages, Netlify, Vercel ou tout hébergeur de fichiers statiques — sans
étape de build.

## Structure

```
index.html        Structure des 3 écrans (accueil, quiz, résultats)
css/style.css      Styles responsives (mobile-first)
js/data.js         Contenu du test : 50 questions + fiches des 5 blessures
js/app.js          Logique de l'application (état, score, rendu, persistance)
```
