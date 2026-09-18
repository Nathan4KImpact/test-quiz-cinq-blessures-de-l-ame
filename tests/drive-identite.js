// L'e-mail est devenu la clé d'identité (migration 006), le téléphone ne
// l'est plus. Cette suite vérifie les deux faces de ce basculement :
// ce qui devient permis, et ce qui reste interdit.

const {
  ok, bilan, noterEchec, lancerNavigateur, nouvellePage,
  post, remplirFormulaire, repondre50,
} = require("./lib");

const BASE = "http://localhost:" + (process.argv[2] || 8700);

(async () => {
  const browser = await lancerNavigateur();
  const page = await nouvellePage(browser, BASE);

  // ===== 1. Le formulaire ne demande plus de mot de passe =====
  ok("aucun champ mot de passe à l'accueil",
    await page.evaluate(() => !!document.getElementById("signup-password")), false);

  // ===== 2. Réutiliser le téléphone d'un proche est désormais permis =====
  // +33612345678 est le numéro de Marie ET de Jean dans le jeu de test.
  await remplirFormulaire(page, {
    genre: "Femme", prenom: "Fille", nom: "Dupont",
    tel: "612345678", email: "fille@example.com",
  });
  await page.waitForSelector('#screen-quiz[aria-hidden="false"]', { timeout: 10000 });
  ok("téléphone d'un proche : le test démarre sans blocage", true, true);
  await repondre50(page);
  ok("passation enregistrée sur un dossier neuf",
    await page.evaluate(() => document.getElementById("attempt-meta").textContent.trim()
      .startsWith("Test passé : 1")), true);
  ok("aucun avertissement d'enregistrement",
    await page.evaluate(() => document.getElementById("save-warning").hidden), true);

  // La session s'ouvre à la création : l'espace est accessible aussitôt.
  await page.click("#account-entry");
  await page.waitForSelector('#screen-account[aria-hidden="false"]', { timeout: 8000 });
  ok("session ouverte dès la création du dossier",
    await page.textContent("#account-title"), "Espace de Fille");
  ok("carte mot de passe mise en avant (aucun défini)",
    await page.textContent("#account-password-title"), "Définir un mot de passe");
  await post(page, BASE, "/api/auth/logout", {});

  // ===== 3. Réutiliser l'e-mail d'autrui reste verrouillé =====
  await page.goto(BASE + "/index.html", { waitUntil: "networkidle" });
  await page.waitForTimeout(250);
  await remplirFormulaire(page, {
    genre: "Femme", prenom: "Curieuse", nom: "Indiscrète",
    tel: "699887766", email: "marie@example.com",
  });
  await page.waitForSelector('#screen-login[aria-hidden="false"]', { timeout: 8000 });
  ok("le test ne démarre pas",
    await page.getAttribute("#screen-quiz", "aria-hidden"), "true");
  ok("titre en mode verrou", await page.textContent("#login-title"), "Ce dossier existe déjà");
  ok("aucune donnée du dossier visé sur la page",
    /Marie/.test(await page.evaluate(() => document.body.innerText)), false);
  ok("aucun historique chargé",
    await page.evaluate(() => document.querySelectorAll("#history-tbody tr").length), 0);

  // ===== 4. L'API refuse la même chose sans passer par l'écran =====
  const answers = new Array(50).fill(1);
  const forge = await post(page, BASE, "/api/submit", {
    gender: "femme", firstName: "Curieuse", lastName: "X", email: "marie@example.com",
    phone: "+33699887766", consent: true, answers,
  });
  ok("requête forgée refusée", forge.status, 403);
  ok("motif explicite", forge.body.requiresAuth, true);
  ok("aucun historique dans la réponse", forge.body.history, undefined);

  // Le même envoi avec le téléphone de quelqu'un d'autre, mais une adresse
  // libre, doit passer : c'est exactement ce que la migration 006 autorise.
  const legit = await post(page, BASE, "/api/submit", {
    gender: "homme", firstName: "Frere", lastName: "Dupont", email: "frere@example.com",
    phone: "+33612345678", consent: true, answers,
  });
  ok("téléphone partagé + adresse libre : accepté", legit.status, 200);
  // Cette passation a ouvert une session pour le dossier qu'elle vient de
  // créer : on la referme, sinon l'écran d'accueil ne s'affiche plus.
  await post(page, BASE, "/api/auth/logout", {});

  // ===== 5. Marie lève le verrou avec son mot de passe =====
  await page.goto(BASE + "/index.html", { waitUntil: "networkidle" });
  await page.waitForTimeout(250);
  await remplirFormulaire(page, {
    genre: "Femme", prenom: "Marie", nom: "Dupont",
    tel: "612345678", email: "marie@example.com",
  });
  await page.waitForSelector('#screen-login[aria-hidden="false"]', { timeout: 8000 });
  ok("adresse reportée dans le formulaire de connexion",
    await page.inputValue("#password-login-email"), "marie@example.com");
  await page.fill("#password-login-password", "MotDePasseMarie");
  await page.click("#password-login-form button[type=submit]");
  await page.waitForSelector('#screen-quiz[aria-hidden="false"]', { timeout: 10000 });
  await repondre50(page);
  ok("5e passation sur le dossier de Marie",
    await page.evaluate(() => document.getElementById("attempt-meta").textContent.trim()
      .startsWith("Test passé : 5")), true);
  await post(page, BASE, "/api/auth/logout", {});

  // ===== 6. Jean n'a pas de mot de passe : le code e-mail prend le relais =====
  await page.goto(BASE + "/index.html", { waitUntil: "networkidle" });
  await page.waitForTimeout(250);
  await remplirFormulaire(page, {
    genre: "Homme", prenom: "Jean", nom: "Martin",
    tel: "612345678", email: "jean@example.com",
  });
  await page.waitForSelector('#screen-login[aria-hidden="false"]', { timeout: 8000 });
  await page.click("#go-code-btn");
  await page.waitForSelector("#request-code-form:not([hidden])");
  ok("adresse reportée vers le formulaire de code",
    await page.inputValue("#login-email"), "jean@example.com");
  await page.click("#request-code-form button[type=submit]");
  await page.waitForSelector("#verify-code-form:not([hidden])");
  const code = await page.evaluate(async (b) =>
    (await (await fetch(b + "/api/__lastcode")).json()).code, BASE);
  await page.fill("#login-code", code);
  await page.click("#verify-code-form button[type=submit]");
  await page.waitForSelector('#screen-quiz[aria-hidden="false"]', { timeout: 10000 });
  ok("le code e-mail lève le verrou et enchaîne sur le test", true, true);

  if (page.__erreurs.length) noterEchec("erreurs console : " + page.__erreurs.join(" | "));
  await browser.close();
  process.exit(bilan() ? 1 : 0);
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
