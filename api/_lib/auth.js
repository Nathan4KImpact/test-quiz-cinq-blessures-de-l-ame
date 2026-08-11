// Session admin minimaliste : cookie signé (HMAC), sans dépendance npm.

const crypto = require("crypto");

const COOKIE_NAME = "admin_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET n'est pas configuré côté serveur.");
  }
  return secret;
}

function sign(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", getSecret()).update(data).digest("base64url");
  return `${data}.${sig}`;
}

function verify(token) {
  if (!token || !token.includes(".")) return null;
  const [data, sig] = token.split(".");
  let expected;
  try {
    expected = crypto.createHmac("sha256", getSecret()).update(data).digest("base64url");
  } catch (e) {
    return null;
  }

  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

function createSessionCookie() {
  const token = sign({ role: "admin", exp: Date.now() + SESSION_TTL_MS });
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

function readCookie(req, name) {
  const header = req.headers && req.headers.cookie;
  if (!header) return null;
  const match = header
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : null;
}

function isAuthorized(req) {
  const token = readCookie(req, COOKIE_NAME);
  return !!verify(token);
}

function timingSafeEqualStr(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) {
    // Comparaison "factice" pour garder un temps de réponse comparable.
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = {
  COOKIE_NAME,
  createSessionCookie,
  clearSessionCookie,
  isAuthorized,
  timingSafeEqualStr,
};
