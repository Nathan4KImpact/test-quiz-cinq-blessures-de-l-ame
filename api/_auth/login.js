// Connexion par e-mail + mot de passe : le chemin principal.
//
// Toutes les causes d'échec (adresse inconnue, aucun mot de passe encore
// défini, mot de passe faux) renvoient le même message et prennent un
// temps comparable. Distinguer les cas — par le texte ou par la durée —
// permettrait de savoir qui a passé le test.

const { supabaseRequest } = require("../_lib/supabase");
const { createParticipantSessionCookie } = require("../_lib/auth");
const { verifyPassword, hashPassword } = require("../_lib/password");

// Empreinte de comparaison factice, calculée une fois par instance. Sans
// elle, une adresse inconnue répondrait sans le coût du scrypt : l'écart
// de durée suffirait à distinguer « inconnue » de « mot de passe faux ».
let decoyHashPromise = null;
function decoyHash() {
  if (!decoyHashPromise) decoyHashPromise = hashPassword("mot-de-passe-factice-jamais-utilise");
  return decoyHashPromise;
}

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
  const password = String((body && body.password) || "");

  const reject = () =>
    res.status(401).json({ error: "E-mail ou mot de passe incorrect." });

  if (!email || !password) {
    await verifyPassword(password, await decoyHash());
    reject();
    return;
  }

  try {
    const found = await supabaseRequest(
      `/participants?email=eq.${encodeURIComponent(email)}&select=id,password_hash`
    );

    // Deux dossiers sur la même adresse rendraient l'identification
    // ambiguë : on refuse plutôt que d'en choisir un au hasard. La
    // requête de détection est documentée dans la migration 005.
    if (found && found.length > 1) {
      console.error(
        `auth/login: ${found.length} dossiers partagent l'adresse ${email}. ` +
          "Fusionner ou corriger les doublons pour rétablir la connexion."
      );
      await verifyPassword(password, await decoyHash());
      reject();
      return;
    }

    const participant = found && found[0];
    if (!participant || !participant.password_hash) {
      await verifyPassword(password, await decoyHash());
      reject();
      return;
    }

    const ok = await verifyPassword(password, participant.password_hash);
    if (!ok) {
      reject();
      return;
    }

    res.setHeader("Set-Cookie", createParticipantSessionCookie(participant.id));
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("auth/login error", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
};
