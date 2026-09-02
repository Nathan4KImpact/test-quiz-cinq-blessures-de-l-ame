// Sessions minimalistes : cookie signé (HMAC), sans dépendance npm.
//
// Deux sessions distinctes cohabitent, avec deux cookies et deux rôles
// séparés dans la charge signée : l'admin (accès à tous les participants)
// et le participant (accès à son seul dossier). Un cookie ne peut pas
// servir pour l'autre rôle, même signé par le même secret.

const crypto = require("crypto");

const COOKIE_NAME = "admin_session";
const PARTICIPANT_COOKIE_NAME = "participant_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h
// Le test se refait tous les 6 mois : une session trop courte obligerait à
// redemander un code à chaque visite. 7 jours reste un compromis
// raisonnable pour des données de cette sensibilité, avec déconnexion
// explicite disponible à tout moment.
const PARTICIPANT_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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
  const payload = verify(token);
  return !!payload && payload.role === "admin";
}

// ---------- Session participant ----------

function createParticipantSessionCookie(participantId) {
  const token = sign({
    role: "participant",
    pid: participantId,
    exp: Date.now() + PARTICIPANT_SESSION_TTL_MS,
  });
  const maxAge = Math.floor(PARTICIPANT_SESSION_TTL_MS / 1000);
  return `${PARTICIPANT_COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function clearParticipantSessionCookie() {
  return `${PARTICIPANT_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

// Renvoie l'id du participant connecté, ou null. Le contrôle du rôle est
// essentiel : sans lui, un cookie admin valide passerait aussi ici.
function getParticipantId(req) {
  const payload = verify(readCookie(req, PARTICIPANT_COOKIE_NAME));
  if (!payload || payload.role !== "participant" || !payload.pid) return null;
  return payload.pid;
}

// HMAC du code à usage unique. On ne stocke jamais le code en clair : une
// fuite de la base seule ne permet pas de le retrouver, le secret de
// signature ne s'y trouvant pas.
function hashLoginCode(code, participantId) {
  return crypto
    .createHmac("sha256", getSecret())
    .update(`${participantId}:${code}`)
    .digest("hex");
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
  PARTICIPANT_COOKIE_NAME,
  createSessionCookie,
  clearSessionCookie,
  isAuthorized,
  createParticipantSessionCookie,
  clearParticipantSessionCookie,
  getParticipantId,
  hashLoginCode,
  timingSafeEqualStr,
};
