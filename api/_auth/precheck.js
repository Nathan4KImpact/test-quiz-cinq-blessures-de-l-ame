// Contrôle d'identité AVANT le test, à la validation du formulaire d'accueil.
//
// Sans lui, quiconque saisissait le téléphone ou l'e-mail d'une autre
// personne repartait avec tout son suivi psychologique : /api/submit
// rattachait la passation au dossier trouvé et en renvoyait l'historique
// complet. Le formulaire demandant déjà un mot de passe, on s'en sert :
//
//   - aucun dossier sur ce téléphone ni cet e-mail  -> "new", le test peut
//     commencer, le dossier sera créé à l'envoi ;
//   - dossier trouvé et mot de passe correct        -> session ouverte,
//     "authenticated", le test peut commencer ;
//   - dossier trouvé et mot de passe faux ou absent -> "auth_required",
//     l'écran de connexion prend le relais (mot de passe ou code e-mail).
//
// Le mot de passe n'est jamais posé ni modifié ici : ce chemin ne sert qu'à
// prouver une identité, jamais à s'en attribuer une.

const { supabaseRequest } = require("../_lib/supabase");
const { createParticipantSessionCookie, getParticipantId } = require("../_lib/auth");
const { verifyPassword, hashPassword } = require("../_lib/password");

// Même parade que dans login.js : sans comparaison factice, un dossier
// inexistant répondrait sans le coût du scrypt et l'écart de durée
// révélerait qui a déjà passé le test.
let decoyHashPromise = null;
function decoyHash() {
  if (!decoyHashPromise) decoyHashPromise = hashPassword("mot-de-passe-factice-jamais-utilise");
  return decoyHashPromise;
}

// Doit rester identique à la normalisation de api/submit.js : c'est la
// même clé d'identité, un écart ouvrirait un contournement.
function normalizePhone(phone) {
  return (phone || "").replace(/[\s.\-()]/g, "");
}

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

// Un dossier peut être reconnu par son téléphone (clé d'identité) comme par
// son e-mail. L'e-mail compte aussi : laisser créer un second dossier sur
// l'adresse de quelqu'un rendrait la connexion ambiguë pour les deux, et
// login.js refuse alors les deux (voir migration 005).
async function findExisting(phone, email) {
  if (phone) {
    const byPhone = await supabaseRequest(
      `/participants?phone=eq.${encodeURIComponent(phone)}&select=id,password_hash`
    );
    if (byPhone && byPhone.length > 0) return byPhone[0];
  }
  if (email) {
    const byEmail = await supabaseRequest(
      `/participants?email=eq.${encodeURIComponent(email)}&select=id,password_hash`
    );
    if (byEmail && byEmail.length > 0) return byEmail[0];
  }
  return null;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Méthode non autorisée." });
    return;
  }

  const body = parseBody(req);
  const phone = normalizePhone(String(body.phone || ""));
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");

  if (!phone && !email) {
    res.status(400).json({ error: "Téléphone ou e-mail requis." });
    return;
  }

  try {
    const existing = await findExisting(phone, email);

    if (!existing) {
      // Coût de comparaison maintenu : « dossier inconnu » et « mot de
      // passe faux » doivent prendre le même temps.
      await verifyPassword(password, await decoyHash());
      res.status(200).json({ status: "new" });
      return;
    }

    // Déjà connecté sur ce dossier : inutile de redemander le mot de passe.
    if (getParticipantId(req) === existing.id) {
      res.status(200).json({ status: "authenticated" });
      return;
    }

    if (!existing.password_hash || !password) {
      await verifyPassword(password, await decoyHash());
      res.status(200).json({ status: "auth_required", hasPassword: !!existing.password_hash });
      return;
    }

    const ok = await verifyPassword(password, existing.password_hash);
    if (!ok) {
      res.status(200).json({ status: "auth_required", hasPassword: true });
      return;
    }

    res.setHeader("Set-Cookie", createParticipantSessionCookie(existing.id));
    res.status(200).json({ status: "authenticated" });
  } catch (err) {
    console.error("auth/precheck error", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
};
