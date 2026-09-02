// Tâche planifiée (Vercel Cron, voir vercel.json) : envoie un e-mail de
// rappel aux personnes qui n'ont pas refait le test depuis 6 mois.
//
// Nécessite un compte Resend (gratuit) : RESEND_API_KEY. Si cette variable
// n'est pas configurée, la tâche ne fait rien (pas d'erreur) — le reste de
// l'application fonctionne normalement sans elle.

const { supabaseRequest } = require("../_lib/supabase");
const { isMailerConfigured, sendEmail, escapeHtml } = require("../_lib/mailer");

const SIX_MONTHS_MS = 6 * 30 * 24 * 3600 * 1000;

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
    const cutoffIso = new Date(Date.now() - SIX_MONTHS_MS).toISOString();
    const due = await supabaseRequest(
      `/participants?last_test_at=lte.${encodeURIComponent(cutoffIso)}&reminder_sent_at=is.null&select=id,email,first_name,last_test_at`
    );

    let sent = 0;
    for (const participant of due || []) {
      const ok = await sendReminderEmail(appUrl, participant);
      if (ok) {
        await supabaseRequest(`/participants?id=eq.${participant.id}`, {
          method: "PATCH",
          body: JSON.stringify({ reminder_sent_at: new Date().toISOString() }),
        });
        sent += 1;
      }
    }

    res.status(200).json({ checked: (due || []).length, sent });
  } catch (err) {
    console.error("cron/reminders error", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
};

// Passe par api/_lib/mailer.js comme les codes de connexion : même
// expéditeur, même adresse de réponse, mêmes logs de diagnostic.
async function sendReminderEmail(appUrl, participant) {
  const ctaUrl = appUrl || "";
  const html = `
    <p>Bonjour ${escapeHtml(participant.first_name || "")},</p>
    <p>Cela fait environ 6 mois depuis ta dernière passation du <strong>Test des 5 blessures de l'âme</strong>.</p>
    <p>Refaire le test aujourd'hui te permet de suivre l'évolution de ton cheminement.</p>
    ${ctaUrl ? `<p><a href="${escapeHtml(ctaUrl)}">Refaire le test maintenant</a></p>` : ""}
    <p>« Bien-aimée, je souhaite que tu prospères à tous égards et sois en bonne santé,
    comme prospère l'état de ton âme. » (3 Jean 1:2)</p>
  `;

  return sendEmail({
    to: participant.email,
    subject: "Et si tu refaisais le test des 5 blessures de l'âme ?",
    html,
  });
}
