const { supabaseRequest } = require("./_lib/supabase");
const { computeScores, isValidAnswers, describeAnswersProblem } = require("./_lib/scoring");

// Volontairement permissif : aligné sur la validation native du navigateur
// (input type="email"), qui n'exige pas de point dans le domaine. Un
// contrôle serveur plus strict que le contrôle client rejetterait à tort
// des emails que l'utilisateur a pourtant pu saisir et valider dans le
// formulaire. L'email est désormais facultatif : une chaîne vide est
// toujours valide.
function isValidEmail(email) {
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+$/.test(email);
}

// Le téléphone est l'identifiant stable du participant : on normalise en
// retirant espaces/points/tirets/parenthèses pour que "06 12 34 56 78" et
// "0612345678" désignent la même personne.
function normalizePhone(phone) {
  return (phone || "").replace(/[\s.\-()]/g, "");
}

function isValidGender(gender) {
  return gender === "homme" || gender === "femme";
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

async function parseBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  if (typeof req.body === "string" && req.body.length > 0) {
    try {
      return JSON.parse(req.body);
    } catch (e) {
      return null;
    }
  }
  // Filet de sécurité : si le corps n'a pas été pré-parsé par le runtime
  // (ex. Content-Type inattendu), on le lit nous-mêmes depuis le flux,
  // avec un délai de sécurité pour ne jamais bloquer la fonction.
  try {
    const raw = await Promise.race([
      readRawBody(req),
      new Promise((resolve) => setTimeout(() => resolve(null), 4000)),
    ]);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Méthode non autorisée." });
    return;
  }

  const body = await parseBody(req);

  const gender = (body && body.gender) || "";
  const firstName = ((body && body.firstName) || "").trim();
  const lastName = ((body && body.lastName) || "").trim();
  const email = ((body && body.email) || "").trim().toLowerCase();
  const phone = normalizePhone((body && body.phone) || "");
  const city = ((body && body.city) || "").trim();
  const postalCode = ((body && body.postalCode) || "").trim();
  const answers = body && body.answers;
  const consent = body && body.consent === true;

  const validationErrors = [];
  if (!body) validationErrors.push("corps de requête vide ou illisible");
  if (!isValidGender(gender)) validationErrors.push("genre manquant ou invalide");
  if (!firstName) validationErrors.push("prénom manquant");
  if (!lastName) validationErrors.push("nom manquant");
  if (!phone) validationErrors.push("téléphone manquant");
  if (!isValidEmail(email)) validationErrors.push("email invalide");
  if (!consent) validationErrors.push("consentement manquant");
  if (!isValidAnswers(answers)) {
    validationErrors.push(`réponses invalides : ${describeAnswersProblem(answers)}`);
  }

  if (validationErrors.length > 0) {
    console.error("submit validation failed", {
      contentType: req.headers["content-type"],
      bodyType: typeof req.body,
      errors: validationErrors,
    });
    res.status(400).json({ error: "Données invalides.", details: validationErrors });
    return;
  }

  try {
    const now = new Date().toISOString();

    const existing = await supabaseRequest(
      `/participants?phone=eq.${encodeURIComponent(phone)}&select=id`
    );

    let participantId;
    if (existing && existing.length > 0) {
      participantId = existing[0].id;
      await supabaseRequest(`/participants?id=eq.${participantId}`, {
        method: "PATCH",
        body: JSON.stringify({
          gender,
          first_name: firstName,
          last_name: lastName,
          email: email || null,
          city: city || null,
          postal_code: postalCode || null,
          last_test_at: now,
          reminder_sent_at: null,
        }),
      });
    } else {
      const created = await supabaseRequest(`/participants`, {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          phone,
          gender,
          email: email || null,
          first_name: firstName,
          last_name: lastName,
          city: city || null,
          postal_code: postalCode || null,
          last_test_at: now,
        }),
      });
      participantId = created[0].id;
    }

    const previousAttempts = await supabaseRequest(
      `/attempts?participant_id=eq.${participantId}&select=attempt_number&order=attempt_number.desc&limit=1`
    );
    const attemptNumber =
      previousAttempts && previousAttempts.length > 0 ? previousAttempts[0].attempt_number + 1 : 1;

    const { scaled, dominant } = computeScores(answers);

    await supabaseRequest(`/attempts`, {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        participant_id: participantId,
        attempt_number: attemptNumber,
        score_trahison: scaled.trahison,
        score_rejet: scaled.rejet,
        score_abandon: scaled.abandon,
        score_humiliation: scaled.humiliation,
        score_injustice: scaled.injustice,
        dominant_wounds: dominant,
        answers,
      }),
    });

    res.status(200).json({ attemptNumber, scores: scaled, dominant });
  } catch (err) {
    console.error("submit error", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
};
