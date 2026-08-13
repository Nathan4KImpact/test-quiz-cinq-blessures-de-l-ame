-- Migration V3 : le téléphone devient l'identifiant des participants
-- (obligatoire, unique) à la place de l'email (qui devient facultatif),
-- et ajoute le genre. À exécuter une seule fois, dans le SQL Editor de
-- Supabase, sur une base déjà créée avec sql/schema.sql (V2).

-- 1) Genre (nullable pour ne pas casser les lignes déjà existantes).
alter table participants add column if not exists gender text;
alter table participants drop constraint if exists participants_gender_check;
alter table participants add constraint participants_gender_check
  check (gender is null or gender in ('homme', 'femme'));

-- 2) L'email devient facultatif et n'est plus la clé d'unicité.
alter table participants alter column email drop not null;
alter table participants drop constraint if exists participants_email_key;

-- 3) Le téléphone devient obligatoire et unique.
--    /!\ Si des lignes existantes ont un téléphone vide ou en doublon,
--    cette étape échoue. Corrige-les dans le Table Editor (ou supprime
--    les lignes de test) avant de relancer cette migration.
alter table participants alter column phone set not null;
alter table participants add constraint participants_phone_key unique (phone);
