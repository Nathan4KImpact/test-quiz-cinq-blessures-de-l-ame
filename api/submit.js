const { supabaseRequest } = require("./_lib/supabase");
const { computeScores, isValidAnswers, describeAnswersProblem } = require("./_lib/scoring");
const { createParticipantSessionCookie, getParticipantId } = require("./_lib/auth");

// Volontairement permissif : aligné sur la validation native du navigateur
// (input type="email"), qui n'exige pas de point dans le domaine. Un
// contrôle serveur plus strict que le contrôle client rejetterait à tort
// des emails que l'utilisateur a pourtant pu saisir et valider dans le
// formulaire.
function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+$/.test(email);
}

// Le téléphone n'identifie plus un dossier (migration 006) mais reste
// stocké sous une forme stable : on retire espaces, points, tirets et
// parenthèses pour que « 06 12 34 56 78 » et « 0612345678 » se présentent
// de la même façon dans le tableau de bord.
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

// Met à jour le profil et remet à zéro les compteurs de rappel. Au pire
// effort : la passation est déjà enregistrée à ce stade, et une écriture
// de confort ne doit pas la faire échouer.
//
// Le repli sans les colonnes de rappel couvre une base où la migration 006
// n'a pas été jouée : PostgREST rejette alors toute la requête pour une
// colonne inconnue. Plutôt que de perdre aussi la mise à jour du profil,
// on réessaie sans elles — et on le dit très fort dans les logs.
async function majProfil(participantId, champs) {
  const avecRappels = {
    ...champs,
    reminder_sent_at: null,
    reminder_1m_sent_at: null,
  };
  try {
    await supabaseRequest(`/participants?id=eq.${participantId}`, {
      method: "PATCH",
      body: JSON.stringify(avecRappels),
    });
    return;
  } catch (err) {
    console.error("submit: mise à jour du profil refusée", err);
  }

  try {
    await supabaseRequest(`/participants?id=eq.${participantId}`, {
      method: "PATCH",
      body: JSON.stringify(champs),
    });
    console.error(
      "submit: profil mis à jour SANS les compteurs de rappel. " +
        "La migration 006 n'a probablement pas été exécutée sur cette base " +
        "(colonne reminder_1m_sent_at). Les relances resteront incohérentes " +
        "tant qu'elle ne l'est pas."
    );
  } catch (err) {
    console.error("submit: profil non mis à jour, la passation est tout de même enregistrée", err);
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

    // L'e-mail est la clé d'identité depuis la migration 006. Le téléphone
    // reste collecté et obligatoire, mais n'identifie plus un dossier :
    // plusieurs personnes d'un même foyer peuvent donner le même numéro.
    const existing = await supabaseRequest(
      `/participants?email=eq.${encodeURIComponent(email)}&select=id`
    );

    // Le contrôle décisif : rattacher une passation à un dossier existant
    // — et en recevoir l'historique — exige d'avoir prouvé qu'on en est le
    // titulaire. Sans lui, saisir l'e-mail d'une autre personne suffisait à
    // lire tout son suivi psychologique. Le contrôle équivalent côté
    // navigateur (/api/auth/precheck, à la validation du formulaire) n'est
    // qu'un confort : une requête forgée l'ignore, celui-ci ne se contourne
    // pas.
    if (existing && existing.length > 0 && getParticipantId(req) !== existing[0].id) {
      res.status(403).json({
        error: "Un dossier existe déjà pour cette adresse e-mail. Connexion requise.",
        requiresAuth: true,
      });
      return;
    }

    let participantId;
    const dossierExistant = !!(existing && existing.length > 0);
    if (dossierExistant) {
      participantId = existing[0].id;
    } else {
      // Dossier neuf. Aucun mot de passe n'est demandé au formulaire : une
      // personne qui vient simplement passer le test n'a pas à s'inventer
      // un compte. Elle en définira un depuis son espace, par le code reçu
      // par e-mail, le jour où elle voudra consulter son suivi.
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
        }),
      });
      participantId = created[0].id;
      // Le dossier vient d'être créé par cette personne : elle en est la
      // titulaire, on ouvre sa session tout de suite. Sans cela, repasser
      // le test dans la foulée buterait sur le contrôle ci-dessus.
      res.setHeader("Set-Cookie", createParticipantSessionCookie(participantId));
    }

    const previousAttempts = await supabaseRequest(
      `/attempts?participant_id=eq.${participantId}&select=attempt_number&order=attempt_number.desc&limit=1`
    );
    const attemptNumber =
      previousAttempts && previousAttempts.length > 0 ? previousAttempts[0].attempt_number + 1 : 1;

    const { scaled, dominant } = computeScores(answers);

    // La passation part AVANT la mise à jour du profil. Ce sont les 50
    // réponses qui sont irremplaçables : si l'écriture du profil échoue,
    // la personne ne doit pas perdre son test pour autant. L'ordre inverse
    // a coûté des passations en production — un profil qui ne s'écrivait
    // pas faisait échouer tout l'enregistrement.
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

    if (dossierExistant) {
      await majProfil(participantId, {
        gender,
        first_name: firstName,
        last_name: lastName,
        phone,
        city: city || null,
        postal_code: postalCode || null,
        last_test_at: now,
      });
    }

    // Historique complet de cette personne, renvoyé avec le résultat pour
    // qu'elle puisse visualiser son évolution sur l'écran de résultats.
    // On n'arrive ici que dans deux cas : le dossier vient d'être créé par
    // cette personne, ou sa session prouve qu'elle en est la titulaire.
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
