// Demande d'un code de connexion à usage unique, envoyé par e-mail.
//
// Règle de confidentialité centrale : la réponse est TOUJOURS la même,
// que l'adresse soit connue ou non. Sans cela, cet endpoint deviendrait
// un moyen de tester si telle personne a passé le test — une information
// déjà sensible en elle-même, avant même l'accès aux résultats.

const crypto = require("crypto");
const { supabaseRequest } = require("../_lib/supabase");
const { hashLoginCode } = require("../_lib/auth");
const { isMailerConfigured, sendEmail, escapeHtml } = require("../_lib/mailer");

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
// Au-delà, on cesse d'envoyer sans le dire : cela évite qu'un tiers se
// serve de l'endpoint pour inonder la boîte mail de quelqu'un.
const MAX_CODES_PER_WINDOW = 3;
const RATE_WINDOW_MS = 15 * 60 * 1000;

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Méthode non autorisée." });
    return;
  }

  if (!isMailerConfigured()) {
    // Erreur de configuration, pas de fuite : la réponse ne dépend
    // d'aucune donnée saisie.
    res.status(503).json({
      error:
        "La connexion par e-mail n'est pas encore activée sur ce site. " +
        "Configurer RESEND_API_KEY côté serveur.",
    });
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

  // Réponse générique, préparée une fois pour toutes les issues.
  const genericOk = () =>
    res.status(200).json({
      ok: true,
      message:
        "Si cette adresse correspond à un test déjà passé, un code vient d'être envoyé.",
    });

  if (!email || !/^[^\s@]+@[^\s@]+$/.test(email)) {
    res.status(400).json({ error: "Adresse e-mail invalide." });
    return;
  }

  try {
    // Égalité stricte, pas de ilike : « _ » est un joker SQL et une
    // adresse qui en contient irait chercher le dossier d'un autre. Les
    // adresses sont normalisées en minuscules en base (migration 004).
    const found = await supabaseRequest(
      `/participants?email=eq.${encodeURIComponent(email)}&select=id,first_name,email&limit=1`
    );
    const participant = found && found[0];
    if (!participant) {
      genericOk();
      return;
    }

    // Limitation du nombre d'envois par personne sur une fenêtre glissante.
    const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
    const recent = await supabaseRequest(
      `/participant_login_codes?participant_id=eq.${participant.id}` +
        `&created_at=gte.${encodeURIComponent(since)}&select=id`
    );
    if ((recent || []).length >= MAX_CODES_PER_WINDOW) {
      genericOk();
      return;
    }

    // crypto.randomInt : générateur cryptographique, contrairement à
    // Math.random() dont la sortie est prédictible.
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");

    await supabaseRequest("/participant_login_codes", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        participant_id: participant.id,
        code_hash: hashLoginCode(code, participant.id),
        expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
      }),
    });

    await sendEmail({
      to: participant.email,
      subject: `${code} — ton code de connexion`,
      html: buildCodeEmail(participant.first_name, code),
    });

    genericOk();
  } catch (err) {
    console.error("auth/request-code error", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

function buildCodeEmail(firstName, code) {
  return `
    <p>Bonjour ${escapeHtml(firstName || "")},</p>
    <p>Voici le code pour accéder à ton espace du
    <strong>Test des 5 blessures de l'âme</strong> :</p>
    <p style="font-size:30px;font-weight:700;letter-spacing:6px;margin:22px 0">${code}</p>
    <p>Ce code est valable 10 minutes et ne fonctionne qu'une seule fois.</p>
    <p style="color:#6b5b6b;font-size:13px">Si tu n'es pas à l'origine de cette
    demande, ignore simplement ce message : aucun accès n'a été ouvert.</p>
  `;
}
