-- Test des 5 blessures de l'âme — jeu de DÉMONSTRATION
--
-- Données FICTIVES, destinées à voir fonctionner le suivi d'évolution,
-- l'historique des tests et le bandeau de félicitations sans avoir à
-- repasser le test cinq fois à la main.
--
-- À exécuter dans Supabase : SQL Editor → New query → coller → Run.
-- Ré-exécutable sans risque : le script commence par effacer sa propre
-- démo (et elle seule) avant de la réinsérer.
--
-- POUR TOUT SUPPRIMER quand la démo a fait son office :
--   delete from participants where phone like '+3399000000%';
-- La suppression en cascade emporte les passations associées.
--
-- Les numéros +3399000000x sont réservés à cette démo : aucun vrai
-- participant ne peut les porter, la démo ne se mélange donc jamais aux
-- données réelles.

begin;

delete from participants where phone like '+3399000000%';

-- ---------- Marie Dupont (démo) : 5 tests ----------
with p as (
  insert into participants
    (phone, email, gender, first_name, last_name, city, postal_code, created_at, last_test_at)
  values
    ('+33990000001', 'marie.demo@example.com', 'femme', 'Marie', 'Dupont (démo)', 'Lyon', '69000',
     now() - interval '24 months', now() - interval '14 days')
  returning id
)
insert into attempts
  (participant_id, attempt_number, taken_at,
   score_trahison, score_rejet, score_abandon, score_humiliation, score_injustice,
   dominant_wounds, answers)
select p.id, v.attempt_number, now() - v.ago,
       v.st, v.sr, v.sa, v.sh, v.si, v.dominant, v.answers
from p, (values
  (1, interval '24 months', 42, 33, 25, 20, 28, array['trahison']::text[], '[2,2,2,2,2,3,3,3,3,3,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,1,1,2,2,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,1,1,1]'::jsonb),
  (2, interval '18 months', 38, 32, 25, 20, 27, array['trahison']::text[], '[2,2,2,2,2,2,2,3,3,3,2,2,2,2,2,2,2,2,2,1,2,2,2,2,2,1,1,1,1,1,2,2,1,1,1,1,1,1,1,1,2,2,2,2,2,2,1,1,1,1]'::jsonb),
  (3, interval '12 months', 33, 30, 23, 20, 25, array['trahison']::text[], '[2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,2,2,2,2,1,1,1,1,1,1,2,2,1,1,1,1,1,1,1,1,2,2,2,2,2,1,1,1,1,1]'::jsonb),
  (4, interval '6 months', 28, 28, 22, 18, 23, array['trahison', 'rejet']::text[], '[2,2,2,2,2,2,2,1,1,1,2,2,2,2,2,2,2,1,1,1,2,2,2,1,1,1,1,1,1,1,2,1,1,1,1,1,1,1,1,1,2,2,2,2,1,1,1,1,1,1]'::jsonb),
  (5, interval '14 days', 22, 25, 18, 17, 20, array['rejet']::text[], '[2,2,2,1,1,1,1,1,1,1,2,2,2,2,2,1,1,1,1,1,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,1,1,1,1,1,1,1,1]'::jsonb)
) as v(attempt_number, ago, st, sr, sa, sh, si, dominant, answers);

-- ---------- Jean Martin (démo) : 2 tests ----------
with p as (
  insert into participants
    (phone, email, gender, first_name, last_name, city, postal_code, created_at, last_test_at)
  values
    ('+33990000002', 'jean.demo@example.com', 'homme', 'Jean', 'Martin (démo)', 'Paris', '75001',
     now() - interval '8 months', now() - interval '1 month')
  returning id
)
insert into attempts
  (participant_id, attempt_number, taken_at,
   score_trahison, score_rejet, score_abandon, score_humiliation, score_injustice,
   dominant_wounds, answers)
select p.id, v.attempt_number, now() - v.ago,
       v.st, v.sr, v.sa, v.sh, v.si, v.dominant, v.answers
from p, (values
  (1, interval '8 months', 30, 45, 25, 33, 42, array['rejet']::text[], '[2,2,2,2,2,2,2,2,1,1,2,2,2,3,3,3,3,3,3,3,2,2,2,2,2,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,3,3,3,3,3]'::jsonb),
  (2, interval '1 month', 28, 38, 23, 30, 40, array['injustice']::text[], '[2,2,2,2,2,2,2,1,1,1,2,2,2,2,2,2,2,3,3,3,2,2,2,2,1,1,1,1,1,1,2,2,2,2,2,2,2,2,1,1,2,2,2,2,2,2,3,3,3,3]'::jsonb)
) as v(attempt_number, ago, st, sr, sa, sh, si, dominant, answers);

-- ---------- Awa Traoré (démo) : 1 test ----------
with p as (
  insert into participants
    (phone, email, gender, first_name, last_name, city, postal_code, created_at, last_test_at)
  values
    ('+33990000003', 'awa.demo@example.com', 'femme', 'Awa', 'Traoré (démo)', 'Marseille', '13001',
     now() - interval '3 months', now() - interval '3 months')
  returning id
)
insert into attempts
  (participant_id, attempt_number, taken_at,
   score_trahison, score_rejet, score_abandon, score_humiliation, score_injustice,
   dominant_wounds, answers)
select p.id, v.attempt_number, now() - v.ago,
       v.st, v.sr, v.sa, v.sh, v.si, v.dominant, v.answers
from p, (values
  (1, interval '3 months', 20, 25, 40, 32, 22, array['abandon']::text[], '[2,2,1,1,1,1,1,1,1,1,2,2,2,2,2,1,1,1,1,1,2,2,2,2,2,2,3,3,3,3,2,2,2,2,2,2,2,2,2,1,2,2,2,1,1,1,1,1,1,1]'::jsonb)
) as v(attempt_number, ago, st, sr, sa, sh, si, dominant, answers);

commit;

-- Vérification rapide : 3 participants, 8 passations.
-- select p.first_name, p.last_name, count(a.*) as tests
-- from participants p join attempts a on a.participant_id = p.id
-- where p.phone like '+3399000000%'
-- group by 1, 2 order by 1;
