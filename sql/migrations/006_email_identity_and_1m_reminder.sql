-- Migration 006 — l'e-mail devient la clé d'identité, et rappel à 1 mois.
--
-- Deux changements indépendants, réunis parce qu'ils touchent la même table.
--
-- 1. CLÉ D'IDENTITÉ. Jusqu'ici le téléphone était unique et servait à
--    relier les passations successives d'une même personne. Il reste
--    obligatoire, mais n'est plus unique : plusieurs personnes d'un même
--    foyer peuvent désormais passer le test en donnant le même numéro.
--    C'est l'e-mail qui devient la clé — celle de la connexion comme celle
--    du rattachement des tests.
--
-- 2. RAPPEL À 1 MOIS. Une seconde colonne de suivi, distincte de celle du
--    rappel à 6 mois, pour qu'une personne reçoive au plus un rappel de
--    chaque sorte entre deux passations.
--
-- À exécuter dans Supabase : SQL Editor → New query → coller → Run.
-- Ré-exécutable sans risque.
--
-- TOUT EST DANS UNE TRANSACTION. Sans elle, chaque instruction serait
-- validée au fil de l'eau : un arrêt au milieu laisserait la base à
-- moitié migrée — téléphone déjà non unique, e-mail pas encore unique,
-- c'est-à-dire sans aucune clé d'identité. Ici, soit tout passe, soit
-- rien ne change.

begin;

-- ---------------------------------------------------------------------
-- 1. Rappel à 1 mois
-- ---------------------------------------------------------------------

alter table participants add column if not exists reminder_1m_sent_at timestamptz;

comment on column participants.reminder_1m_sent_at is
  'Date d''envoi du rappel à 1 mois. Remise à null à chaque nouvelle passation.';

-- ---------------------------------------------------------------------
-- 2. Normalisation des adresses
-- ---------------------------------------------------------------------
--
-- AVANT le contrôle de doublons, et non après : « B@Ex.com » et
-- « b@ex.com » sont la même boîte aux lettres. Contrôler d'abord et
-- normaliser ensuite laisserait passer ce doublon-là, pour le voir
-- ressurgir à la création de l'index — avec un message beaucoup moins
-- utile.

update participants set email = lower(trim(email)) where email <> lower(trim(email));

-- ---------------------------------------------------------------------
-- 3. Garde-fou : aucune adresse en double
-- ---------------------------------------------------------------------
--
-- Volontairement bloquant, et volontairement SANS fusion automatique.
-- Deux dossiers partageant une adresse peuvent être la même personne
-- enregistrée deux fois — ou deux personnes d'un même foyer qui utilisent
-- la boîte du couple. Fusionner à l'aveugle mêlerait le suivi
-- psychologique de deux personnes différentes : c'est un arbitrage humain,
-- pas une décision de migration.
--
-- Si la migration s'arrête ici, lister les cas :
--
--   select lower(trim(email)) as email, count(*) as dossiers,
--          array_agg(phone) as telephones,
--          array_agg(first_name || ' ' || last_name) as noms
--   from participants
--   group by 1 having count(*) > 1;
--
-- Puis, pour chaque groupe : soit corriger l'adresse de l'un des dossiers,
-- soit les fusionner à la main (déplacer les passations vers le dossier à
-- conserver, en renumérotant attempt_number, avant de supprimer l'autre).

do $$
declare
  doublons text;
begin
  select string_agg(email || ' (' || n || ' dossiers)', ', ')
    into doublons
  from (
    select email, count(*) as n
    from participants
    group by email
    having count(*) > 1
  ) d;

  if doublons is not null then
    raise exception
      'Migration 006 interrompue : adresses e-mail en double — %. '
      'Corriger ou fusionner ces dossiers avant de rejouer la migration. '
      'Aucune modification n''a été appliquée.', doublons;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 4. Le téléphone n'est plus unique
-- ---------------------------------------------------------------------
--
-- La contrainte a pu être créée sous des noms différents selon l'histoire
-- de la base (schema.sql d'origine, ou migration 002). On retire toute
-- contrainte d'unicité portant sur la seule colonne phone, quel que soit
-- son nom, ainsi que les index uniques équivalents.

do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    where rel.relname = 'participants'
      and ns.nspname = 'public'
      and con.contype = 'u'
      and con.conkey = array[
        (select attnum from pg_attribute
          where attrelid = rel.oid and attname = 'phone')
      ]
  loop
    execute format('alter table participants drop constraint %I', c.conname);
  end loop;
end $$;

do $$
declare
  i record;
begin
  for i in
    select indexname from pg_indexes
    where schemaname = 'public'
      and tablename = 'participants'
      and indexdef ilike '%unique%'
      and indexdef ilike '%(phone)%'
  loop
    execute format('drop index if exists public.%I', i.indexname);
  end loop;
end $$;

-- Le téléphone reste obligatoire : il sert au contact et à
-- l'identification par l'accompagnant, simplement il n'identifie plus
-- un dossier à lui seul.
alter table participants alter column phone set not null;

-- ---------------------------------------------------------------------
-- 5. L'e-mail devient unique
-- ---------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    where rel.relname = 'participants' and con.conname = 'participants_email_unique'
  ) then
    alter table participants add constraint participants_email_unique unique (email);
  end if;
end $$;

comment on column participants.email is
  'Clé d''identité du participant depuis la migration 006 : unique, sert à '
  'la connexion et au rattachement des passations successives.';

comment on column participants.phone is
  'Obligatoire mais non unique depuis la migration 006 : plusieurs personnes '
  'd''un même foyer peuvent partager un numéro.';

commit;
