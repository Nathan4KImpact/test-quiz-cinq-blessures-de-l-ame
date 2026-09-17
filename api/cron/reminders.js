// Tâche planifiée (Vercel Cron, voir vercel.json) : relance par e-mail les
// personnes qui n'ont pas refait le test depuis 1 mois, puis depuis 6 mois.
//
// Deux colonnes de suivi distinctes (reminder_1m_sent_at et
// reminder_sent_at) : une personne reçoit au plus un rappel de chaque
// sorte entre deux passations, et repasser le test remet les deux à zéro.
//
// Nécessite un compte Resend : RESEND_API_KEY. Si cette variable n'est pas
// configurée, aucun e-mail ne part — mais la base est interrogée quand
// même, voir le ping ci-dessous.

const { supabaseRequest } = require("../_lib/supabase");
const { isMailerConfigured, sendEmail, escapeHtml } = require("../_lib/mailer");

const ONE_MONTH_MS = 30 * 24 * 3600 * 1000;
const SIX_MONTHS_MS = 6 * 30 * 24 * 3600 * 1000;

// Les deux relances, de la plus récente à la plus ancienne. La fenêtre du
// rappel à 1 mois est bornée à 6 mois : au-delà, c'est le rappel à 6 mois
// qui a le bon message, et envoyer les deux à un jour d'intervalle à
// quelqu'un qui revient après un an n'aurait aucun sens.
const RELANCES = [
  {
    cle: "1 mois",
    champ: "reminder_1m_sent_at",
    minMs: ONE_MONTH_MS,
    maxMs: SIX_MONTHS_MS,
    objet: "Un mois déjà — où en est votre cheminement ?",
    intro:
      "Cela fait un mois depuis votre dernière passation du " +
      "<strong>Test des 5 blessures de l'âme</strong>.",
    corps:
      "Un mois, c'est court pour une blessure ancienne, mais c'est assez " +
      "pour voir bouger une habitude. Refaire le test aujourd'hui met ce " +
      "premier pas en évidence.",
  },
  {
    cle: "6 mois",
    champ: "reminder_sent_at",
    minMs: SIX_MONTHS_MS,
    maxMs: null,
    objet: "Et si vous refaisiez le test des 5 blessures de l'âme ?",
    intro:
      "Cela fait environ 6 mois depuis votre dernière passation du " +
      "<strong>Test des 5 blessures de l'âme</strong>.",
    corps:
      "Refaire le test aujourd'hui permet de suivre l'évolution de votre " +
      "cheminement.",
  },
];

module.exports = async (req, res) => {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    res.status(500).json({ error: "CRON_SECRET n'est pas configuré côté serveur." });
    return;
  }
  if (req.headers.authorization !== `Bearer ${cronSecret}`) {
    res.status(401).json({ error: "Non autorisé." });
    return;
  }

  // Ping systématique de la base, AVANT toute sortie anticipée. Supabase met
  // en pause un projet gratuit resté sans activité (7 jours) ; sans cette
  // requête, une instance où RESEND_API_KEY n'est pas configuré ne toucherait
  // jamais la base et finirait par se mettre en pause toute seule.
  let keepAlive = "ok";
  try {
    await supabaseRequest("/participants?select=id&limit=1");
  } catch (err) {
    keepAlive = "échec";
    console.error("cron/reminders keep-alive error", err);
  }

  if (!isMailerConfigured()) {
    res
      .status(200)
      .json({ skipped: true, keepAlive, reason: "RESEND_API_KEY non configuré." });
    return;
  }

  const appUrl = process.env.APP_URL || "";

  try {
    const bilan = {};
    for (const relance of RELANCES) {
      bilan[relance.cle] = await traiterRelance(relance, appUrl);
    }
    res.status(200).json({ keepAlive, relances: bilan });
  } catch (err) {
    console.error("cron/reminders error", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

async function traiterRelance(relance, appUrl) {
  const now = Date.now();
  let filtre =
    `/participants?last_test_at=lte.${encodeURIComponent(new Date(now - relance.minMs).toISOString())}` +
    `&${relance.champ}=is.null`;
  if (relance.maxMs) {
    filtre += `&last_test_at=gt.${encodeURIComponent(new Date(now - relance.maxMs).toISOString())}`;
  }
  filtre += "&select=id,email,first_name,last_test_at";

  const due = await supabaseRequest(filtre);

  let sent = 0;
  for (const participant of due || []) {
    const ok = await sendReminderEmail(relance, appUrl, participant);
    if (ok) {
      await supabaseRequest(`/participants?id=eq.${participant.id}`, {
        method: "PATCH",
        body: JSON.stringify({ [relance.champ]: new Date().toISOString() }),
      });
      sent += 1;
    }
  }

  return { checked: (due || []).length, sent };
}

// Passe par api/_lib/mailer.js comme les codes de connexion : même
// expéditeur, même adresse de réponse, mêmes logs de diagnostic.
async function sendReminderEmail(relance, appUrl, participant) {
  const ctaUrl = appUrl || "";
  const html = `
    <p>Bonjour ${escapeHtml(participant.first_name || "")},</p>
    <p>${relance.intro}</p>
    <p>${relance.corps}</p>
    ${ctaUrl ? `<p><a href="${escapeHtml(ctaUrl)}">Refaire le test maintenant</a></p>` : ""}
    <p>« Bien-aimée, je souhaite que tu prospères à tous égards et sois en bonne santé,
    comme prospère l'état de ton âme. » (3 Jean 1:2)</p>
  `;

  return sendEmail({
    to: participant.email,
    subject: relance.objet,
    html,
  });
}
