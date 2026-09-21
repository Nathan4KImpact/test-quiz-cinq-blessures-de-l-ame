// Rend un document HTML local en PDF, à l'identique de ce qu'affiche le
// navigateur — mêmes couleurs, mêmes cadres, mêmes polices.
//
// Deux précautions :
//   - toutes les réponses repliées sont ouvertes avant le rendu, sinon le PDF
//     est un document à trous et rien ne le signale ;
//   - on attend le chargement des polices, faute de quoi la première page
//     peut partir avec une police de repli.
//
// Usage : node en-pdf.js <source.html> <sortie.pdf>

const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const path = require("path");

const CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

(async () => {
  const [src, dest] = process.argv.slice(2);
  const navigateur = await chromium.launch({ executablePath: CHROME });
  const page = await navigateur.newPage();

  const avertissements = [];
  page.on("requestfailed", (r) => avertissements.push(r.url()));

  await page.goto("file://" + path.resolve(src), { waitUntil: "networkidle" });

  await page.evaluate(async () => {
    document.querySelectorAll("details").forEach((d) => (d.open = true));
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
  });

  await page.pdf({
    path: dest,
    format: "A4",
    printBackground: true,
    margin: { top: "16mm", bottom: "16mm", left: "15mm", right: "15mm" },
  });

  await navigateur.close();

  if (avertissements.length) {
    console.log(
      `  ${avertissements.length} requête(s) sortante(s) en échec ` +
        `(polices distantes ?) — le PDF utilise alors une police de repli.`
    );
  }
  console.log(`${dest} écrit`);
})().catch((e) => {
  console.error("ÉCHEC", e.message);
  process.exit(1);
});
