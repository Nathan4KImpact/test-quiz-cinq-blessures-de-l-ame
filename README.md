# Test des 5 blessures de l'âme

Ce test a pour but d'identifier les blessures dont une personne est porteuse,
ainsi que les comportements qu'elle adopte le plus souvent, afin de proposer
un accompagnement psychologique et spirituel adéquat.

> « Bien-aimée, je souhaite que tu prospères à tous égards et sois en bonne
> santé, comme prospère l'état de ton âme. » (3 Jean 1:2)

## À propos

Application web (adaptée mobile) qui fait passer le test des 5 blessures
émotionnelles inspirées de l'approche de Lise Bourbeau — **Trahison**,
**Rejet**, **Abandon**, **Humiliation**, **Injustice** — puis génère un
rapport personnalisé, et permet un suivi dans le temps.

- 50 affirmations (10 par blessure), notées de 1 (Non) à 3 (Oui) ; la
  blessure en cours n'est pas révélée pendant le test, pour ne pas influencer
  les réponses
- **Homme ou Femme** : palette adaptée (rose ↔ bleu) et
  toutes les formulations « accepté(e) » accordées au genre choisi
- Recueille prénom, nom, téléphone (obligatoire — sert d'identifiant pour
  relier les tests successifs), email (obligatoire, pour le contact et les
  rappels), ville et code postal (facultatifs), avec consentement explicite
- Calcule la blessure dominante (et les ex æquo) et n'explique en détail que
  celle-ci — plus la blessure « modérée » qui suit au classement quand il n'y
  a pas d'ex æquo — pour une première lecture non écrasante
- Chaque passation est enregistrée (base Supabase) et reliée aux tests
  précédents de la même personne via son téléphone, pour suivre son évolution
- **Interface admin** protégée par mot de passe : liste filtrable de tous les
  participants (blessure dominante & modérée en aperçu), et pour chacun un
  graphique d'évolution des 5 blessures dans le temps (6 mois / 1 an / 3 ans
  / 5 ans / tout) avec les zones de sévérité en fond. Chaque test passé peut
  être ouvert pour voir le rapport complet tel que l'utilisateur l'a vu.
- Rappel automatique par e-mail si une personne n'a pas refait le test depuis
  6 mois (optionnel, via Resend)
- Bouton pour réserver une séance de coaching (e-mail pré-rempli) et bouton
  pour imprimer / enregistrer le résultat en PDF (verset complet inclus)
- Interface responsive (mobile-first)

## Architecture

Site statique (HTML/CSS/JS vanilla, aucune dépendance npm, aucune étape de
build) + quelques fonctions serverless Vercel (Node, dossier `api/`) pour
tout ce qui touche à l'enregistrement des données et à l'admin. Les données
sont stockées dans un projet **Supabase** (Postgres géré).

```
index.html              Écrans public : accueil (profil), quiz, résultats
admin.html               Tableau de bord admin (login + suivi des participants)
css/style.css            Styles de l'app publique (structure + thème « classique »)
css/themes.css           Thème « signature » + sélecteur de thème
css/admin.css            Styles du tableau de bord admin
js/data.js               Contenu du test : 50 questions + fiches des 5 blessures
js/theme.js              Choix et mémorisation du jeu de thèmes
js/app.js                Logique de l'app publique (état, score, soumission, résultats, espace participant)
js/admin.js              Logique du tableau de bord admin
api/auth/request-code.js  Envoie un code de connexion à 6 chiffres par e-mail
api/auth/verify-code.js   Vérifie le code et ouvre la session participant
api/auth/logout.js        Déconnexion du participant
api/me.js                 Dossier du participant connecté (profil + historique)
sql/schema.sql            Schéma Supabase à exécuter une fois (SQL Editor)
sql/migrations/           Migrations à jouer dans l'ordre sur une base existante
sql/seed-demo.sql         Jeu de données fictives, facultatif (démo du suivi)
api/submit.js             Enregistre une passation (participant + scores)
api/admin/login.js        Authentification admin (mot de passe → cookie signé)
api/admin/logout.js       Déconnexion admin
api/admin/participants.js Liste de tous les participants + dernier résultat
api/admin/participant.js  Détail d'un participant + historique de ses passations
api/cron/reminders.js     Tâche planifiée : e-mail de rappel après 6 mois d'inactivité
api/_lib/                 Petits utilitaires partagés (Supabase REST, scoring, auth)
```

Aucune réponse n'est jamais visible par un tiers autre que toi : la base
Supabase est verrouillée (RLS activé, aucune policy publique), seules les
fonctions serverless — via une clé secrète côté serveur — peuvent y accéder.

## Mise en place (une seule fois)

### 1. Base de données Supabase

1. Créer un projet sur [supabase.com](https://supabase.com) (région Europe
   recommandée pour des données sensibles).
2. Dans le dashboard du projet : **SQL Editor → New query**, coller le
   contenu de [`sql/schema.sql`](sql/schema.sql), puis **Run**.
   - **Base existante ?** ne pas rejouer `schema.sql` : exécuter les
     migrations manquantes, dans l'ordre, depuis `sql/migrations/` :
     - [`002_phone_identity_and_gender.sql`](sql/migrations/002_phone_identity_and_gender.sql)
       — ajoute le genre et fait du téléphone l'identifiant unique
     - [`003_phone_international_prefix.sql`](sql/migrations/003_phone_international_prefix.sql)
       — passe les téléphones au format international (`+33612345678`)
       et **fusionne les historiques** des personnes qui apparaissaient
       en double (une ligne au format national, une au format
       international). ⚠️ Régler l'indicatif par défaut en tête du
       fichier avant de l'exécuter.
     - [`004_participant_login_codes.sql`](sql/migrations/004_participant_login_codes.sql)
       — crée la table des codes de connexion à usage unique et
       normalise les e-mails existants en minuscules, pour que la
       connexion des participants retrouve le bon dossier
     - [`005_participant_password.sql`](sql/migrations/005_participant_password.sql)
       — ajoute le mot de passe participant (colonnes `password_hash`
       et `password_set_at`, laissées vides pour les dossiers
       existants)
3. Dans **Project Settings → API**, relever :
   - `Project URL` → deviendra `SUPABASE_URL`
   - `service_role` (clé secrète, **jamais** la clé `anon`) → deviendra
     `SUPABASE_SERVICE_ROLE_KEY`
4. *(facultatif)* Pour voir tourner le suivi d'évolution, l'historique et
   le bandeau de félicitations sans repasser le test cinq fois à la main :
   exécuter [`sql/seed-demo.sql`](sql/seed-demo.sql). Il insère trois
   personnes **fictives** (5, 2 et 1 passations), repérables à leur
   téléphone `+3399000000x` et au suffixe « (démo) » de leur nom. Il est
   ré-exécutable, et se supprime d'une ligne :
   ```sql
   delete from participants where phone like '+3399000000%';
   ```

### 2. Variables d'environnement Vercel

Dans le projet Vercel : **Settings → Environment Variables**, ajouter :

| Variable | Obligatoire | Description |
|---|---|---|
| `SUPABASE_URL` | oui | URL du projet Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | oui | Clé `service_role` Supabase (secrète) |
| `ADMIN_PASSWORD` | oui | Mot de passe pour accéder à `/admin.html` |
| `SESSION_SECRET` | oui | Chaîne aléatoire longue ; signe le cookie admin, le cookie participant et les codes de connexion (ex. `openssl rand -hex 32`) |
| `CRON_SECRET` | oui, si rappels activés | Chaîne aléatoire ; Vercel l'envoie automatiquement à la tâche planifiée pour l'authentifier |
| `RESEND_API_KEY` | oui, pour la connexion participant | Envoi des codes de connexion à 6 chiffres, et de l'e-mail de rappel à 6 mois (compte gratuit sur [resend.com](https://resend.com)) |
| `REMINDER_FROM_EMAIL` | recommandé | Adresse d'expédition (par défaut `onboarding@resend.dev`, à remplacer par un domaine vérifié — sinon les codes risquent d'arriver en spam) |
| `APP_URL` | non | URL publique de l'app, utilisée dans le lien du mail de rappel |

⚠️ **Sans `RESEND_API_KEY`, la connexion par mot de passe fonctionne
toujours**, mais les deux chemins qui passent par l'e-mail sont
indisponibles : « mot de passe oublié » et la première connexion des
personnes déjà en base (qui n'ont pas encore de mot de passe). L'écran
affiche alors un message explicite.

Note sur l'adresse d'expédition : `onboarding@resend.dev`, la valeur par
défaut, ne peut envoyer qu'à l'adresse propriétaire du compte Resend.
Elle sert à tester ; pour un usage réel, vérifier un domaine chez Resend
et renseigner `REMINDER_FROM_EMAIL`.

Aucune de ces valeurs n'a besoin d'être partagée en dehors du dashboard
Vercel.

### 3. Déploiement

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FNathan4KImpact%2Ftest-quiz-cinq-blessures-de-l-ame%2Ftree%2Fclaude%2Fleaman-test-web-app-ahuy0e&project-name=test-5-blessures-de-lame&repository-name=test-5-blessures-de-lame)

Ou manuellement :

1. [vercel.com](https://vercel.com) → **Add New… → Project**, importer
   `Nathan4KImpact/test-quiz-cinq-blessures-de-l-ame`.
2. Renseigner les variables d'environnement ci-dessus.
3. **Deploy** (aucun *build command* nécessaire).

Le tableau de bord admin est accessible sur `<ton-domaine>/admin.html`.

## Lancer le projet en local

Le front est statique, il suffit de le servir :

```bash
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

Pour tester les fonctions serverless (`api/`) en local, utiliser la
[Vercel CLI](https://vercel.com/docs/cli) : `vercel dev` (nécessite les
mêmes variables d'environnement dans un fichier `.env.local`).
