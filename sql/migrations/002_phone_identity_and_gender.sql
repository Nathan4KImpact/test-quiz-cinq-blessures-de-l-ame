-- Migration V3 : le téléphone devient l'identifiant unique des
-- participants (à la place de l'email, qui reste obligatoire), et ajoute
-- le genre. À exécuter une seule fois, dans le SQL Editor de Supabase,
-- sur une base déjà créée avec sql/schema.sql (V2).
--
-- Cette migration est conçue pour PRÉSERVER les données existantes :
-- si des participants V2 n'avaient pas de téléphone (ou avaient un même
-- téléphone que quelqu'un d'autre), on leur assigne automatiquement un
-- placeholder dérivé de leur identifiant interne. Ils peuvent ensuite
-- refaire le test avec leur vrai numéro : la ligne sera mise à jour.

-- 1) Colonne genre.
alter table participants add column if not exists gender text;
alter table participants drop constraint if exists participants_gender_check;
alter table participants add constraint participants_gender_check
  check (gender is null or gender in ('homme', 'femme'));

-- 2) L'email reste obligatoire, mais on retire la contrainte d'unicité
--    (le téléphone prend ce rôle). L'unicité de l'email peut être remise
--    plus tard si tu veux, mais elle n'est plus indispensable au suivi
--    dans le temps, désormais fait par téléphone.
alter table participants drop constraint if exists participants_email_key;

-- 3) Le téléphone devient l'identifiant unique.
--    a) On remplit les valeurs manquantes ou en doublon par un
--       placeholder unique (préfixé "migrated-" pour être reconnaissable).
--       Aucune ligne n'est ainsi perdue.
update participants
set phone = 'migrated-' || substring(id::text, 1, 8)
where phone is null or phone = '';

--    b) Résout les éventuels doublons de téléphone en gardant intact
--       le plus ancien et en ajoutant un suffixe unique aux autres.
with dupes as (
  select id, phone,
         row_number() over (partition by phone order by created_at asc, id asc) as rn
  from participants
  where phone is not null and phone <> ''
)
update participants p
set phone = p.phone || '-dup-' || substring(p.id::text, 1, 4)
from dupes d
where p.id = d.id and d.rn > 1;

--    c) On peut maintenant appliquer NOT NULL et UNIQUE sans casse.
alter table participants alter column phone set not null;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'participants_phone_key'
  ) then
    alter table participants add constraint participants_phone_key unique (phone);
  end if;
end $$;
