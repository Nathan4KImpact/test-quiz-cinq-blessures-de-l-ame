const { isAuthorized } = require("../_lib/auth");
const { supabaseRequest } = require("../_lib/supabase");
const { parseCSVToObjects } = require("../_lib/csv");

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function toInt(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function toIsoOrNow(v) {
  const s = (v || "").trim();
  if (!s) return new Date().toISOString();
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function parseJsonArray(v) {
  const s = (v || "").trim();
  if (!s) return null;
  try {
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? parsed : null;
  } catch (e) {
    return null;
  }
}

module.exports = async (req, res) => {
  if (!isAuthorized(req)) {
    res.status(401).json({ error: "Non authentifié." });
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Méthode non autorisée." });
    return;
  }

  const participantId = req.query && req.query.participantId;
  if (!participantId) {
    res.status(400).json({ error: "Paramètre participantId manquant." });
    return;
  }

  try {
    const existing = await supabaseRequest(
      `/participants?id=eq.${encodeURIComponent(participantId)}&select=id`
    );
    if (!existing || existing.length === 0) {
      res.status(404).json({ error: "Participant introuvable." });
      return;
    }

    const raw =
      typeof req.body === "string" && req.body.length > 0
        ? req.body
        : await readRawBody(req);

    const rows = parseCSVToObjects(raw || "");
    if (rows.length === 0) {
      res.status(400).json({ error: "Fichier vide ou illisible." });
      return;
    }

    // On repart du plus grand attempt_number existant pour éviter tout
    // conflit avec l'index unique (participant_id, attempt_number).
    const latest = await supabaseRequest(
      `/attempts?participant_id=eq.${encodeURIComponent(participantId)}&select=attempt_number&order=attempt_number.desc&limit=1`
    );
    let nextNumber = latest && latest.length > 0 ? latest[0].attempt_number + 1 : 1;

    const errors = [];
    let inserted = 0;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const lineNo = i + 2;

      const scores = {
        score_trahison: toInt(r.score_trahison),
        score_rejet: toInt(r.score_rejet),
        score_abandon: toInt(r.score_abandon),
        score_humiliation: toInt(r.score_humiliation),
        score_injustice: toInt(r.score_injustice),
      };
      const missing = Object.entries(scores).filter(([, v]) => v === null);
      if (missing.length > 0) {
        errors.push(`Ligne ${lineNo} : score manquant/invalide (${missing.map(([k]) => k).join(", ")}).`);
        continue;
      }

      const dominant = parseJsonArray(r.dominant_wounds);
      if (!dominant) {
        errors.push(`Ligne ${lineNo} : dominant_wounds attendu comme JSON array (ex. ["rejet"]).`);
        continue;
      }
      const answers = parseJsonArray(r.answers);
      if (!answers) {
        errors.push(`Ligne ${lineNo} : answers attendu comme JSON array de 50 nombres.`);
        continue;
      }

      const attemptNumber = toInt(r.attempt_number) || nextNumber;
      nextNumber = Math.max(nextNumber, attemptNumber + 1);

      try {
        await supabaseRequest(`/attempts`, {
          method: "POST",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            participant_id: participantId,
            attempt_number: attemptNumber,
            taken_at: toIsoOrNow(r.taken_at),
            ...scores,
            dominant_wounds: dominant,
            answers,
          }),
        });
        inserted++;
      } catch (err) {
        errors.push(`Ligne ${lineNo} : ${err.message || "échec insertion"}.`);
      }
    }

    // Met à jour last_test_at à la date la plus récente des passations
    // du participant, pour rester cohérent avec les tris du dashboard.
    try {
      const all = await supabaseRequest(
        `/attempts?participant_id=eq.${encodeURIComponent(participantId)}&select=taken_at&order=taken_at.desc&limit=1`
      );
      if (all && all.length > 0) {
        await supabaseRequest(`/participants?id=eq.${encodeURIComponent(participantId)}`, {
          method: "PATCH",
          body: JSON.stringify({ last_test_at: all[0].taken_at }),
        });
      }
    } catch (e) {
      // non bloquant
    }

    res.status(200).json({ inserted, errors });
  } catch (err) {
    console.error("admin/import-attempts error", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
};
