const { isAuthorized } = require("../_lib/auth");
const { supabaseRequest } = require("../_lib/supabase");

module.exports = async (req, res) => {
  if (!isAuthorized(req)) {
    res.status(401).json({ error: "Non authentifié." });
    return;
  }

  try {
    const participants = await supabaseRequest(
      `/participants?select=id,email,first_name,last_name,phone,city,postal_code,created_at,last_test_at&order=last_test_at.desc.nullslast`
    );

    const attempts = await supabaseRequest(
      `/attempts?select=participant_id,attempt_number,taken_at,score_trahison,score_rejet,score_abandon,score_humiliation,score_injustice,dominant_wounds&order=taken_at.desc`
    );

    const latestByParticipant = new Map();
    const countByParticipant = new Map();
    (attempts || []).forEach((a) => {
      countByParticipant.set(a.participant_id, (countByParticipant.get(a.participant_id) || 0) + 1);
      if (!latestByParticipant.has(a.participant_id)) {
        latestByParticipant.set(a.participant_id, a);
      }
    });

    const result = (participants || []).map((p) => ({
      ...p,
      attemptsCount: countByParticipant.get(p.id) || 0,
      latestAttempt: latestByParticipant.get(p.id) || null,
    }));

    res.status(200).json({ participants: result });
  } catch (err) {
    console.error("admin/participants error", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
};
