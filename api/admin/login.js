const { createSessionCookie, timingSafeEqualStr } = require("../_lib/auth");

function parseBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch (e) {
      return null;
    }
  }
  return null;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Méthode non autorisée." });
    return;
  }

  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    res.status(500).json({ error: "ADMIN_PASSWORD n'est pas configuré côté serveur." });
    return;
  }

  const body = parseBody(req);
  const password = body && body.password;

  if (typeof password !== "string" || !password || !timingSafeEqualStr(password, expected)) {
    res.status(401).json({ error: "Mot de passe incorrect." });
    return;
  }

  res.setHeader("Set-Cookie", createSessionCookie());
  res.status(200).json({ ok: true });
};
