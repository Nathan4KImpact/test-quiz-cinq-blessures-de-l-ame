// Tests unitaires sans navigateur : plafond de fonctions serverless,
// routage de l'authentification, et destinataires du lien de coaching.

const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

let fails = 0;
const ok = (label, actual, expected) => {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) fails += 1;
  console.log(
    `${pass ? "OK  " : "FAIL"} ${label}: ${JSON.stringify(actual)}` +
      (pass ? "" : ` | attendu ${JSON.stringify(expected)}`)
  );
};

// ---------- Plafond Vercel ----------
// Chaque fichier .js de api/ devient une fonction serverless ; le plan
// Hobby en plafonne un déploiement à 12. Le build échoue APRÈS « Build
// Completed », donc les logs restent verts : sans ce garde-fou, on ne s'en
// aperçoit qu'au déploiement.
function fonctions(dir, acc) {
  acc = acc || [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith("_")) continue; // _lib, _auth : pas des fonctions
    const p = path.join(dir, e.name);
    if (e.isDirectory()) fonctions(p, acc);
    else if (e.name.endsWith(".js")) acc.push(path.relative(ROOT, p));
  }
  return acc;
}

const liste = fonctions(path.join(ROOT, "api"));
console.log("--- fonctions serverless ---");
liste.forEach((f) => console.log("     " + f));
ok(`nombre de fonctions <= 12 (actuel : ${liste.length})`, liste.length <= 12, true);

// ---------- Routage de l'authentification ----------
console.log("\n--- routage de api/auth/[action].js ---");
const router = require(path.join(ROOT, "api/auth/[action].js"));
ok("7 actions déclarées", Object.keys(router.handlers).sort(),
  ["login", "logout", "me", "precheck", "request-code", "set-password", "verify-code"]);

function fakeRes() {
  return {
    statusCode: 0, payload: null, headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.statusCode = c; return this; },
    json(b) { this.payload = b; return this; },
  };
}
const call = (action, extra) =>
  router({ method: "POST", query: { action }, headers: {}, body: {}, ...(extra || {}) }, fakeRes());

(async () => {
  const run = async (action, extra) => {
    const res = fakeRes();
    await router(
      { method: "POST", query: { action }, headers: {}, body: {}, ...(extra || {}) },
      res
    );
    return res;
  };

  ok("logout atteint son handler", (await run("logout")).statusCode, 200);
  ok("me sans session -> 401", (await run("me", { method: "GET" })).statusCode, 401);
  ok("set-password sans session -> 401", (await run("set-password")).statusCode, 401);
  ok("login sans identifiants -> 401", (await run("login")).statusCode, 401);
  ok("verify-code sans code -> 401", (await run("verify-code")).statusCode, 401);
  ok("precheck sans adresse -> 400", (await run("precheck")).statusCode, 400);

  // Actions inconnues et tentatives de traversée.
  for (const bad of ["inconnu", "", "../submit", "constructor", "__proto__", "toString"]) {
    ok(`action refusée : ${JSON.stringify(bad)}`, (await run(bad)).statusCode, 404);
  }

  // ---------- Lien de coaching ----------
  console.log("\n--- lien de réservation de coaching ---");
  const appJs = fs.readFileSync(path.join(ROOT, "js/app.js"), "utf8");
  ok("destinataire : la boîte de l'association",
    /COACHING_TO\s*=\s*"bienvenue@vieflorissante\.com"/.test(appJs), true);
  ok("copie cachée présente", /\bbcc=\$\{encodeURIComponent\(COACHING_BCC\)\}/.test(appJs), true);
  ok("l'ancien destinataire n'est plus en destinataire direct",
    /mailto:bouangaesther9@gmail\.com/.test(appJs), false);

  // Repli desktop : un mailto sans logiciel associé ne produit rien.
  const htmlCta = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  ok("l'adresse est lisible en clair sur la page",
    /cta-fallback[\s\S]{0,300}bienvenue@vieflorissante\.com/.test(htmlCta), true);
  ok("un bouton propose de copier l'adresse",
    /id="copy-booking-email"/.test(htmlCta), true);

  // ---------- Le formulaire d'accueil ne demande plus de mot de passe ----
  console.log("\n--- formulaire d'accueil ---");
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  ok("aucun champ mot de passe à l'inscription", /id="signup-password"/.test(html), false);
  ok("le téléphone reste obligatoire", /id="phone"[^>]*required/.test(html), true);
  ok("l'e-mail reste obligatoire", /id="email"[^>]*required/.test(html), true);

  // ---------- /api/submit n'accepte plus de mot de passe ----------
  const submitJs = fs.readFileSync(path.join(ROOT, "api/submit.js"), "utf8");
  ok("submit ne manipule aucun mot de passe", /password/i.test(
    submitJs.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n")
  ), false);
  ok("submit identifie par l'e-mail",
    /participants\?email=eq\./.test(submitJs), true);
  ok("submit n'identifie plus par le téléphone",
    /participants\?phone=eq\./.test(submitJs), false);

  console.log(fails ? `\n${fails} ASSERTION(S) EN ÉCHEC` : "\nTOUTES LES ASSERTIONS PASSENT");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
