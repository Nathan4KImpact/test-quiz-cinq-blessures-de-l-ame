// Hachage des mots de passe participants, sans dépendance npm.
//
// scrypt (intégré à Node) plutôt qu'un simple SHA : un hachage rapide se
// casse par force brute à des milliards d'essais par seconde sur du
// matériel courant, alors que scrypt est délibérément coûteux en temps
// ET en mémoire, ce qui rend l'attaque hors ligne sans intérêt même si
// la base venait à fuiter.

const crypto = require("crypto");

// Paramètres de coût. N=16384 tient dans les limites mémoire d'une
// fonction serverless (≈16 Mo) tout en coûtant ~100 ms par essai.
const N = 16384;
const R = 8;
const P = 1;
const KEY_LEN = 64;
const SALT_LEN = 16;

const MIN_LENGTH = 8;
const MAX_LENGTH = 200;

function isValidPassword(password) {
  return (
    typeof password === "string" &&
    password.length >= MIN_LENGTH &&
    password.length <= MAX_LENGTH
  );
}

function scrypt(password, salt) {
  return new Promise((resolve, reject) => {
    // maxmem doit couvrir 128 * N * r, sinon Node refuse ces paramètres.
    crypto.scrypt(password, salt, KEY_LEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 },
      (err, derived) => (err ? reject(err) : resolve(derived)));
  });
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(SALT_LEN);
  const derived = await scrypt(password, salt);
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${derived.toString("base64")}`;
}

/**
 * Vérifie un mot de passe contre une empreinte stockée.
 * Renvoie false — jamais d'exception — si l'empreinte est absente ou
 * illisible : l'appelant traite tous les échecs de la même manière.
 */
async function verifyPassword(password, stored) {
  if (typeof stored !== "string" || !stored.startsWith("scrypt$")) return false;
  const parts = stored.split("$");
  if (parts.length !== 6) return false;

  const [, n, r, p, saltB64, hashB64] = parts;
  try {
    const salt = Buffer.from(saltB64, "base64");
    const expected = Buffer.from(hashB64, "base64");
    const derived = await new Promise((resolve, reject) => {
      crypto.scrypt(
        password,
        salt,
        expected.length,
        { N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024 },
        (err, out) => (err ? reject(err) : resolve(out))
      );
    });
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch (e) {
    return false;
  }
}

module.exports = { hashPassword, verifyPassword, isValidPassword, MIN_LENGTH };
