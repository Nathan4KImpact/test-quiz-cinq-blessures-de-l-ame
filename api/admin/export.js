const { isAuthorized } = require("../_lib/auth");
const { supabaseRequest } = require("../_lib/supabase");
const { toCSV } = require("../_lib/csv");

const PARTICIPANT_COLUMNS = [
  "id",
  "phone",
  "email",
  "gender",
  "first_name",
  "last_name",
  "city",
  "postal_code",
  "created_at",
  "last_test_at",
];

module.exports = async (req, res) => {
  if (!isAuthorized(req)) {
    res.status(401).json({ error: "Non authentifié." });
    return;
  }

  try {
    const participants = await supabaseRequest(
      `/participants?select=${PARTICIPANT_COLUMNS.join(",")}&order=last_test_at.desc.nullslast`
    );

    const csv = toCSV(participants || [], PARTICIPANT_COLUMNS);
    const today = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="participants-${today}.csv"`
    );
    res.status(200).send(csv);
  } catch (err) {
    console.error("admin/export error", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
};
