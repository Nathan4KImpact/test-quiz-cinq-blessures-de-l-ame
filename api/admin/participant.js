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

  if (req.method === "DELETE") {
    try {
      // La FK attempts.participant_id est en ON DELETE CASCADE, les
      // passations partent avec le participant en une seule requête.
      await supabaseRequest(`/participants?id=eq.${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      res.status(200).json({ ok: true });
    } catch (err) {
      console.error("admin/participant DELETE error", err);
      res.status(500).json({ error: "Erreur serveur." });
    }
    return;
  }

  try {
    const participants = await supabaseRequest(`/participants?id=eq.${encodeURIComponent(id)}&select=*`);
    if (!participants || participants.length === 0) {
      res.status(404).json({ error: "Participant introuvable." });
      return;
    }

    const attempts = await supabaseRequest(
      `/attempts?participant_id=eq.${encodeURIComponent(id)}&select=id,attempt_number,taken_at,score_trahison,score_rejet,score_abandon,score_humiliation,score_injustice,dominant_wounds&order=attempt_number.asc`
    );

    res.status(200).json({ participant: participants[0], attempts: attempts || [] });
  } catch (err) {
    console.error("admin/participant error", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
};
