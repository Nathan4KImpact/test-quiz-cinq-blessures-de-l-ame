const { isAuthorized } = require("../_lib/auth");
const { supabaseRequest } = require("../_lib/supabase");

module.exports = async (req, res) => {
  if (!isAuthorized(req)) {
    res.status(401).json({ error: "Non authentifié." });
    return;
  }

  const id = req.query && req.query.id;
  if (!id) {
    res.status(400).json({ error: "Paramètre id manquant." });
    return;
  }

  try {
    const participants = await supabaseRequest(`/participants?id=eq.${id}&select=*`);
    if (!participants || participants.length === 0) {
      res.status(404).json({ error: "Participant introuvable." });
      return;
    }

    const attempts = await supabaseRequest(
      `/attempts?participant_id=eq.${id}&select=attempt_number,taken_at,score_trahison,score_rejet,score_abandon,score_humiliation,score_injustice,dominant_wounds&order=attempt_number.asc`
    );

    res.status(200).json({ participant: participants[0], attempts: attempts || [] });
  } catch (err) {
    console.error("admin/participant error", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
};
