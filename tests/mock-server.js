// Mock local de l'API : rejoue les endpoints Vercel avec une fausse base en
// mémoire, pour faire tourner les parcours navigateur sans Supabase ni Resend.
//
// Il doit refléter le comportement réel du serveur, pas l'arranger : un mock
// plus permissif que la production valide un comportement qui n'existe pas.
// En particulier, depuis la migration 006, l'e-mail est la clé d'identité et
// le téléphone ne l'est plus.
//
// Démarrage :  node tests/mock-server.js [port]

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.argv[2] || 8700);
const WOUND_IDS = ["trahison", "rejet", "abandon", "humiliation", "injustice"];

function computeScores(answers) {
  const raw = { trahison: 0, rejet: 0, abandon: 0, humiliation: 0, injustice: 0 };
  for (let i = 0; i < 50; i++) raw[WOUND_IDS[Math.floor(i / 10)]] += Number(answers[i]);
  const scaled = {};
  WOUND_IDS.forEach((id) => (scaled[id] = Math.round((raw[id] / 30) * 50)));
  const max = Math.max(...Object.values(scaled));
  return { scaled, dominant: WOUND_IDS.filter((id) => scaled[id] === max) };
}

const now = Date.now();
const DAY = 24 * 3600 * 1000;
const participants = new Map();
const attemptsByParticipant = new Map();

function seed() {
  // Marie : plusieurs passations, un mot de passe défini.
  participants.set("p1", {
    id: "p1", phone: "+33612345678", email: "marie@example.com", gender: "femme",
    first_name: "Marie", last_name: "Dupont", city: "Lyon", postal_code: "69000",
    created_at: new Date(now - 200 * DAY).toISOString(),
    last_test_at: new Date(now - 5 * DAY).toISOString(),
    reminder_sent_at: null, reminder_1m_sent_at: null,
    password_hash: "plain:MotDePasseMarie",
    password_set_at: new Date(now - 5 * DAY).toISOString(),
  });
  const hist = [
    [190, { trahison: 42, rejet: 33, abandon: 25, humiliation: 20, injustice: 28 }],
    [130, { trahison: 38, rejet: 32, abandon: 25, humiliation: 20, injustice: 27 }],
    [70, { trahison: 33, rejet: 30, abandon: 23, humiliation: 20, injustice: 25 }],
    [5, { trahison: 28, rejet: 28, abandon: 22, humiliation: 18, injustice: 23 }],
  ];
  attemptsByParticipant.set("p1", hist.map(([d, sc], i) => {
    const max = Math.max(...Object.values(sc));
    return {
      attempt_number: i + 1, taken_at: new Date(now - d * DAY).toISOString(),
      score_trahison: sc.trahison, score_rejet: sc.rejet, score_abandon: sc.abandon,
      score_humiliation: sc.humiliation, score_injustice: sc.injustice,
      dominant_wounds: WOUND_IDS.filter((w) => sc[w] === max),
    };
  }));

  // Jean : dossier ancien, SANS mot de passe — le cas majoritaire en base.
  // Il partage volontairement le téléphone de Marie : depuis la migration
  // 006 c'est permis, et c'est précisément ce que les tests vérifient.
  participants.set("p2", {
    id: "p2", phone: "+33612345678", email: "jean@example.com", gender: "homme",
    first_name: "Jean", last_name: "Martin", city: "Paris", postal_code: "75001",
    created_at: new Date(now - 3 * DAY).toISOString(),
    last_test_at: new Date(now - 3 * DAY).toISOString(),
    reminder_sent_at: null, reminder_1m_sent_at: null,
  });
  attemptsByParticipant.set("p2", [
    { attempt_number: 1, taken_at: new Date(now - 3 * DAY).toISOString(),
      score_trahison: 30, score_rejet: 45, score_abandon: 22,
      score_humiliation: 24, score_injustice: 42, dominant_wounds: ["rejet"] },
  ]);
}
seed();

const adminSessions = new Set();
const participantSessions = new Map(); // token -> participantId
const loginCodes = new Map();          // participantId -> { code, expiresAt, attempts }
let lastIssuedCode = null;             // exposé aux tests uniquement

function send(res, status, body, headers) {
  res.writeHead(status, { "Content-Type": "application/json", ...(headers || {}) });
  res.end(JSON.stringify(body));
}
function readBody(req) {
  return new Promise((resolve) => {
    let d = ""; req.on("data", (c) => (d += c));
    req.on("end", () => { try { resolve(JSON.parse(d || "{}")); } catch { resolve({}); } });
  });
}
function cookieOf(req, name) {
  const c = req.headers.cookie || "";
  const m = c.split(";").map((x) => x.trim()).find((x) => x.startsWith(name + "="));
  return m ? m.slice(name.length + 1) : null;
}
const isAdmin = (req) => adminSessions.has(cookieOf(req, "admin_session"));
const participantOf = (req) => participantSessions.get(cookieOf(req, "participant_session")) || null;

// Clé d'identité : l'e-mail, et lui seul.
const byEmail = (email) =>
  [...participants.values()].find((x) => (x.email || "").toLowerCase() === (email || "").toLowerCase()) || null;

function openSession(id) {
  const token = crypto.randomBytes(8).toString("hex");
  participantSessions.set(token, id);
  return `participant_session=${token}; Path=/`;
}

const MIME = {
  ".html": "text/html", ".css": "text/css",
  ".js": "application/javascript", ".woff2": "font/woff2",
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname;

  // ---------- Connexion participant ----------
  if (p === "/api/auth/precheck" && req.method === "POST") {
    const b = await readBody(req);
    const email = String(b.email || "").trim().toLowerCase();
    if (!email) return send(res, 400, { error: "Adresse e-mail requise." });
    const person = byEmail(email);
    if (!person) return send(res, 200, { status: "new" });
    if (participantOf(req) === person.id) return send(res, 200, { status: "authenticated" });
    return send(res, 200, { status: "auth_required", hasPassword: !!person.password_hash });
  }

  if (p === "/api/auth/request-code" && req.method === "POST") {
    const b = await readBody(req);
    const email = String(b.email || "").trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+$/.test(email)) {
      return send(res, 400, { error: "Adresse e-mail invalide." });
    }
    const person = byEmail(email);
    if (person) {
      const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
      loginCodes.set(person.id, { code, expiresAt: Date.now() + 600000, attempts: 0 });
      lastIssuedCode = code;
    }
    // Réponse identique que l'adresse soit connue ou non.
    return send(res, 200, { ok: true });
  }

  if (p === "/api/auth/verify-code" && req.method === "POST") {
    const b = await readBody(req);
    const code = String(b.code || "").replace(/\D/g, "");
    const reject = () => send(res, 401, { error: "Code incorrect ou expiré." });
    const person = byEmail(String(b.email || ""));
    if (!person) return reject();
    const rec = loginCodes.get(person.id);
    if (!rec || rec.expiresAt < Date.now() || rec.attempts >= 5) return reject();
    if (rec.code !== code) { rec.attempts += 1; return reject(); }
    loginCodes.delete(person.id);
    return send(res, 200, { ok: true }, { "Set-Cookie": openSession(person.id) });
  }

  if (p === "/api/auth/login" && req.method === "POST") {
    const b = await readBody(req);
    const password = String(b.password || "");
    const reject = () => send(res, 401, { error: "E-mail ou mot de passe incorrect." });
    const person = byEmail(String(b.email || ""));
    if (!person || !person.password_hash) return reject();
    if (person.password_hash !== "plain:" + password) return reject();
    return send(res, 200, { ok: true }, { "Set-Cookie": openSession(person.id) });
  }

  if (p === "/api/auth/logout" && req.method === "POST") {
    const t = cookieOf(req, "participant_session");
    if (t) participantSessions.delete(t);
    return send(res, 200, { ok: true }, { "Set-Cookie": "participant_session=; Path=/; Max-Age=0" });
  }

  if (p === "/api/auth/me" && req.method === "GET") {
    const id = participantOf(req);
    if (!id) return send(res, 401, { error: "Non authentifié." });
    const person = participants.get(id);
    if (!person) return send(res, 404, { error: "Dossier introuvable." });
    return send(res, 200, {
      participant: { ...person, password_hash: undefined, hasPassword: !!person.password_set_at },
      history: attemptsByParticipant.get(id) || [],
    });
  }

  if (p === "/api/auth/set-password" && req.method === "POST") {
    const id = participantOf(req);
    if (!id) return send(res, 401, { error: "Non authentifié." });
    const b = await readBody(req);
    const password = String(b.password || "");
    if (password.length < 8) {
      return send(res, 400, { error: "Le mot de passe doit contenir au moins 8 caractères." });
    }
    const person = participants.get(id);
    person.password_hash = "plain:" + password;
    person.password_set_at = new Date().toISOString();
    return send(res, 200, { ok: true });
  }

  // Endpoint de test uniquement : récupère le dernier code émis.
  if (p === "/api/__lastcode") return send(res, 200, { code: lastIssuedCode });

  // ---------- Passation ----------
  if (p === "/api/submit" && req.method === "POST") {
    const b = await readBody(req);
    const phone = String(b.phone || "").replace(/[\s.\-()]/g, "");
    const email = String(b.email || "").trim().toLowerCase();
    if (!phone) return send(res, 400, { error: "phone", details: ["téléphone manquant"] });
    if (!/^[^\s@]+@[^\s@]+$/.test(email)) return send(res, 400, { error: "email" });
    if (!["homme", "femme"].includes(b.gender)) return send(res, 400, { error: "gender" });

    const { scaled, dominant } = computeScores(b.answers || []);
    let person = byEmail(email);

    // Rattacher une passation à un dossier existant exige d'en être la
    // titulaire prouvée.
    if (person && participantOf(req) !== person.id) {
      return send(res, 403, {
        error: "Un dossier existe déjà pour cette adresse e-mail. Connexion requise.",
        requiresAuth: true,
      });
    }

    let cookie = null;
    if (!person) {
      const id = "p" + (participants.size + 1);
      person = {
        id, phone, gender: b.gender, email,
        first_name: b.firstName, last_name: b.lastName,
        city: b.city, postal_code: b.postalCode,
        created_at: new Date().toISOString(), last_test_at: new Date().toISOString(),
        reminder_sent_at: null, reminder_1m_sent_at: null,
        // Aucun mot de passe : le formulaire n'en demande plus.
        password_hash: null, password_set_at: null,
      };
      participants.set(id, person);
      attemptsByParticipant.set(id, []);
      cookie = openSession(id);
    } else {
      person.phone = phone;
      person.reminder_sent_at = null;
      person.reminder_1m_sent_at = null;
    }

    const list = attemptsByParticipant.get(person.id);
    const attemptNumber = list.length + 1;
    list.push({
      attempt_number: attemptNumber, taken_at: new Date().toISOString(),
      score_trahison: scaled.trahison, score_rejet: scaled.rejet,
      score_abandon: scaled.abandon, score_humiliation: scaled.humiliation,
      score_injustice: scaled.injustice, dominant_wounds: dominant,
    });
    person.last_test_at = new Date().toISOString();

    return send(res, 200, { attemptNumber, scores: scaled, dominant, history: list },
      cookie ? { "Set-Cookie": cookie } : undefined);
  }

  // ---------- Admin ----------
  if (p === "/api/admin/login" && req.method === "POST") {
    const b = await readBody(req);
    if (b.password === "test1234") {
      const t = crypto.randomBytes(8).toString("hex");
      adminSessions.add(t);
      return send(res, 200, { ok: true }, { "Set-Cookie": `admin_session=${t}; Path=/` });
    }
    return send(res, 401, { error: "Mot de passe incorrect." });
  }
  if (p === "/api/admin/logout" && req.method === "POST") {
    return send(res, 200, { ok: true }, { "Set-Cookie": "admin_session=; Path=/; Max-Age=0" });
  }
  if (p === "/api/admin/participants" && req.method === "GET") {
    if (!isAdmin(req)) return send(res, 401, { error: "Non authentifié." });
    return send(res, 200, {
      participants: [...participants.values()].map((x) => {
        const a = attemptsByParticipant.get(x.id) || [];
        return { ...x, attemptsCount: a.length, latestAttempt: a[a.length - 1] || null };
      }),
    });
  }
  if (p === "/api/admin/participant" && req.method === "GET") {
    if (!isAdmin(req)) return send(res, 401, { error: "Non authentifié." });
    const person = participants.get(url.searchParams.get("id"));
    if (!person) return send(res, 404, {});
    return send(res, 200, {
      participant: person,
      attempts: attemptsByParticipant.get(person.id) || [],
    });
  }

  // ---------- Fichiers statiques ----------
  const filePath = path.join(ROOT, p === "/" ? "/index.html" : p);
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end("Forbidden"); return; }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end("Not found"); return; }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream",
    });
    res.end(data);
  });
}).listen(PORT, () => console.log("mock sur http://localhost:" + PORT));
