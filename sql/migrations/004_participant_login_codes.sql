-- Migration 004 — connexion des participants par code e-mail à usage unique.
--
-- Objectif : permettre à une personne déjà enregistrée de retrouver son
-- évolution et ses tests passés, sans jamais exposer ces données à qui
-- devinerait un numéro ou une adresse. Le code envoyé par e-mail prouve
-- la possession de la boîte mail : c'est cette preuve qui ouvre l'accès.
--
-- À exécuter dans Supabase : SQL Editor → New query → coller → Run.
-- Ré-exécutable sans risque.

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

-- La connexion retrouve la personne par son e-mail. La comparaison doit
-- être exacte (et non un LIKE) : un « _ » est un joker SQL, et beaucoup
-- d'adresses en contiennent — « jean_martin@x.com » matcherait alors
-- « jeanXmartin@x.com », donnant accès au dossier de quelqu'un d'autre.
--
-- Pour que l'égalité stricte reste insensible à la casse, on normalise
-- les adresses déjà en base : les nouvelles le sont déjà à l'écriture
-- (api/submit.js applique trim + toLowerCase).
update participants
set email = lower(trim(email))
where email is not null and email <> lower(trim(email));

create index if not exists participants_email_idx on participants (email);

-- Même posture que les autres tables : RLS activé, aucune policy. Seule
-- la clé service_role (fonctions serverless) accède aux codes.
alter table participant_login_codes enable row level security;

-- Purge des codes périmés depuis plus de 7 jours. Sans intérêt fonctionnel
-- une fois expirés, ils ne feraient que grossir la table.
delete from participant_login_codes
where expires_at < now() - interval '7 days';
