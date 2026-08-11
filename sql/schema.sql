-- Test des 5 blessures de l'âme — schéma Supabase
--
-- À exécuter une seule fois : dans le dashboard Supabase, ouvrir
-- "SQL Editor" → "New query", coller tout ce fichier, puis "Run".
-- Peut être ré-exécuté sans risque (create if not exists partout).

create extension if not exists pgcrypto;

-- Une ligne par personne ayant passé le test au moins une fois.
-- L'email sert d'identifiant stable pour relier les passations successives
-- de la même personne dans le temps (suivi d'évolution).
create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  first_name text not null,
  last_name text not null,
  phone text,
  city text,
  postal_code text,
  created_at timestamptz not null default now(),
  last_test_at timestamptz,
  reminder_sent_at timestamptz
);

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

-- Sécurité : on active RLS et on ne crée volontairement AUCUNE policy.
-- Résultat : la clé publique (anon) n'a accès à rien, même si elle fuitait
-- un jour côté client. Seule la clé service_role — utilisée uniquement dans
-- les fonctions serverless côté serveur, jamais envoyée au navigateur —
-- peut lire/écrire, car elle contourne RLS par conception.
alter table participants enable row level security;
alter table attempts enable row level security;
