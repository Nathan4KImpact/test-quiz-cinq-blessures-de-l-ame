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

function normalizePhone(phone) {
  return (phone || "").replace(/[\s.\-()]/g, "");
}

function coerceGender(g) {
  const v = (g || "").toLowerCase().trim();
  if (v === "homme" || v === "h" || v === "m" || v === "male") return "homme";
  if (v === "femme" || v === "f" || v === "female") return "femme";
  return null;
}

function orNull(v) {
  const s = (v || "").trim();
  return s === "" ? null : s;
}

function orIsoOrNull(v) {
  const s = (v || "").trim();
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
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

  try {
    const raw =
      typeof req.body === "string" && req.body.length > 0
        ? req.body
        : await readRawBody(req);

    const rows = parseCSVToObjects(raw || "");
    if (rows.length === 0) {
      res.status(400).json({ error: "Fichier vide ou illisible." });
      return;
    }

    const errors = [];
    let created = 0;
    let updated = 0;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const lineNo = i + 2; // +1 header, +1 pour 1-indexed
      const phone = normalizePhone(r.phone);
      const firstName = (r.first_name || "").trim();
      const lastName = (r.last_name || "").trim();
      const email = (r.email || "").trim().toLowerCase();
      const gender = coerceGender(r.gender);

      if (!phone || !firstName || !lastName || !email) {
        errors.push(`Ligne ${lineNo} : phone / first_name / last_name / email requis.`);
        continue;
      }

      const payload = {
        phone,
        email,
        gender,
        first_name: firstName,
        last_name: lastName,
        city: orNull(r.city),
        postal_code: orNull(r.postal_code),
      };
      const createdAt = orIsoOrNull(r.created_at);
      if (createdAt) payload.created_at = createdAt;
      const lastTestAt = orIsoOrNull(r.last_test_at);
      if (lastTestAt) payload.last_test_at = lastTestAt;

      try {
        const existing = await supabaseRequest(
          `/participants?phone=eq.${encodeURIComponent(phone)}&select=id`
        );
        if (existing && existing.length > 0) {
          await supabaseRequest(`/participants?id=eq.${existing[0].id}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          });
          updated++;
        } else {
          await supabaseRequest(`/participants`, {
            method: "POST",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify(payload),
          });
          created++;
        }
      } catch (err) {
        errors.push(`Ligne ${lineNo} : ${err.message || "échec insertion"}.`);
      }
    }

    res.status(200).json({ created, updated, errors });
  } catch (err) {
    console.error("admin/import error", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
};
