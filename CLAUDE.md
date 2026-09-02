# Base de connaissances — Test des 5 blessures de l'âme

Fichier de mémoire long terme pour ce projet **et** synthèse
d'expérience du travail mené avec un assistant IA (Claude Code).
Objectif : qu'une session Claude qui débarque à froid — comme moi qui
reviens plus tard — retrouve immédiatement les repères, et que je
puisse réutiliser les patterns qui ont marché sur d'autres projets.

---

## 1. Ce qui a été construit

Une application web (mobile-first) qui fait passer un test
psychologique (les 5 blessures émotionnelles de Lise Bourbeau — 50
questions), enregistre les résultats de chaque participant, et met à
disposition un tableau de bord admin pour suivre l'évolution des
scores dans le temps.

**Utilisateur final** : formulaire d'accueil (genre, prénom, nom,
téléphone, email, ville/CP, consentement), quiz de 50 questions,
rapport personnalisé (blessure dominante + modérée détaillées,
graphique en barres pour les 5 blessures).

**Admin** : tableau filtrable de tous les participants, graphique
d'évolution des 5 blessures par personne (fenêtres 6 mois / 1 an /
3 ans / 5 ans / tout), rapport détaillé rejouable pour n'importe
quelle passation, import/export CSV, impression PDF, suppression.

**Localisation** : français, contenu adapté au genre choisi (
« accepté(e) » → « accepté » ou « acceptée »).

---

## 2. Architecture technique

### Choix structurants (et pourquoi)

- **Front statique HTML/CSS/JS vanilla, zéro build, zéro dépendance
  npm côté navigateur.** Rend l'app trivialement déployable partout
  (Vercel, GitHub Pages, n'importe quel bucket), rapide à démarrer,
  éternelle à maintenir.
- **Backend = fonctions serverless Vercel (Node, dossier `api/`)**.
  Pas de serveur à gérer, autoscale gratuit, cold start négligeable
  pour ce trafic.
- **BDD = Supabase (Postgres géré)**. Choisi *contre* Airtable après
  analyse comparative : vraie base SQL, RLS natif, hébergement UE
  possible, quotas gratuits confortables, données portables.
- **Auth admin = mot de passe + cookie HttpOnly signé HMAC**.
  Volontairement minimaliste : un seul admin.
- **Auth participant = e-mail + mot de passe** (chemin principal),
  **code à 6 chiffres par e-mail** (chemin de secours), puis cookie
  participant signé — rôle distinct de l'admin, 7 jours.
  Choisi *contre* une simple recherche par téléphone ou e-mail : sans
  preuve de possession, l'endpoint deviendrait un moyen de lire le
  suivi psychologique de n'importe qui à partir d'un identifiant
  deviné. Le code est stocké en HMAC (jamais en clair), expire en
  10 min, vaut pour un seul usage, tolère 5 essais, et le nombre
  d'envois est plafonné par personne. Le mot de passe est haché en
  **scrypt** (`api/_lib/password.js`) : un hachage rapide type SHA se
  casserait par force brute hors ligne si la base fuyait.
  Le code e-mail sert à deux choses : définir un premier mot de passe
  (tous les dossiers antérieurs n'en ont pas) et en changer quand il
  est oublié. Un seul endpoint couvre les deux, `set-password`, qui
  exige une session déjà ouverte.

### Modèle de données

Deux tables Postgres seulement :

- `participants` — une ligne par personne. **Clé d'identité stable =
  téléphone normalisé** (pas l'email, qui peut changer). `email`
  obligatoire pour le contact, `gender` en check `('homme','femme')`,
  `city`/`postal_code` facultatifs, `created_at`/`last_test_at`
  /`reminder_sent_at` pour le suivi.
- `attempts` — une ligne par passation, FK vers `participants` avec
  **`ON DELETE CASCADE`** (supprimer une personne emporte ses tests),
  `attempt_number` incrémental par participant (index unique composite
  `(participant_id, attempt_number)`), scores stockés par blessure,
  `dominant_wounds text[]` pour gérer les ex æquo, `answers jsonb`
  pour les 50 réponses brutes.

**Sécurité** : RLS activé sur les deux tables **sans aucune policy**
publique. Seule la clé `service_role` (secrète, côté serveur
uniquement) contourne RLS. Défense en profondeur : même si la clé
`anon` fuitait un jour, aucun accès aux données. Voir `sql/schema.sql`
et `sql/migrations/*.sql`.

### Arborescence

```
index.html               Écrans public : accueil, connexion, espace, quiz, résultats
admin.html                Tableau de bord admin
css/style.css             Structure + thème « classique » (rose/bleu selon le genre)
css/themes.css            Thème « signature » (charte Vie Florissante) + sélecteur
css/fonts.css             @font-face de Poppins (fichiers dans fonts/, pas de CDN)
css/admin.css             Styles admin
js/data.js                Contenu du test : 50 questions + fiches des 5 blessures + genderize()
js/theme.js               Choix et mémorisation du jeu de thèmes
js/evolution-chart.js     Graphique d'évolution + légende, partagé public/admin
js/progress.js            Détection des progrès entre passations (bandeau de félicitations)
js/confetti.js            Confetti canvas maison, sans dépendance
js/app.js                 Logique publique (état, scoring local, submit, rendu, espace participant)
js/admin.js               Logique admin
sql/schema.sql             Schéma pour installation neuve
sql/migrations/            Migrations à exécuter dans l'ordre sur une base existante
api/submit.js              Enregistre une passation (validation + upsert par téléphone)
api/auth/[action].js       Route unique de l'authentification (voir plafond Vercel)
api/_auth/login.js         Connexion e-mail + mot de passe (chemin principal)
api/_auth/request-code.js  Envoie un code à 6 chiffres par e-mail (secours)
api/_auth/verify-code.js   Vérifie le code, ouvre la session participant
api/_auth/set-password.js  Définit ou change le mot de passe (session requise)
api/_auth/logout.js        Déconnexion participant
api/_auth/me.js            Dossier du participant connecté (profil + historique)
api/_lib/mailer.js         Envoi Resend minimaliste
api/_lib/password.js       Hachage scrypt des mots de passe
api/admin/login.js         Auth admin (compare le mot de passe, pose le cookie)
api/admin/logout.js        Efface le cookie
api/admin/participants.js  Liste + dernier résultat de chaque participant
api/admin/participant.js   GET détail + historique / DELETE participant
api/cron/reminders.js      Cron : rappel 6 mois via Resend (optionnel)
api/_lib/supabase.js       Client REST minimaliste vers PostgREST
api/_lib/scoring.js        Recalcul serveur des scores + validation
api/_lib/auth.js           Cookie signé HMAC, comparaison timing-safe
vercel.json                cleanUrls + définition du cron
```

### Variables d'environnement Vercel

| Variable | Obligatoire | Rôle |
|---|---|---|
| `SUPABASE_URL` | ✅ | URL du projet Supabase — **sans** `/rest/v1` final (le code l'ajoute) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Clé **secrète** service_role, **jamais** la clé `anon` |
| `ADMIN_PASSWORD` | ✅ | Mot de passe pour `/admin.html` |
| `SESSION_SECRET` | ✅ | Chaîne aléatoire pour signer le cookie admin (ex. `openssl rand -hex 32`) |
| `CRON_SECRET` | si cron | Vercel l'injecte automatiquement à la tâche planifiée |
| `RESEND_API_KEY` | si connexion participant | Codes de connexion + rappels e-mail à 6 mois |
| `REMINDER_FROM_EMAIL` | recommandé | Adresse d'expédition (`Nom <adresse>` accepté) |
| `REPLY_TO_EMAIL` | recommandé | Où arrivent les réponses — obligatoire si on expédie depuis un sous-domaine technique sans boîte |
| `APP_URL` | optionnel | URL publique, utilisée dans le lien du mail de rappel |

⚠️ Les variables **doivent** être définies au niveau **du projet
Vercel**, pas en « Shared » au niveau Team, sinon elles ne sont pas
injectées dans les fonctions. Chaque changement nécessite un
redéploiement.

---

## 3. Patterns qui ont marché (à réutiliser)

### Développement piloté par l'usage

- **Toujours tester le parcours de bout en bout dans un vrai
  navigateur** avant de dire « c'est fait ». Playwright + mock API
  local a rattrapé plusieurs bugs invisibles côté code (thème qui
  n'appliquait pas, race condition sur les clics, etc.).
- **Une PR par changement**, petites et mergeables. On voit
  exactement ce qui a produit chaque évolution ; roll-back facile.
- **README avec table de variables d'env, chemin de migration et
  bouton « Deploy with Vercel »** — accélère toute reprise.

### Spécificité CSS : les thèmes cassent les états, silencieusement

**Symptôme** : dans le thème signature, le bouton de période actif
apparaissait blanc sur blanc, et la réponse sélectionnée gardait son
texte blanc sur un fond pâle.
**Cause** : `html[data-theme="x"] .classe` pèse (0,2,1) et passe donc
devant les états écrits `.classe.active` (0,2,0) dans style.css. Le
thème écrasait le fond sans toucher à la couleur du texte.
**Règle** : un thème qui redéfinit une surface **doit redonner
explicitement chaque état actif** (`.active`, `.selected`,
`:has(input:checked)`, `[data-dominant]`) à une spécificité supérieure.
**Détection** : un test Playwright qui mesure le **ratio de contraste
calculé** entre `color` et `backgroundColor` — un test fonctionnel
passe très bien sur un bouton invisible.

### Un endpoint ouvert ne doit jamais toucher à un secret

**Contexte** : `/api/submit` est public et identifie la personne par son
téléphone — c'est ce qui permet de relier les passations. En ajoutant le
mot de passe au formulaire du test, la tentation était de le faire
enregistrer par le même endpoint.
**Le piège** : qui connaît un numéro de téléphone aurait pu poser un mot
de passe sur le dossier de son titulaire, puis se connecter et lire tout
son suivi psychologique. Une fonctionnalité de confort ouvrait une
usurpation complète.
**Règle** : `/api/submit` n'accepte un mot de passe que pour un dossier
**qu'il crée**. Modifier celui d'un dossier existant passe uniquement par
`set-password`, qui exige une session déjà prouvée par code e-mail.
**Test associé** : une passation « pirate » sur le téléphone de
quelqu'un, avec un mot de passe dans la charge utile, puis vérification
que l'ancien mot de passe fonctionne toujours et que le nouveau est
refusé.

### Ne jamais faire transiter un secret par localStorage

L'état du quiz est sérialisé dans `localStorage` à chaque réponse pour
permettre la reprise. Y ranger le mot de passe choisi au formulaire
l'aurait laissé en clair sur l'appareil — souvent partagé — longtemps
après la fin du test. Il vit donc dans une variable de module
(`pendingPassword`), effacée dès l'envoi. Un test relit `localStorage`
après la passation pour vérifier que le mot de passe ne s'y trouve pas.

### Une police de CDN est une fuite de données, pas un détail technique

Charger Poppins depuis `fonts.googleapis.com` envoie l'adresse IP de
chaque visiteur à Google, ce que la justice européenne a jugé contraire
au RGPD en l'absence de consentement — pour une association française qui
recueille du suivi psychologique, c'est disqualifiant.
**Correctif** : les six `.woff2` (3 graisses × latin et latin-ext) vivent
dans `fonts/`, déclarés par `css/fonts.css`. 39 Ko au total, et
`unicode-range` laisse le navigateur ne prendre que ce dont la page a
besoin — en pratique le seul `latin`, soit 23 Ko.
**Au passage** : le devanagari livré par défaut par Google était inutile
ici, un tiers du poids économisé sans rien perdre.
**Test associé** : un test compte les requêtes sortantes au chargement
des deux pages et échoue s'il en part une seule vers un autre domaine.
Vérifier « la police s'affiche » ne dit rien sur d'où elle vient.

### Confidentialité et sécurité par construction

- Données sensibles → **Postgres à soi, RLS locked, service_role
  jamais côté client**. La clé `anon` peut fuiter sans conséquence.
- Auth admin → **cookie HttpOnly + Secure + SameSite=Strict**, signé
  HMAC (pas de token stocké côté serveur pour cette échelle).
- Comparaison de mot de passe → **`crypto.timingSafeEqual`** avec
  buffers de longueurs équilibrées pour ne pas leaker la longueur.
- **Ne jamais faire confiance aux valeurs calculées côté client** :
  `api/submit.js` reçoit les 50 réponses brutes et **recalcule** les
  scores côté serveur. C'est le serveur qui décide de la blessure
  dominante, pas le navigateur.

### UX pensée pour l'objectif du test

- **Genre choisi en premier** — il pilote le thème (rose Leaman /
  bleu Kanegnon) et l'accord grammatical de tout le contenu.
- **Nom de la blessure caché pendant le quiz** — pour ne pas biaiser
  les réponses. C'était un vrai retour utilisateur, pas une intuition.
- **Rapport limité à la dominante + modérée** — une lecture non
  écrasante en première approche. Le graphique en barres montre
  quand même les 5 pour contexte.
- **Verset complet imprimable** — le verset de 3 Jean 1:2 est
  central pour l'usage spirituel du test ; il doit apparaître intact
  sur la version papier.

### Données évolutives (schéma qui bouge)

- **Migrations SQL versionnées** dans `sql/migrations/` numérotées
  (`002_...`), idempotentes (`if not exists`, `drop constraint if
  exists`).
- **Préserver les données existantes** : avant d'imposer un `NOT
  NULL` ou une unicité, **remplir les valeurs manquantes** avec un
  placeholder unique dérivé de l'ID interne, et dédoublonner avec un
  suffixe. Une migration ne doit jamais rejeter la base entière parce
  qu'une ligne historique était incomplète.
- **Bumper la clé localStorage** (`blessures-ame-quiz-v3` au lieu de
  `v2`) quand la structure de l'état côté client change.

### Rendre visible ce qui est invisible

- Côté serveur : **retourner un tableau `details` explicite** dans
  les erreurs 4xx (`{ error, details: ["email invalide", ...] }`) et
  loguer avec `content-type` et type de body reçu. Sans ça, un 400
  ressemble à « ça marche pas » sans piste.
- Côté client : **`console.warn` avec le corps de la réponse** en
  cas d'échec silencieux. Sur le premier bug de prod on avait « no
  outgoing requests » dans Vercel logs — sans le détail côté serveur,
  impossible de conclure.

---

## 4. Anti-patterns et pièges rencontrés

### Validation client/serveur incohérente

**Symptôme** : formulaire accepte, serveur refuse.
**Cause** : regex email plus stricte côté serveur que la validation
native du navigateur (`type="email"`).
**Règle** : **la validation serveur ne doit jamais être plus stricte
que la validation client**. Idem pour longueurs, formats, casse.

### Race condition sur double-clic + setTimeout

**Symptôme** : quelques réponses manquantes (`null`) après un test
pourtant terminé — refusé côté serveur avec « réponses invalides ».
**Cause** : chaque clic programmait un `setTimeout` pour avancer à la
question suivante ; un second clic pendant la fenêtre de 220ms
déclenchait un second minuteur en parallèle, sautant une question.
**Correctif** : booléen `isTransitioning` qui verrouille les clics
pendant la transition, + tracking du minuteur en cours pour l'annuler
si l'utilisateur revient en arrière.
**Leçon** : dès qu'un `setTimeout` déclenche une action irréversible,
il faut un garde-fou anti-course.

### Migration qui casse sur données historiques

**Symptôme** : `alter table ... alter column phone set not null`
échoue si une ligne V2 avait un téléphone vide.
**Correctif** : `update participants set phone = 'migrated-' ||
substring(id::text, 1, 8) where phone is null or phone = ''` avant le
`SET NOT NULL`. Idem pour dédoublonnage avant `UNIQUE`.
**Leçon** : toute contrainte plus stricte doit être précédée du
remplissage / de la déduplication qui la rend valide.

### Le plan Hobby de Vercel plafonne à 12 fonctions serverless

**Symptôme** : `Build Failed — No more than 12 Serverless Functions can be
added to a Deployment on the Hobby plan`. Trois commits d'affilée non
déployés, alors que tout passait en local.
**Cause** : **chaque fichier `.js` de `api/` devient une fonction**.
Ajouter six endpoints d'authentification a fait passer le projet de 9 à
15. Le build échoue *après* « Build Completed », au moment de déployer —
donc les logs de build sont verts et n'aident pas.
**Correctif** : une **route dynamique** `api/auth/[action].js` regroupe
les six chemins en une seule fonction, les handlers étant déplacés sous
`api/_auth/`. **Un dossier préfixé par `_` n'est pas transformé en
fonction** — c'est déjà ce qui fait que `api/_lib/` ne compte pas.
Vercel place le segment d'URL dans `req.query.action`, donc **les URL
publiques ne changent pas**.
**Vérification** : à `origin/main`, `api/` contenait 13 fichiers dont 9
endpoints et ça buildait — la preuve empirique que `_lib` ne compte pas,
avant de s'appuyer dessus.
**Garde-fou** : un test compte les fichiers de `api/` hors préfixe `_` et
échoue au-delà de 12. Sans lui, on ne s'en aperçoit qu'au déploiement.

### Envs Vercel « Shared » vs projet

**Symptôme** : `ADMIN_PASSWORD n'est pas configuré côté serveur`
alors qu'il est bien dans la console.
**Cause** : les variables « Shared » (Team-level) ne sont pas
automatiquement injectées dans un projet, il faut les lier
explicitement, ou les redéfinir au niveau du projet.
**Leçon** : par défaut, mettre les env vars **au niveau du projet**.
Et **redéployer** après toute modification.

### Mélanger données sensibles dans une base existante

**Contexte** : deux bases Airtable préexistantes de suivi pastoral
sensibles. Tentation de tout mettre dans la même base.
**Décision** : refus, base dédiée. Une base par domaine, pas de
partage entre systèmes non liés.

---

## 5. Décisions produit tranchées en cours de route

| Décision | Retenue | Raison |
|---|---|---|
| Backend BDD | Supabase (Postgres) | Vs Airtable : RLS, EU, portabilité, SQL |
| Identifiant de suivi | Téléphone normalisé | L'email peut changer plus souvent |
| Rapport détaillé | Dominante + modérée seulement | Éviter la surcharge cognitive |
| Ordre du sélecteur de genre | Femme (Leaman) d'abord | Public prioritaire du test |
| Séparateur d'ex-æquo | ` - ` (au lieu de ` & `) | Plus neutre visuellement |
| Label graphique de sévérité | Horizontal (pas vertical) | Lisibilité |
| Dates du graphique | Oblique -30° | Évite le chevauchement quand tests rapprochés |
| Session admin | 12h, cookie HttpOnly signé | Simple, pas de DB de sessions |
| Rappels e-mail | Optionnels (Resend) | L'app fonctionne sans si non configuré |

---

## 6. Manière de travailler avec Claude qui a fait la différence

### Ce qui accélère

- **Décrire le problème réel plutôt que la solution imaginée**.
  « je veux les labels lisibles » a produit une meilleure solution
  (horizontal + décalage anti-chevauchement) que si j'avais dit « fais
  les rotés à 45° ».
- **Fournir les captures d'écran des bugs**. Photo de la console
  Chrome avec `Array(1)` et les indexes `null` a permis de trouver la
  race condition en une itération.
- **Coller les logs verbatim** (Vercel logs, DevTools Network) au
  lieu de les résumer.
- **Valider des micro-livrables (PR par PR)** plutôt qu'une grosse
  livraison finale — les allers-retours sur des petits diffs ne
  coûtent presque rien.

### Ce qui ralentit

- Instructions contradictoires dans la même liste (ex. « mets Test
  n°1 » et « mets Test passé : 1 » pour la même chose) → il faut
  arbitrer, puis quelqu'un revient dessus. Mieux vaut trancher net
  dès la V1.
- Modifier les fichiers manuellement en parallèle d'une PR en cours
  sans le dire → Claude peut annuler par mégarde. Toujours signaler.
- Demander des choses spéculatives (« et si… ») avant que la V
  courante soit stable → dilue l'énergie.

### Boucle qui fonctionne pour un projet comme celui-ci

1. Décrire un besoin utilisateur concret (pas un design).
2. Claude propose une approche + montre les tradeoffs.
3. Valider ou rediriger d'un mot.
4. Implémentation + test Playwright + capture d'écran envoyée.
5. Ajustement fin ou GO.
6. Commit → PR → merge → Vercel redéploie.

---

## 7. Ce qui reste à faire si le projet grandit

Volontairement laissé de côté pour ne pas sur-ingénierer :

- Vraie base d'utilisateurs admin (plusieurs comptes, rôles).
- Rate limiting sur `/api/submit` (bot spam).
- Anonymisation / suppression RGPD à la demande côté participant.
- Analytics globales (moyennes par blessure, par ville, par cohorte).
- Version anglaise / multi-langue (nécessiterait un système de
  chaînes séparé du contenu).
- Tests unitaires JS automatisés (actuellement : `node --check` +
  Playwright de bout en bout).
- Envoi automatique du rapport PDF par mail au participant après le
  test.

---

## 8. Repères pour reprendre le travail à froid

- Branche de dev : `claude/leaman-test-web-app-ahuy0e` (l'user pousse
  ici, les PR ciblent `main`).
- Dépôt : `Nathan4KImpact/test-quiz-cinq-blessures-de-l-ame`.
- Prod : URL Vercel du projet (voir dashboard Vercel de l'user).
- Base : projet Supabase de l'user (région Europe – Frankfurt).
- Contact utilisateur / e-mail par défaut du bouton coaching :
  `nathanaeltalla@hotmail.com` (dans `js/app.js`).
- L'user itère souvent en modifiant lui-même le code entre deux
  échanges (ajout de fonctionnalités CSV, delete, print). **Toujours
  `git fetch origin main` puis `git checkout -B <branche>
  origin/main`** au début de chaque changement pour partir du dernier
  état poussé sur main.
