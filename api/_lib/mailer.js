// Envoi d'e-mails via Resend, sans dépendance npm (simple appel REST).
//
// Resend reste optionnel pour le reste de l'application : seule la
// connexion des participants en dépend réellement, puisque c'est le code
// reçu par e-mail qui prouve l'identité.

function mailerConfig() {
  return {
    apiKey: process.env.RESEND_API_KEY || "",
    from: process.env.REMINDER_FROM_EMAIL || "onboarding@resend.dev",
  };
}

function isMailerConfigured() {
  return !!mailerConfig().apiKey;
}

async function sendEmail({ to, subject, html }) {
  const { apiKey, from } = mailerConfig();
  if (!apiKey) return false;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) {
      // Le corps de la réponse Resend explique la cause (domaine non
      // vérifié, adresse invalide…) : sans ce log, un envoi qui échoue
      // ressemble à « le code n'arrive pas » sans piste.
      const detail = await res.text().catch(() => "");
      console.error("sendEmail failed", res.status, detail);
      return false;
    }
    return true;
  } catch (e) {
    console.error("sendEmail error", e);
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

module.exports = { isMailerConfigured, sendEmail, escapeHtml };
