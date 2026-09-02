// Vérification du code reçu par e-mail : ouvre la session participant.
//
// Toutes les causes d'échec (adresse inconnue, code faux, code expiré,
// code déjà utilisé, trop d'essais) renvoient le MÊME message. Distinguer
// « adresse inconnue » de « code faux » indiquerait à un tiers quelles
// adresses ont passé le test.

const { supabaseRequest } = require("../_lib/supabase");
const {
  hashLoginCode,
  createParticipantSessionCookie,
  timingSafeEqualStr,
} = require("../_lib/auth");

// Un code à 6 chiffres ne résiste pas à un nombre d'essais illimité :
// au-delà, il est brûlé et il faut en demander un nouveau.
const MAX_ATTEMPTS = 5;

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Méthode non autorisée." });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (e) {
      body = {};
    }
  }
  const email = String((body && body.email) || "").trim().toLowerCase();
  const code = String((body && body.code) || "").replace(/\D/g, "");

  const reject = () =>
    res.status(401).json({ error: "Code incorrect ou expiré. Demande un nouveau code." });

  if (!email || code.length !== 6) {
    reject();
    return;
  }

  try {
    const found = await supabaseRequest(
      `/participants?email=eq.${encodeURIComponent(email)}` +
        `&select=id,first_name,last_name,gender,email,phone,city,postal_code&limit=1`
    );
    const participant = found && found[0];
    if (!participant) {
      reject();
      return;
    }

    // Le dernier code émis, encore valide et jamais consommé.
    const nowIso = new Date().toISOString();
    const codes = await supabaseRequest(
      `/participant_login_codes?participant_id=eq.${participant.id}` +
        `&consumed_at=is.null&expires_at=gte.${encodeURIComponent(nowIso)}` +
        `&select=id,code_hash,attempts&order=created_at.desc&limit=1`
    );
    const record = codes && codes[0];
    if (!record || record.attempts >= MAX_ATTEMPTS) {
      reject();
      return;
    }

    const matches = timingSafeEqualStr(record.code_hash, hashLoginCode(code, participant.id));
    if (!matches) {
      await supabaseRequest(`/participant_login_codes?id=eq.${record.id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ attempts: record.attempts + 1 }),
      });
      reject();
      return;
    }

    // Usage unique : le code est consommé avant même de répondre.
    await supabaseRequest(`/participant_login_codes?id=eq.${record.id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ consumed_at: new Date().toISOString() }),
    });

    res.setHeader("Set-Cookie", createParticipantSessionCookie(participant.id));
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("auth/verify-code error", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
};
