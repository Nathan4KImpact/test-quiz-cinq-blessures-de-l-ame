-- Migration 005 — mot de passe participant.
--
-- Le mot de passe devient le chemin de connexion principal ; le code
-- reçu par e-mail (migration 004) reste le chemin de secours : il sert à
-- définir un mot de passe quand on n'en a pas encore — cas de toutes les
-- personnes déjà en base — et à en changer quand on l'a oublié.
--
-- À exécuter dans Supabase : SQL Editor → New query → coller → Run.
-- Ré-exécutable sans risque.

-- Nullable à dessein : les dossiers existants n'ont pas de mot de passe
-- et ne doivent pas être bloqués. La colonne reste vide jusqu'à ce que la
-- personne en définisse un via le code e-mail.
alter table participants add column if not exists password_hash text;
alter table participants add column if not exists password_set_at timestamptz;

-- Le hachage est calculé côté serveur (scrypt, api/_lib/password.js) et
-- stocké sous la forme « scrypt$N$r$p$sel$empreinte ». Aucun mot de passe
-- en clair ne transite jamais jusqu'ici.
comment on column participants.password_hash is
  'Empreinte scrypt du mot de passe, format scrypt$N$r$p$salt$hash. Jamais en clair.';

-- La connexion identifie la personne par son e-mail. Deux dossiers
-- partageant la même adresse rendraient cette identification ambiguë :
-- cette requête les liste pour que l'accompagnant puisse les fusionner
-- ou corriger une adresse avant que le cas ne se pose.
--
--   select email, count(*), array_agg(phone) as telephones
--   from participants
--   group by email having count(*) > 1;
