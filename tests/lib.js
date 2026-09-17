// Assertions et utilitaires partagés par les suites de test.
//
// Volontairement minimal : pas de framework, pas de dépendance npm — le
// projet n'en a aucune, ses tests non plus.

const PW = "/opt/node22/lib/node_modules/playwright";
const CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

let fails = 0;

function ok(label, actual, expected) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) fails += 1;
  console.log(
    `${pass ? "OK  " : "FAIL"} ${label}: ${JSON.stringify(actual)}` +
      (pass ? "" : ` | attendu ${JSON.stringify(expected)}`)
  );
  return pass;
}

function bilan() {
  console.log(fails ? `\n${fails} ASSERTION(S) EN ÉCHEC` : "\nTOUTES LES ASSERTIONS PASSENT");
  return fails;
}

function noterEchec(message) {
  fails += 1;
  console.log(`FAIL ${message}`);
}

async function lancerNavigateur() {
  const { chromium } = require(PW);
  return chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
}

// Page « téléphone » par défaut : c'est là que les défauts d'affichage
// signalés se manifestent, une page large les masque.
async function nouvellePage(browser, base, viewport) {
  const ctx = await browser.newContext({ viewport: viewport || { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const erreurs = [];
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("401") && !m.text().includes("403")) {
      erreurs.push(m.text());
    }
  });
  page.on("pageerror", (e) => erreurs.push("pageerror: " + e.message));
  page.__erreurs = erreurs;
  await page.goto(base + "/index.html", { waitUntil: "networkidle" });
  await page.waitForTimeout(250);
  return page;
}

const post = (page, base, chemin, corps) =>
  page.evaluate(
    async (a) => {
      const r = await fetch(a.b + a.p, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(a.corps),
      });
      return { status: r.status, body: await r.json().catch(() => ({})) };
    },
    { b: base, p: chemin, corps }
  );

// Remplit le formulaire d'accueil. Aucun mot de passe : le formulaire n'en
// demande plus depuis la livraison #25.
async function remplirFormulaire(page, profil) {
  await page.click(`.gender-option:has-text("${profil.genre}") input`);
  await page.fill("#first-name", profil.prenom);
  await page.fill("#last-name", profil.nom);
  await page.selectOption("#phone-country", profil.indicatif || "+33");
  await page.fill("#phone", profil.tel);
  await page.fill("#email", profil.email);
  if (profil.ville) await page.fill("#city", profil.ville);
  await page.check("#consent");
  await page.click("#start-form button[type=submit]");
}

async function repondre50(page, choix) {
  for (let i = 0; i < 50; i++) {
    await page.click(`#answer-options .answer-btn:nth-child(${choix || 2})`);
    await page.waitForTimeout(255);
  }
  await page.waitForSelector('#screen-results[aria-hidden="false"]', { timeout: 25000 });
  await page.waitForTimeout(350);
}

module.exports = {
  ok, bilan, noterEchec, lancerNavigateur, nouvellePage,
  post, remplirFormulaire, repondre50,
};
