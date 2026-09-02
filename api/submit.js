const { supabaseRequest } = require("./_lib/supabase");
const { computeScores, isValidAnswers, describeAnswersProblem } = require("./_lib/scoring");
const { hashPassword, isValidPassword } = require("./_lib/password");

// Volontairement permissif : aligné sur la validation native du navigateur
// (input type="email"), qui n'exige pas de point dans le domaine. Un
// contrôle serveur plus strict que le contrôle client rejetterait à tort
// des emails que l'utilisateur a pourtant pu saisir et valider dans le
// formulaire.
function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+$/.test(email);
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
  const password = String((body && body.password) || "");

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
      // Dossier existant : on met à jour le profil, mais JAMAIS le mot de
      // passe, même si la requête en contient un. Cet endpoint est ouvert
      // et identifie par téléphone : accepter un mot de passe ici
      // permettrait à qui connaît un numéro de s'attribuer le dossier de
      // son titulaire, et d'en lire tout le suivi. Changer son mot de
      // passe passe obligatoirement par /api/auth/set-password, qui exige
      // une session prouvée par code e-mail.
      participantId = existing[0].id;
      await supabaseRequest(`/participants?id=eq.${participantId}`, {
        method: "PATCH",
        body: JSON.stringify({
          gender,
          first_name: firstName,
          last_name: lastName,
          email,
          city: city || null,
          postal_code: postalCode || null,
          last_test_at: now,
          reminder_sent_at: null,
        }),
      });
    } else {
      // Dossier neuf : la personne qui le crée en définit le mot de passe.
      const passwordFields = isValidPassword(password)
        ? { password_hash: await hashPassword(password), password_set_at: now }
        : {};
      const created = await supabaseRequest(`/participants`, {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          phone,
          gender,
          email,
          first_name: firstName,
          last_name: lastName,
          city: city || null,
          postal_code: postalCode || null,
          last_test_at: now,
          ...passwordFields,
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

    // Historique complet de cette personne, renvoyé avec le résultat pour
    // qu'elle puisse visualiser son évolution sur l'écran de résultats.
    // Volontairement retourné ici plutôt que via un endpoint interrogeable
    // par numéro : la personne vient de prouver qu'elle détient ce numéro
    // en passant le test, alors qu'un endpoint ouvert exposerait
    // l'historique de n'importe qui à partir d'un numéro deviné.
    let history = [];
    try {
      history = await supabaseRequest(
        `/attempts?participant_id=eq.${participantId}&select=attempt_number,taken_at,score_trahison,score_rejet,score_abandon,score_humiliation,score_injustice,dominant_wounds&order=attempt_number.asc`
      );
    } catch (historyErr) {
      // L'historique est un bonus : son échec ne doit pas faire échouer
      // l'enregistrement du test, déjà effectué à ce stade.
      console.error("submit history error", historyErr);
    }

    res.status(200).json({
      attemptNumber,
      scores: scaled,
      dominant,
      history: history || [],
    });
  } catch (err) {
    console.error("submit error", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
};
