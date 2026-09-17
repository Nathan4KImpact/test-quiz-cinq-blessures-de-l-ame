// Tests unitaires du cron de relance, sans navigateur ni base.
//
// Deux relances cohabitent désormais : 1 mois et 6 mois. Le risque à couvrir
// n'est pas qu'un e-mail parte, c'est qu'il parte deux fois, ou qu'il parte
// à quelqu'un qui vient de repasser le test.

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

const requetes = [];
let mailerConfigure = true;
let envoisEchoues = false;
const envoyes = [];
let reponseParRequete = () => [];

function stub(relPath, exportsObj) {
  const full = require.resolve(path.join(ROOT, relPath));
  require.cache[full] = { id: full, filename: full, loaded: true, exports: exportsObj };
}

stub("api/_lib/supabase.js", {
  supabaseRequest: async (chemin, options) => {
    requetes.push({ chemin, method: (options && options.method) || "GET", body: options && options.body });
    return reponseParRequete(chemin);
  },
});
stub("api/_lib/mailer.js", {
  isMailerConfigured: () => mailerConfigure,
  sendEmail: async (m) => { envoyes.push(m); return !envoisEchoues; },
  escapeHtml: (s) => String(s),
});

const cron = require(path.join(ROOT, "api/cron/reminders.js"));

function fakeRes() {
  return {
    statusCode: 0, payload: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.payload = b; return this; },
  };
}

const auth = { authorization: "Bearer secret-de-test" };

function reset() {
  requetes.length = 0;
  envoyes.length = 0;
  reponseParRequete = () => [];
}

(async () => {
  process.env.CRON_SECRET = "secret-de-test";

  // ---- Le ping de maintien en éveil précède toute sortie anticipée ----
  mailerConfigure = false;
  reset();
  let res = fakeRes();
  await cron({ headers: auth }, res);
  ok("mailer absent : réponse 200", res.statusCode, 200);
  ok("mailer absent : la base est tout de même interrogée", requetes.length, 1);
  ok("mailer absent : requête légère", requetes[0].chemin, "/participants?select=id&limit=1");
  ok("mailer absent : keep-alive rapporté", res.payload.keepAlive, "ok");

  // ---- Deux relances distinctes, chacune sur sa propre colonne ----
  mailerConfigure = true;
  reset();
  reponseParRequete = (chemin) => {
    if (chemin.includes("reminder_1m_sent_at=is.null")) {
      return [{ id: "a1", email: "un@ex.com", first_name: "Un" }];
    }
    if (chemin.includes("reminder_sent_at=is.null")) {
      return [{ id: "a6", email: "six@ex.com", first_name: "Six" }];
    }
    return [];
  };
  res = fakeRes();
  await cron({ headers: auth }, res);

  ok("deux relances rapportées", Object.keys(res.payload.relances).sort(), ["1 mois", "6 mois"]);
  ok("un envoi pour chaque relance", envoyes.length, 2);
  ok("destinataires distincts", envoyes.map((m) => m.to).sort(), ["six@ex.com", "un@ex.com"]);
  ok("objets distincts", new Set(envoyes.map((m) => m.subject)).size, 2);

  // ---- Chaque relance marque SA colonne, jamais celle de l'autre ----
  const patchs = requetes.filter((r) => r.method === "PATCH").map((r) => JSON.parse(r.body));
  ok("deux marquages", patchs.length, 2);
  ok("une seule colonne par marquage", patchs.every((p) => Object.keys(p).length === 1), true);
  ok("colonnes attendues",
    patchs.map((p) => Object.keys(p)[0]).sort(), ["reminder_1m_sent_at", "reminder_sent_at"]);

  // ---- La relance à 1 mois est bornée à 6 mois ----
  const filtre1m = requetes.find((r) => r.chemin.includes("reminder_1m_sent_at=is.null")).chemin;
  ok("relance 1 mois : borne haute présente", filtre1m.includes("last_test_at=gt."), true);
  const filtre6m = requetes.find(
    (r) => r.chemin.includes("reminder_sent_at=is.null") && !r.chemin.includes("1m")
  ).chemin;
  ok("relance 6 mois : pas de borne haute", filtre6m.includes("last_test_at=gt."), false);

  // ---- Un envoi qui échoue ne marque pas la colonne ----
  envoisEchoues = true;
  reset();
  res = fakeRes();
  await cron({ headers: auth }, res);
  ok("envoi en échec : aucun marquage",
    requetes.filter((r) => r.method === "PATCH").length, 0);
  ok("envoi en échec : compté comme non envoyé", res.payload.relances["1 mois"].sent, 0);
  envoisEchoues = false;

  // ---- Sans autorisation, rien ne part ----
  reset();
  res = fakeRes();
  await cron({ headers: { authorization: "Bearer mauvais" } }, res);
  ok("non autorisé : 401", res.statusCode, 401);
  ok("non autorisé : aucune requête", requetes.length, 0);

  console.log(fails ? `\n${fails} ASSERTION(S) EN ÉCHEC` : "\nTOUTES LES ASSERTIONS PASSENT");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
