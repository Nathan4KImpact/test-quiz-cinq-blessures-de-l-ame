/**
 * Détection des progrès d'une personne entre deux passations.
 *
 * L'objectif est de féliciter un mouvement réel et lisible : une blessure
 * qui change de palier (dominante -> modérée, modérée -> peu présente…)
 * ou, à défaut, un score qui recule nettement. Partagé entre l'écran de
 * résultats (index.html) et le rapport rejoué côté admin (admin.html).
 *
 * Dépend de WOUNDS et levelFor (js/data.js) ainsi que de SCORE_FIELDS
 * (js/evolution-chart.js), à charger avant ce fichier.
 */

// Du plus sévère au moins sévère. Un rang qui baisse = un progrès.
const TIER_RANK = { high: 3, moderate: 2, low: 1, minimal: 0 };

// Libellés courts pour la phrase de félicitations ("passée de dominante
// à modérée"), là où levelFor() renvoie la forme longue de la fiche.
const TIER_SHORT = {
  high: "dominante",
  moderate: "modérée",
  low: "peu présente",
  minimal: "peu marquée",
};

// Un point brut du questionnaire vaut ~1,67 point sur 50 : en dessous de
// 3 points d'écart, la variation peut tenir à une seule réponse et ne
// mérite pas d'être annoncée comme un progrès.
const MIN_SCORE_DROP = 3;

function tierOf(score) {
  return levelFor(score).tier;
}

// Compare deux passations et liste ce qui s'est amélioré.
function compareAttempts(before, after) {
  const bandDrops = [];
  const scoreDrops = [];
  let totalBefore = 0;
  let totalAfter = 0;

  WOUNDS.forEach((w) => {
    const from = before[SCORE_FIELDS[w.id]];
    const to = after[SCORE_FIELDS[w.id]];
    if (typeof from !== "number" || typeof to !== "number") return;
    totalBefore += from;
    totalAfter += to;

    const fromTier = tierOf(from);
    const toTier = tierOf(to);
    if (TIER_RANK[toTier] < TIER_RANK[fromTier]) {
      bandDrops.push({ wound: w, fromScore: from, toScore: to, fromTier, toTier });
    } else if (from - to >= MIN_SCORE_DROP) {
      scoreDrops.push({ wound: w, fromScore: from, toScore: to, delta: from - to });
    }
  });

  // Les mouvements les plus forts en premier : c'est la bonne nouvelle
  // principale qu'on veut lire en tête.
  bandDrops.sort((a, b) => b.fromScore - b.toScore - (a.fromScore - a.toScore));
  scoreDrops.sort((a, b) => b.delta - a.delta);

  return { bandDrops, scoreDrops, totalBefore, totalAfter };
}

function hasProgress(cmp) {
  return cmp.bandDrops.length > 0 || cmp.scoreDrops.length > 0;
}

/**
 * Cherche un progrès à célébrer pour la passation affichée.
 *
 * On regarde d'abord le test précédent (le mouvement le plus parlant :
 * « depuis la dernière fois »). Si rien n'a bougé à cette échelle, on
 * élargit au tout premier test, car un progrès lent reste un progrès.
 *
 * @param {Array} attempts historique complet, trié par date croissante
 * @param {number|null} attemptNumber passation affichée (défaut : la dernière)
 * @returns {Object|null} { scope, bandDrops, scoreDrops, totalBefore, totalAfter }
 */
function detectProgress(attempts, attemptNumber) {
  if (!Array.isArray(attempts) || attempts.length < 2) return null;

  let index = attempts.length - 1;
  if (attemptNumber) {
    const found = attempts.findIndex((a) => a.attempt_number === attemptNumber);
    if (found === -1) return null;
    index = found;
  }
  // Le tout premier test n'a rien à quoi se comparer.
  if (index < 1) return null;

  const current = attempts[index];

  const vsPrevious = compareAttempts(attempts[index - 1], current);
  if (hasProgress(vsPrevious)) return { scope: "previous", ...vsPrevious };

  if (index >= 2) {
    const vsFirst = compareAttempts(attempts[0], current);
    if (hasProgress(vsFirst)) return { scope: "first", ...vsFirst };
  }

  return null;
}

// Phrase de contexte : par rapport à quoi le progrès est mesuré.
function progressScopeLabel(scope) {
  return scope === "first" ? "depuis le tout premier test" : "depuis le test précédent";
}

/**
 * Construit le contenu HTML du bandeau de félicitations.
 * @param {Object} progress résultat de detectProgress()
 * @param {string} [firstName] prénom, pour personnaliser l'accroche
 */
function buildProgressHtml(progress, firstName) {
  if (!progress) return "";

  const name = (firstName || "").trim();
  const headline = progress.bandDrops.length
    ? `Félicitations${name ? " " + escapeProgressHtml(name) : ""} !`
    : `Beau mouvement${name ? ", " + escapeProgressHtml(name) : ""} !`;

  const lines = [
    ...progress.bandDrops.map(
      (d) =>
        `<strong>${d.wound.name}</strong> passe de <em>${TIER_SHORT[d.fromTier]}</em> ` +
        `à <em>${TIER_SHORT[d.toTier]}</em> (${d.fromScore} → ${d.toScore} / 50).`
    ),
    ...progress.scoreDrops.map(
      (d) =>
        `<strong>${d.wound.name}</strong> recule de ${d.delta} point${d.delta > 1 ? "s" : ""} ` +
        `(${d.fromScore} → ${d.toScore} / 50).`
    ),
  ];

  return `
    <p class="progress-headline">🎉 ${headline}</p>
    <p class="progress-lead">Le travail accompli se voit ${progressScopeLabel(progress.scope)} :</p>
    <ul class="progress-list">${lines.map((l) => `<li>${l}</li>`).join("")}</ul>
    <p class="progress-foot">Chaque pas compte : continuer à refaire le test régulièrement rend ces déplacements visibles.</p>
  `;
}

function escapeProgressHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}
