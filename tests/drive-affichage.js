// Les deux défauts d'affichage signalés par des utilisateurs, mesurés sur
// la géométrie réelle : un test fonctionnel ne les voit pas.
//
//   - le champ mot de passe était laissé sans style (le sélecteur CSS
//     oubliait input[type="password"]), donc beaucoup plus mince que le
//     champ e-mail juste au-dessus ;
//   - les fiches de blessure étaient rognées sur téléphone par un
//     max-height: 900px, sans aucun moyen d'atteindre la fin du texte.

const {
  ok, bilan, noterEchec, lancerNavigateur, nouvellePage,
  remplirFormulaire, repondre50,
} = require("./lib");

const BASE = "http://localhost:" + (process.argv[2] || 8700);

(async () => {
  const browser = await lancerNavigateur();
  const page = await nouvellePage(browser, BASE);

  // ===== 1. Le champ mot de passe a la même allure que le champ e-mail =====
  await page.click("#go-login-btn");
  await page.waitForSelector('#screen-login[aria-hidden="false"]');
  await page.waitForTimeout(300);

  const hauteurs = await page.evaluate(() => {
    const e = document.getElementById("password-login-email").getBoundingClientRect();
    const p = document.getElementById("password-login-password").getBoundingClientRect();
    return { email: Math.round(e.height), motDePasse: Math.round(p.height) };
  });
  ok(`champ mot de passe aussi haut que le champ e-mail (${hauteurs.email} px)`,
    hauteurs.motDePasse, hauteurs.email);

  // ===== 2. Le bouton œil révèle puis remasque =====
  await page.fill("#password-login-password", "MonSecret123");
  const champ = "#password-login-password";
  const bouton = "#password-login-form .password-reveal";

  ok("masqué au départ", await page.getAttribute(champ, "type"), "password");
  ok("bouton visible", await page.isVisible(bouton), true);
  ok("bouton dans la boîte du champ", await page.evaluate(() => {
    const c = document.querySelector("#password-login-password").getBoundingClientRect();
    const b = document.querySelector("#password-login-form .password-reveal").getBoundingClientRect();
    return b.right <= Math.ceil(c.right) && b.left >= c.left && b.top >= Math.floor(c.top);
  }), true);

  await page.click(bouton);
  await page.waitForTimeout(120);
  ok("après clic : mot de passe lisible", await page.getAttribute(champ, "type"), "text");
  ok("état annoncé aux lecteurs d'écran", await page.getAttribute(bouton, "aria-pressed"), "true");
  ok("libellé mis à jour", await page.getAttribute(bouton, "aria-label"), "Masquer le mot de passe");
  ok("la saisie est préservée", await page.inputValue(champ), "MonSecret123");

  await page.click(bouton);
  await page.waitForTimeout(120);
  ok("second clic : de nouveau masqué", await page.getAttribute(champ, "type"), "password");

  // Perdre le focus remasque : un mot de passe en clair sur un écran posé
  // sur une table n'aide personne.
  await page.click(bouton);
  await page.waitForTimeout(100);
  await page.click("#password-login-email");
  await page.waitForTimeout(150);
  ok("remasqué à la perte du focus", await page.getAttribute(champ, "type"), "password");

  // ===== 3. Le bulletin n'est pas rogné sur un écran de téléphone =====
  await page.goto(BASE + "/index.html", { waitUntil: "networkidle" });
  await page.waitForTimeout(250);
  await remplirFormulaire(page, {
    genre: "Femme", prenom: "Lectrice", nom: "Mobile",
    tel: "677001122", email: "lectrice@example.com",
  });
  await page.waitForSelector('#screen-quiz[aria-hidden="false"]', { timeout: 10000 });
  // Répondre « Oui » partout : les fiches les plus longues sont dépliées.
  await repondre50(page, 3);
  await page.waitForTimeout(500);

  // Une fiche dépliée dont le contenu dépasse sa boîte est du texte perdu :
  // l'enveloppe interne porte overflow:hidden, rien ne permet d'y accéder.
  const rognage = await page.evaluate(() =>
    [...document.querySelectorAll(".accordion-item.open")].map((item) => {
      const inner = item.querySelector(".accordion-inner");
      const body = item.querySelector(".accordion-body");
      return {
        blessure: item.querySelector("strong").textContent.split(" ·")[0],
        perdu: Math.max(0, Math.round(inner.scrollHeight - body.getBoundingClientRect().height)),
      };
    })
  );
  ok("aucune fiche dépliée n'est rognée",
    rognage.filter((r) => r.perdu > 2), []);
  ok("au moins une fiche est dépliée (le test a du sens)", rognage.length > 0, true);

  // Le texte de la dernière action doit être entièrement présent à l'écran.
  const derniereAction = await page.evaluate(() => {
    const item = document.querySelector(".accordion-item.open");
    const li = [...item.querySelectorAll("ol li")].pop();
    const r = li.getBoundingClientRect();
    const b = item.querySelector(".accordion-body").getBoundingClientRect();
    return { texte: li.textContent.trim().slice(-1), dansLaBoite: r.bottom <= b.bottom + 2 };
  });
  ok("la dernière action tient dans la fiche", derniereAction.dansLaBoite, true);
  ok("elle se termine par une ponctuation (texte complet)",
    [".", "!", "?"].includes(derniereAction.texte), true);

  // ===== 4. Dépliage / repliage toujours fonctionnel =====
  const ferme = await page.evaluate(() => {
    const item = [...document.querySelectorAll(".accordion-item")].find((i) => !i.classList.contains("open"));
    return !!item;
  });
  if (ferme) {
    await page.click(".accordion-item:not(.open) .accordion-toggle");
    await page.waitForTimeout(450);
    const ouvertApres = await page.evaluate(() => {
      const item = document.querySelector(".accordion-item.open:last-of-type");
      const inner = item.querySelector(".accordion-inner");
      return inner.getBoundingClientRect().height > 40;
    });
    ok("une fiche repliée s'ouvre au clic", ouvertApres, true);
  }

  if (page.__erreurs.length) noterEchec("erreurs console : " + page.__erreurs.join(" | "));
  await browser.close();
  process.exit(bilan() ? 1 : 0);
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
