-- Test des 5 blessures de l'âme — schéma Supabase
--
-- Pour une INSTALLATION NEUVE : dans le dashboard Supabase, ouvrir
-- "SQL Editor" → "New query", coller tout ce fichier, puis "Run".
-- Peut être ré-exécuté sans risque (create if not exists partout).
--
-- Pour une base DÉJÀ EN SERVICE : ne pas utiliser ce fichier, exécuter
-- les fichiers de sql/migrations/ dans l'ordre de leur numéro. Ce
-- fichier décrit l'état d'arrivée ; les migrations savent en plus quoi
-- faire des données déjà présentes.
--
-- ⚠️ Ce fichier doit rester synchronisé avec sql/migrations/ : toute
-- colonne ou table ajoutée par une migration doit être reprise ici, sinon
-- une réinstallation repart avec un schéma périmé. Le test
-- tests/test-schema.js vérifie cette correspondance.
-- État décrit ici : après la migration 006.

create extension if not exists pgcrypto;

-- Une ligne par personne ayant passé le test au moins une fois.
--
-- L'E-MAIL EST LA CLÉ D'IDENTITÉ (unique) : il relie les passations
-- successives d'une même personne dans le temps et sert à la connexion.
-- Le téléphone reste obligatoire — contact, identification par
-- l'accompagnant — mais n'est PAS unique : plusieurs personnes d'un même
-- foyer doivent pouvoir donner le même numéro (un enfant qui passe le
-- test avec le numéro d'un parent).
create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  phone text not null,
  gender text check (gender is null or gender in ('homme', 'femme')),
  first_name text not null,
  last_name text not null,
  city text,
  postal_code text,
  created_at timestamptz not null default now(),
  last_test_at timestamptz,
  -- Suivi des relances. Deux colonnes distinctes pour qu'une personne
  -- reçoive au plus un rappel de chaque sorte entre deux passations ;
  -- repasser le test les remet toutes deux à null.
  reminder_1m_sent_at timestamptz,
  reminder_sent_at timestamptz,
  -- Mot de passe participant. Nullable à dessein : un dossier créé en
  -- passant le test n'en a pas, il se définit depuis l'espace personnel.
  password_hash text,
  password_set_at timestamptz
);

comment on column participants.email is
  'Clé d''identité du participant : unique, sert à la connexion et au '
  'rattachement des passations successives. Toujours stockée en minuscules.';

comment on column participants.phone is
  'Obligatoire mais non unique : plusieurs personnes d''un même foyer '
  'peuvent partager un numéro.';

comment on column participants.reminder_1m_sent_at is
  'Date d''envoi du rappel à 1 mois. Remise à null à chaque nouvelle passation.';

comment on column participants.password_hash is
  'Empreinte scrypt du mot de passe, format scrypt$N$r$p$salt$hash. Jamais en clair.';

-- Pas d'index supplémentaire sur email : la contrainte d'unicité
-- ci-dessus en crée déjà un, qui sert les recherches par adresse. Une
-- base migrée porte en plus participants_email_idx (migration 004),
-- devenu redondant depuis la migration 006 — sans conséquence, mais
-- inutile à recréer sur une installation neuve.

-- Une ligne par passation du test (une personne peut en avoir plusieurs).
create table if not exists attempts (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references participants(id) on delete cascade,
  attempt_number int not null,
  taken_at timestamptz not null default now(),
  score_trahison int not null,
  score_rejet int not null,
  score_abandon int not null,
  score_humiliation int not null,
  score_injustice int not null,
  dominant_wounds text[] not null,
  answers jsonb not null
);

create index if not exists attempts_participant_id_idx on attempts (participant_id);
create index if not exists attempts_taken_at_idx on attempts (taken_at);
create unique index if not exists attempts_participant_attempt_number_key
  on attempts (participant_id, attempt_number);

-- Codes de connexion à usage unique envoyés par e-mail (chemin de
-- secours : définir un premier mot de passe, ou en changer quand il est
-- oublié).
--
-- Le code lui-même n'est JAMAIS stocké : on garde un HMAC-SHA256 calculé
-- côté serveur avec SESSION_SECRET. Une fuite de la seule base ne permet
-- donc pas de retrouver les codes (le secret ne s'y trouve pas), et un
-- code à 6 chiffres reste inexploitable hors ligne sans lui.
create table if not exists participant_login_codes (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references participants(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  -- Compteur d'essais : au-delà d'un petit nombre, le code est brûlé.
  -- Sans cela, 6 chiffres se cassent en quelques milliers de requêtes.
  attempts int not null default 0,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Sert à la fois à retrouver le dernier code d'une personne et à compter
-- les demandes récentes (limitation du nombre d'envois).
create index if not exists participant_login_codes_participant_idx
  on participant_login_codes (participant_id, created_at desc);

-- Sécurité : on active RLS et on ne crée volontairement AUCUNE policy.
-- Résultat : la clé publique (anon) n'a accès à rien, même si elle fuitait
-- un jour côté client. Seule la clé service_role — utilisée uniquement dans
-- les fonctions serverless côté serveur, jamais envoyée au navigateur —
-- peut lire/écrire, car elle contourne RLS par conception.
alter table participants enable row level security;
alter table attempts enable row level security;
alter table participant_login_codes enable row level security;
