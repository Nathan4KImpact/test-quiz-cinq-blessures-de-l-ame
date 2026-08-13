// Tâche planifiée (Vercel Cron, voir vercel.json) : envoie un e-mail de
// rappel aux personnes qui n'ont pas refait le test depuis 6 mois.
//
// Nécessite un compte Resend (gratuit) : RESEND_API_KEY. Si cette variable
// n'est pas configurée, la tâche ne fait rien (pas d'erreur) — le reste de
// l'application fonctionne normalement sans elle.

const { supabaseRequest } = require("../_lib/supabase");

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

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    res.status(200).json({ skipped: true, reason: "RESEND_API_KEY non configuré." });
    return;
  }

  const fromAddress = process.env.REMINDER_FROM_EMAIL || "onboarding@resend.dev";
  const appUrl = process.env.APP_URL || "";

  try {
    const cutoffIso = new Date(Date.now() - SIX_MONTHS_MS).toISOString();
    // L'email étant désormais facultatif, seuls les participants qui en ont
    // renseigné un peuvent recevoir un rappel.
    const due = await supabaseRequest(
      `/participants?last_test_at=lte.${encodeURIComponent(cutoffIso)}&reminder_sent_at=is.null&email=not.is.null&select=id,email,first_name,last_test_at`
    );

    let sent = 0;
    for (const participant of due || []) {
      const ok = await sendReminderEmail(resendKey, fromAddress, appUrl, participant);
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

async function sendReminderEmail(apiKey, from, appUrl, participant) {
  const ctaUrl = appUrl || "";
  const html = `
    <p>Bonjour ${escapeHtml(participant.first_name || "")},</p>
    <p>Cela fait environ 6 mois depuis ta dernière passation du <strong>Test des 5 blessures de l'âme</strong>.</p>
    <p>Refaire le test aujourd'hui te permet de suivre l'évolution de ton cheminement.</p>
    ${ctaUrl ? `<p><a href="${ctaUrl}">Refaire le test maintenant</a></p>` : ""}
    <p>« Bien-aimée, je souhaite que tu prospères à tous égards et sois en bonne santé,
    comme prospère l'état de ton âme. » (3 Jean 1:2)</p>
  `;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: participant.email,
        subject: "Et si tu refaisais le test des 5 blessures de l'âme ?",
        html,
      }),
    });
    return res.ok;
  } catch (e) {
    console.error("sendReminderEmail failed", e);
    return false;
  }
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}
