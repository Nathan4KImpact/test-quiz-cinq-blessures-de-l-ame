// Définition ou changement du mot de passe.
//
// Exige une session participant déjà ouverte. Cette session ne s'obtient
// que par un code reçu par e-mail (ou par un mot de passe déjà connu) :
// c'est donc toujours une preuve de possession de la boîte mail qui
// autorise l'opération. Un même endpoint couvre ainsi les trois cas —
// premier mot de passe d'un dossier ancien, mot de passe oublié, et
// simple changement depuis l'espace personnel.

const { supabaseRequest } = require("../_lib/supabase");
const { getParticipantId } = require("../_lib/auth");
const { hashPassword, isValidPassword, MIN_LENGTH } = require("../_lib/password");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Méthode non autorisée." });
    return;
  }

  const participantId = getParticipantId(req);
  if (!participantId) {
    res.status(401).json({ error: "Non authentifié." });
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
  const password = String((body && body.password) || "");

  if (!isValidPassword(password)) {
    res.status(400).json({
      error: `Le mot de passe doit contenir au moins ${MIN_LENGTH} caractères.`,
    });
    return;
  }

  try {
    await supabaseRequest(`/participants?id=eq.${participantId}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        password_hash: await hashPassword(password),
        password_set_at: new Date().toISOString(),
      }),
    });
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("auth/set-password error", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
};
