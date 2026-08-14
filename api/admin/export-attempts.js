const { isAuthorized } = require("../_lib/auth");
const { supabaseRequest } = require("../_lib/supabase");
const { toCSV } = require("../_lib/csv");

const ATTEMPT_COLUMNS = [
  "attempt_number",
  "taken_at",
  "score_trahison",
  "score_rejet",
  "score_abandon",
  "score_humiliation",
  "score_injustice",
  "dominant_wounds",
  "answers",
];

module.exports = async (req, res) => {
  if (!isAuthorized(req)) {
    res.status(401).json({ error: "Non authentifié." });
    return;
  }

  const participantId = req.query && req.query.participantId;
  if (!participantId) {
    res.status(400).json({ error: "Paramètre participantId manquant." });
    return;
  }

  try {
    const participants = await supabaseRequest(
      `/participants?id=eq.${encodeURIComponent(participantId)}&select=phone,first_name,last_name`
    );
    if (!participants || participants.length === 0) {
      res.status(404).json({ error: "Participant introuvable." });
      return;
    }

    const attempts = await supabaseRequest(
      `/attempts?participant_id=eq.${encodeURIComponent(participantId)}&select=${ATTEMPT_COLUMNS.join(",")}&order=attempt_number.asc`
    );

    // dominant_wounds est un array Postgres, answers un jsonb : on les
    // sérialise en JSON string pour rester compatible CSV.
    const rows = (attempts || []).map((a) => ({
      ...a,
      dominant_wounds: JSON.stringify(a.dominant_wounds || []),
      answers: JSON.stringify(a.answers || []),
    }));

    const csv = toCSV(rows, ATTEMPT_COLUMNS);
    const safeName = `${participants[0].last_name}-${participants[0].first_name}`
      .replace(/[^a-zA-Z0-9-_]/g, "_")
      .toLowerCase();
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="tests-${safeName}.csv"`
    );
    res.status(200).send(csv);
  } catch (err) {
    console.error("admin/export-attempts error", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
};
