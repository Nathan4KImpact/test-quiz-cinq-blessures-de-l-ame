-- Migration V5 : passage des téléphones au format international.
--
-- Depuis la V5, le formulaire impose un indicatif pays et enregistre les
-- numéros au format international ("+33612345678"). Les participants
-- enregistrés avant cette version ont un numéro national sans indicatif
-- ("0612345678") : sans cette migration, la même personne serait vue
-- comme quelqu'un de nouveau à son prochain test, et son historique
-- serait coupé en deux.
--
-- Cette migration :
--   1. normalise tous les numéros (retire espaces, points, tirets,
--      parenthèses) ;
--   2. préfixe les numéros nationaux avec l'indicatif par défaut ;
--   3. FUSIONNE les doublons quand une personne a déjà repassé le test
--      depuis la V5 (elle a alors deux lignes : l'ancienne au format
--      national et la nouvelle au format international) — les tests des
--      deux lignes sont regroupés et renumérotés chronologiquement, rien
--      n'est perdu ;
--   4. laisse intactes les lignes déjà internationales et les
--      placeholders "migrated-…" créés par la migration 002.
--
-- ⚠️ AVANT D'EXÉCUTER : régler l'indicatif par défaut ci-dessous sur le
-- pays de la majorité des participants historiques. Un numéro national
-- ne contient aucune information sur son pays : ce choix ne peut pas
-- être deviné automatiquement. Les participants d'un autre pays devront
-- être corrigés à la main (voir la requête de contrôle en fin de
-- fichier).
--
-- À exécuter une seule fois, dans le SQL Editor de Supabase.

begin;

-- ---------------------------------------------------------------------
-- Indicatif par défaut appliqué aux numéros nationaux existants.
-- Modifier ici si la majorité des participants n'est pas en France.
-- ---------------------------------------------------------------------
create temporary table migration_settings on commit drop as
select '+33'::text as default_country_code;

-- ---------------------------------------------------------------------
-- 1) Normalisation : retire les séparateurs de saisie ("06 12 34 56 78"
--    -> "0612345678"), pour que la comparaison des numéros soit fiable.
--    Les placeholders "migrated-…" de la migration 002 sont exclus : le
--    tiret y fait partie de la valeur, il ne s'agit pas d'un séparateur.
-- ---------------------------------------------------------------------
update participants
set phone = regexp_replace(phone, '[\s.\-()]', '', 'g')
where phone is not null
  and phone not like 'migrated-%'
  and phone <> regexp_replace(phone, '[\s.\-()]', '', 'g');

-- ---------------------------------------------------------------------
-- 2) Calcul du numéro international cible pour chaque ligne à migrer.
--    Sont concernées les lignes qui ne commencent pas déjà par "+" et
--    qui ne sont pas des placeholders de la migration 002.
--    Le 0 initial des numéros nationaux est retiré : il ne s'utilise pas
--    derrière un indicatif international.
-- ---------------------------------------------------------------------
create temporary table phone_migration on commit drop as
select
  p.id,
  p.phone as old_phone,
  s.default_country_code || regexp_replace(p.phone, '^0+', '') as new_phone
from participants p
cross join migration_settings s
where p.phone is not null
  and p.phone <> ''
  and p.phone not like '+%'
  and p.phone not like 'migrated-%'
  -- uniquement des chiffres : on ne touche pas à une saisie exotique
  and p.phone ~ '^[0-9]+$';

-- ---------------------------------------------------------------------
-- 3) Fusion des doublons.
--    Cas : la personne a repassé le test depuis la V5, donc une seconde
--    ligne existe déjà avec le numéro international. On conserve cette
--    ligne (la plus récente, celle qui porte le genre saisi en V5) et on
--    y rattache les tests de l'ancienne ligne.
-- ---------------------------------------------------------------------
create temporary table phone_merges on commit drop as
select
  m.id       as old_id,      -- ligne au format national, à supprimer
  survivor.id as keep_id,    -- ligne au format international, à conserver
  m.new_phone
from phone_migration m
join participants survivor on survivor.phone = m.new_phone
where survivor.id <> m.id;

-- 3a) Calcule la numérotation cible : on réunit les tests des deux
--     lignes et on les ordonne chronologiquement, pour que
--     "Test passé : 1, 2, 3…" reste cohérent après fusion.
create temporary table attempt_renumber on commit drop as
select
  a.id,
  mg.keep_id,
  row_number() over (partition by mg.keep_id order by a.taken_at asc, a.id asc) as new_number
from attempts a
join phone_merges mg
  -- les tests de l'ancienne ligne ET ceux déjà présents chez le survivant
  on a.participant_id in (mg.old_id, mg.keep_id);

-- 3b) Applique la numérotation en deux passes, via des valeurs négatives
--     intermédiaires. L'index unique (participant_id, attempt_number) est
--     vérifié ligne par ligne : écrire directement les numéros définitifs
--     entrerait en collision avec ceux que le survivant porte encore.
--     Les négatifs sont uniques par participant (row_number), donc sûrs,
--     et ne peuvent croiser aucun numéro positif existant.
update attempts a
set participant_id = r.keep_id,
    attempt_number = -r.new_number
from attempt_renumber r
where a.id = r.id;

update attempts a
set attempt_number = -a.attempt_number
where a.attempt_number < 0;

-- 3c) Reporte sur le survivant la date de premier test la plus ancienne
--     et la date de dernier test la plus récente des deux lignes.
update participants p
set created_at = least(p.created_at, old.created_at),
    last_test_at = greatest(
      coalesce(p.last_test_at, old.last_test_at),
      coalesce(old.last_test_at, p.last_test_at)
    )
from phone_merges mg
join participants old on old.id = mg.old_id
where p.id = mg.keep_id;

-- 3d) Supprime l'ancienne ligne, désormais vidée de ses tests.
delete from participants
where id in (select old_id from phone_merges);

-- ---------------------------------------------------------------------
-- 4) Mise à jour simple des lignes restantes (aucun doublon) : on ajoute
--    simplement l'indicatif.
-- ---------------------------------------------------------------------
update participants p
set phone = m.new_phone
from phone_migration m
where p.id = m.id
  and p.id not in (select old_id from phone_merges);

commit;

-- ---------------------------------------------------------------------
-- CONTRÔLE APRÈS MIGRATION
--
-- Cette requête liste les numéros qui ne sont PAS au format
-- international : ils n'ont pas pu être migrés automatiquement
-- (placeholders de la migration 002, saisies contenant des lettres, etc.)
-- et méritent une vérification manuelle dans le Table Editor.
--
--   select id, first_name, last_name, phone, last_test_at
--   from participants
--   where phone not like '+%'
--   order by last_test_at desc nulls last;
--
-- Et pour repérer d'éventuels participants d'un autre pays à corriger à
-- la main (numéro préfixé par erreur avec l'indicatif par défaut) :
--
--   select id, first_name, last_name, phone, city, last_test_at
--   from participants
--   where phone like '+33%'
--   order by created_at desc;
-- ---------------------------------------------------------------------
