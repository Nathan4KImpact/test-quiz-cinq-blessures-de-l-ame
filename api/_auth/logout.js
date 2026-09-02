// Déconnexion du participant : efface le cookie de session.

const { clearParticipantSessionCookie } = require("../_lib/auth");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Méthode non autorisée." });
    return;
  }
  res.setHeader("Set-Cookie", clearParticipantSessionCookie());
  res.status(200).json({ ok: true });
};
