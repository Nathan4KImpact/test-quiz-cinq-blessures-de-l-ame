// Contrôle d'identité AVANT le test, à la validation du formulaire d'accueil.
//
// Sans lui, quiconque saisissait l'e-mail d'une autre personne repartait
// avec tout son suivi psychologique : /api/submit rattachait la passation
// au dossier trouvé et en renvoyait l'historique complet.
//
//   - aucun dossier sur cette adresse -> "new", le test peut commencer,
//     le dossier sera créé à l'envoi ;
//   - dossier trouvé, session déjà ouverte dessus -> "authenticated" ;
//   - dossier trouvé sans session -> "auth_required", l'écran de connexion
//     prend le relais (mot de passe, ou code e-mail pour qui n'en a pas).
//
// Le formulaire ne demande plus de mot de passe : une personne qui vient
// simplement passer le test n'a pas à s'inventer un compte. Ce contrôle ne
// fait donc plus que constater l'existence d'un dossier — il ne pose ni ne
// vérifie aucun secret, et n'ouvre jamais de session à lui seul.

const { supabaseRequest } = require("../_lib/supabase");
const { getParticipantId } = require("../_lib/auth");

function parseBody(req) {
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (e) {
      body = {};
    }
  }
  return body || {};
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Méthode non autorisée." });
    return;
  }

  const body = parseBody(req);
  const email = String(body.email || "").trim().toLowerCase();

  if (!email) {
    res.status(400).json({ error: "Adresse e-mail requise." });
    return;
  }

  try {
    // L'e-mail est la clé d'identité depuis la migration 006. Le téléphone
    // n'est plus consulté ici : plusieurs personnes d'un même foyer peuvent
    // partager un numéro sans que cela bloque qui que ce soit.
    const found = await supabaseRequest(
      `/participants?email=eq.${encodeURIComponent(email)}&select=id,password_hash`
    );
    const participant = found && found[0];

    if (!participant) {
      res.status(200).json({ status: "new" });
      return;
    }

    if (getParticipantId(req) === participant.id) {
      res.status(200).json({ status: "authenticated" });
      return;
    }

    // hasPassword oriente l'écran de connexion : avec un mot de passe on
    // propose la saisie directe, sans, on met en avant le code e-mail.
    res.status(200).json({
      status: "auth_required",
      hasPassword: !!participant.password_hash,
    });
  } catch (err) {
    console.error("auth/precheck error", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
};
