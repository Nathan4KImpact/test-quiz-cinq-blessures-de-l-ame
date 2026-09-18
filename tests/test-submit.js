// Tests unitaires de /api/submit, sans navigateur ni base.
//
// Le risque couvert ici est celui qui s'est réalisé en production : une
// écriture secondaire qui échoue et emporte avec elle les 50 réponses du
// participant. L'ordre des écritures fait partie du contrat.

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
let dossierTrouve = [];
// Renvoie un message d'erreur pour faire échouer certaines requêtes.
let faireEchouer = () => null;

function stub(relPath, exportsObj) {
  const full = require.resolve(path.join(ROOT, relPath));
  require.cache[full] = { id: full, filename: full, loaded: true, exports: exportsObj };
}

stub("api/_lib/supabase.js", {
  supabaseRequest: async (chemin, options) => {
    const method = (options && options.method) || "GET";
    const body = options && options.body ? JSON.parse(options.body) : null;
    requetes.push({ chemin, method, body });

    const motif = faireEchouer({ chemin, method, body });
    if (motif) throw new Error(motif);

    if (method === "GET" && chemin.startsWith("/participants?email=")) return dossierTrouve;
    if (method === "GET" && chemin.startsWith("/attempts?")) return [];
    if (method === "POST" && chemin === "/participants") return [{ id: "nouveau" }];
    return null;
  },
});
stub("api/_lib/auth.js", {
  createParticipantSessionCookie: () => "participant_session=x; Path=/",
  getParticipantId: () => "p-connecte",
});

const submit = require(path.join(ROOT, "api/submit.js"));

function fakeRes() {
  return {
    statusCode: 0, payload: null, headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.statusCode = c; return this; },
    json(b) { this.payload = b; return this; },
  };
}

const passation = {
  gender: "femme", firstName: "Rose", lastName: "Martin",
  email: "rose@example.com", phone: "+33612345678",
  city: "Lyon", postalCode: "69000", consent: true,
  answers: new Array(50).fill(2),
};

const appeler = async (corps, headers) => {
  const res = fakeRes();
  await submit({ method: "POST", headers: headers || {}, body: corps || passation }, res);
  return res;
};

function reset() {
  requetes.length = 0;
  faireEchouer = () => null;
}

const indexDe = (pred) => requetes.findIndex(pred);
const estInsertionPassation = (r) => r.method === "POST" && r.chemin === "/attempts";
const estMajProfil = (r) => r.method === "PATCH" && r.chemin.startsWith("/participants?id=");

(async () => {
  // ---- Dossier neuf : création, session ouverte, passation n°1 ----
  dossierTrouve = [];
  reset();
  let res = await appeler();
  ok("dossier neuf : 200", res.statusCode, 200);
  ok("dossier neuf : première passation", res.payload.attemptNumber, 1);
  ok("dossier neuf : session ouverte", !!res.headers["Set-Cookie"], true);
  ok("dossier neuf : aucune mise à jour de profil", requetes.filter(estMajProfil).length, 0);

  // ---- Dossier existant sans session : refus, et rien n'est écrit ----
  dossierTrouve = [{ id: "p-autre" }];
  reset();
  res = await appeler();
  ok("dossier d'autrui : 403", res.statusCode, 403);
  ok("dossier d'autrui : motif", res.payload.requiresAuth, true);
  ok("dossier d'autrui : aucune écriture", requetes.filter((r) => r.method !== "GET").length, 0);

  // ---- Dossier existant avec session : la passation part AVANT le profil ----
  dossierTrouve = [{ id: "p-connecte" }];
  reset();
  res = await appeler();
  ok("titulaire : 200", res.statusCode, 200);
  const iPassation = indexDe(estInsertionPassation);
  const iProfil = indexDe(estMajProfil);
  ok("la passation est bien enregistrée", iPassation >= 0, true);
  ok("le profil est bien mis à jour", iProfil >= 0, true);
  ok("la passation est écrite AVANT le profil", iPassation < iProfil, true);
  ok("les deux compteurs de rappel sont remis à zéro",
    Object.keys(requetes[iProfil].body).filter((k) => k.startsWith("reminder")).sort(),
    ["reminder_1m_sent_at", "reminder_sent_at"]);

  // ---- Le profil refusé ne doit PAS faire perdre la passation ----
  // C'est le scénario observé en production : la colonne reminder_1m_sent_at
  // manquait, PostgREST rejetait tout le PATCH, et la personne perdait ses
  // 50 réponses avec le bandeau « Résultats non enregistrés ».
  dossierTrouve = [{ id: "p-connecte" }];
  reset();
  faireEchouer = ({ chemin, method, body }) =>
    method === "PATCH" && chemin.startsWith("/participants?id=") && body.reminder_1m_sent_at === null
      ? 'Supabase PATCH -> 400: column "reminder_1m_sent_at" does not exist'
      : null;
  res = await appeler();
  ok("colonne de rappel manquante : la réponse reste un succès", res.statusCode, 200);
  ok("colonne de rappel manquante : la passation est enregistrée",
    requetes.filter(estInsertionPassation).length, 1);
  const patchs = requetes.filter(estMajProfil);
  ok("colonne de rappel manquante : un second essai est tenté", patchs.length, 2);
  ok("colonne de rappel manquante : le repli n'envoie plus les compteurs",
    Object.keys(patchs[1].body).some((k) => k.startsWith("reminder")), false);
  ok("colonne de rappel manquante : le profil est tout de même à jour",
    patchs[1].body.last_test_at !== undefined, true);

  // ---- Le profil totalement refusé ne fait pas échouer non plus ----
  dossierTrouve = [{ id: "p-connecte" }];
  reset();
  faireEchouer = ({ chemin, method }) =>
    method === "PATCH" && chemin.startsWith("/participants?id=") ? "Supabase indisponible" : null;
  res = await appeler();
  ok("profil totalement refusé : la réponse reste un succès", res.statusCode, 200);
  ok("profil totalement refusé : la passation est enregistrée",
    requetes.filter(estInsertionPassation).length, 1);

  // ---- En revanche, une passation non enregistrée doit bien échouer ----
  dossierTrouve = [{ id: "p-connecte" }];
  reset();
  faireEchouer = ({ chemin, method }) =>
    method === "POST" && chemin === "/attempts" ? "Supabase indisponible" : null;
  res = await appeler();
  ok("passation refusée : 500, le navigateur doit le savoir", res.statusCode, 500);

  console.log(fails ? `\n${fails} ASSERTION(S) EN ÉCHEC` : "\nTOUTES LES ASSERTIONS PASSENT");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
