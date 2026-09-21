// Garde-fou contre la dérive entre sql/schema.sql et sql/migrations/.
//
// Pourquoi ce test existe : schema.sql sert aux INSTALLATIONS NEUVES,
// les migrations aux bases DÉJÀ EN SERVICE. Les deux décrivent la même
// cible, mais seules les migrations sont exécutées au quotidien — donc
// seules elles sont vérifiées par l'usage. schema.sql peut prendre
// plusieurs versions de retard sans que rien ne le signale, et ne se
// venge qu'au jour où quelqu'un recrée la base : nouvel environnement,
// restauration, projet de secours. C'est arrivé : quatre migrations
// d'écart, dont l'inversion de la clé d'identité.
//
// Le test ne parle pas à Postgres ; il compare deux fichiers texte.

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

const schema = fs.readFileSync(path.join(ROOT, "sql/schema.sql"), "utf8");

const dossierMigrations = path.join(ROOT, "sql/migrations");
const migrations = fs
  .readdirSync(dossierMigrations)
  .filter((f) => f.endsWith(".sql"))
  .sort();

// ---------- Ce que schema.sql déclare ----------
// Une entrée par « create table if not exists <nom> ( … ) ».
function tablesDeclarees(sql) {
  const tables = {};
  const re = /create table if not exists\s+(\w+)\s*\(([\s\S]*?)\n\);/gi;
  let m;
  while ((m = re.exec(sql))) {
    tables[m[1]] = m[2]
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("--"))
      .map((l) => (l.match(/^(\w+)/) || [])[1])
      .filter(Boolean);
  }
  return tables;
}

const tables = tablesDeclarees(schema);

console.log("--- tables déclarées par schema.sql ---");
for (const [nom, colonnes] of Object.entries(tables)) {
  console.log(`     ${nom} (${colonnes.length} colonnes)`);
}
ok("schema.sql déclare au moins une table", Object.keys(tables).length > 0, true);

// ---------- Tout ce qu'ajoute une migration doit s'y retrouver ----------
console.log("\n--- correspondance migrations -> schema.sql ---");

for (const fichier of migrations) {
  const sql = fs.readFileSync(path.join(dossierMigrations, fichier), "utf8");

  // Colonnes ajoutées : « alter table <table> add column if not exists <col> »
  const reColonne = /alter table\s+(\w+)\s+add column if not exists\s+(\w+)/gi;
  let m;
  while ((m = reColonne.exec(sql))) {
    const [, table, colonne] = m;
    ok(
      `${fichier} : ${table}.${colonne} présent dans schema.sql`,
      (tables[table] || []).includes(colonne),
      true
    );
  }

  // Tables créées par une migration.
  const reTable = /create table if not exists\s+(\w+)/gi;
  while ((m = reTable.exec(sql))) {
    ok(
      `${fichier} : table ${m[1]} présente dans schema.sql`,
      Object.prototype.hasOwnProperty.call(tables, m[1]),
      true
    );
  }
}

// ---------- La clé d'identité, dans le bon sens ----------
// La migration 006 a inversé les rôles. Une réinstallation qui repartirait
// sur un téléphone unique rejouerait le défaut qu'elle a corrigé : un
// enfant ne pourrait plus passer le test avec le numéro d'un parent.
console.log("\n--- clé d'identité (état post-006) ---");
const participants = (schema.match(
  /create table if not exists\s+participants\s*\(([\s\S]*?)\n\);/i
) || [])[1] || "";

ok("l'e-mail est unique", /email\s+text\s+not null\s+unique/i.test(participants), true);
ok("le téléphone est obligatoire", /phone\s+text\s+not null/i.test(participants), true);
ok(
  "le téléphone n'est PAS unique",
  /phone\s+text\s+not null\s+unique/i.test(participants),
  false
);

// ---------- RLS sur chaque table ----------
// Défense en profondeur : une table oubliée ici serait lisible par la clé
// anon si elle venait à fuiter.
console.log("\n--- RLS ---");
for (const nom of Object.keys(tables)) {
  ok(
    `RLS activé sur ${nom}`,
    new RegExp(`alter table\\s+${nom}\\s+enable row level security`, "i").test(schema),
    true
  );
}

console.log(fails ? `\n${fails} ASSERTION(S) EN ÉCHEC` : "\nTOUTES LES ASSERTIONS PASSENT");
process.exit(fails ? 1 : 0);
