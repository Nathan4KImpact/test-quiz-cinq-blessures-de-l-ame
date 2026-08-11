const { supabaseRequest } = require("./_lib/supabase");
const { computeScores, isValidAnswers } = require("./_lib/scoring");

function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function parseBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch (e) {
      return null;
    }
  }
  return null;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Méthode non autorisée." });
    return;
  }

  const body = parseBody(req);

  const firstName = ((body && body.firstName) || "").trim();
  const lastName = ((body && body.lastName) || "").trim();
  const email = ((body && body.email) || "").trim().toLowerCase();
  const phone = ((body && body.phone) || "").trim();
  const city = ((body && body.city) || "").trim();
  const postalCode = ((body && body.postalCode) || "").trim();
  const answers = body && body.answers;
  const consent = body && body.consent === true;

  if (!firstName || !lastName || !isValidEmail(email) || !consent || !isValidAnswers(answers)) {
    res.status(400).json({ error: "Données invalides." });
    return;
  }

  try {
    const now = new Date().toISOString();

    const existing = await supabaseRequest(
      `/participants?email=eq.${encodeURIComponent(email)}&select=id`
    );

    let participantId;
    if (existing && existing.length > 0) {
      participantId = existing[0].id;
      await supabaseRequest(`/participants?id=eq.${participantId}`, {
        method: "PATCH",
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          phone: phone || null,
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
          email,
          first_name: firstName,
          last_name: lastName,
          phone: phone || null,
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
