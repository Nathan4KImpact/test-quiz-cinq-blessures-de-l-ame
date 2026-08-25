/**
 * Graphique d'évolution des 5 blessures dans le temps.
 *
 * Partagé entre le tableau de bord admin (admin.html) et l'écran de
 * résultats du participant (index.html) : les deux affichent exactement
 * la même lecture d'une progression, il ne doit donc y avoir qu'une seule
 * implémentation à faire évoluer.
 *
 * Dépend de WOUNDS (js/data.js), à charger avant ce fichier.
 */

// Correspondance blessure -> colonne de score telle que stockée en base.
const SCORE_FIELDS = {
  trahison: "score_trahison",
  rejet: "score_rejet",
  abandon: "score_abandon",
  humiliation: "score_humiliation",
  injustice: "score_injustice",
};

// Zones colorées de fond : dominante (40-50), modérée (29-39), peu
// présente (20-28), peu marquée (<20). Le lecteur peut ainsi lire à
// quelle catégorie appartient chaque score sans se référer à la légende.
const SEVERITY_BANDS = [
  { min: 40, max: 50, color: "rgba(194, 71, 139, 0.10)", textColor: "#a13570", label: "Dominante" },
  { min: 29, max: 40, color: "rgba(217, 140, 63, 0.10)", textColor: "#a05e1e", label: "Modérée" },
  { min: 20, max: 29, color: "rgba(124, 159, 191, 0.10)", textColor: "#4d7290", label: "Peu présente" },
  { min: 0, max: 20, color: "rgba(154, 168, 154, 0.10)", textColor: "#5f6f5f", label: "Peu marquée" },
];

function evolutionFormatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// Ne conserve que les passations comprises dans la fenêtre demandée.
// range : "all" ou un nombre de mois ("1", "6", "12", "36", "60").
function filterAttemptsByRange(attempts, range) {
  if (range === "all") return attempts;
  const months = Number(range);
  if (!months) return attempts;
  const cutoff = Date.now() - months * 30 * 24 * 3600 * 1000;
  return attempts.filter((a) => new Date(a.taken_at).getTime() >= cutoff);
}

/**
 * Construit le SVG du graphique d'évolution.
 * @param {Array} attempts passations déjà filtrées, triées par date croissante
 * @returns {string} markup SVG, ou chaîne vide si aucune donnée
 */
function buildEvolutionChartSvg(attempts) {
  if (!attempts || attempts.length === 0) return "";

  const width = 640;
  const height = 280;
  // Colonne de gauche élargie pour accueillir les libellés des zones de
  // sévérité, en plus des repères d'axe.
  const padL = 96;
  const padR = 16;
  const padT = 16;
  // padB agrandi car les libellés de date sont en oblique et occupent
  // plus de hauteur qu'un simple texte horizontal.
  const padB = 44;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const dates = attempts.map((a) => new Date(a.taken_at).getTime());
  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);
  const dateSpan = maxDate - minDate || 1;

  function x(i) {
    if (attempts.length === 1) return padL + innerW / 2;
    return padL + ((dates[i] - minDate) / dateSpan) * innerW;
  }
  function y(score) {
    return padT + innerH - (score / 50) * innerH;
  }

  // Bandes de fond + libellé de sévérité horizontal dans la gouttière
  // gauche, centré verticalement sur la bande et aligné à droite juste
  // avant les repères de l'axe Y (les nombres 0/20/29/40/50 restent
  // visibles). Un léger décalage vertical évite le chevauchement quand le
  // milieu d'une bande tombe sur un repère d'axe.
  const LABEL_X = padL - 22;
  const AXIS_MARKS = [0, 20, 29, 40, 50];
  const bands = SEVERITY_BANDS.map((b) => {
    const yTop = y(b.max);
    const yBot = y(b.min);
    const yMid = (yTop + yBot) / 2;
    const bandHeight = yBot - yTop;
    const rect = `<rect x="${padL}" y="${yTop}" width="${innerW}" height="${bandHeight}" fill="${b.color}" />`;
    let labelY = yMid + 3;
    if (AXIS_MARKS.some((score) => Math.abs(y(score) - yMid) < 8)) {
      labelY = yMid - 6;
    }
    const label = `<text x="${LABEL_X}" y="${labelY}" font-size="10" font-weight="700" fill="${b.textColor}" text-anchor="end">${b.label}</text>`;
    return rect + label;
  }).join("");

  const gridLines = AXIS_MARKS.map(
    (score) =>
      `<line x1="${padL}" y1="${y(score)}" x2="${width - padR}" y2="${y(score)}" stroke="#e0d0d8" stroke-width="1" stroke-dasharray="2,2" />` +
      `<text x="${padL - 8}" y="${y(score) + 3}" font-size="9" fill="#9c8896" text-anchor="end">${score}</text>`
  ).join("");

  let paths = "";
  WOUNDS.forEach((w) => {
    const field = SCORE_FIELDS[w.id];
    const points = attempts.map((a, i) => `${x(i)},${y(a[field])}`).join(" ");
    if (attempts.length === 1) {
      const [px, py] = points.split(",");
      paths += `<circle cx="${px}" cy="${py}" r="4" fill="${w.color}" />`;
    } else {
      paths += `<polyline points="${points}" fill="none" stroke="${w.color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />`;
      attempts.forEach((a, i) => {
        paths += `<circle cx="${x(i)}" cy="${y(a[field])}" r="3" fill="${w.color}" />`;
      });
    }
  });

  // Labels de date en oblique (~30°). L'axe étant temporel, deux tests
  // rapprochés dans le temps produisent des points très proches : on
  // n'affiche une date que si elle est assez éloignée de la précédente
  // affichée, sinon les libellés se chevauchent malgré l'inclinaison.
  // La dernière date est toujours affichée (elle borne la lecture) ;
  // si elle est trop proche de la précédente, c'est cette dernière qui
  // cède la place.
  const MIN_LABEL_GAP = 46;
  const labelIndexes = [];
  attempts.forEach((a, i) => {
    const isLast = i === attempts.length - 1;
    const prev = labelIndexes.length ? labelIndexes[labelIndexes.length - 1] : null;
    if (prev === null || x(i) - x(prev) >= MIN_LABEL_GAP) {
      labelIndexes.push(i);
    } else if (isLast) {
      labelIndexes[labelIndexes.length - 1] = i;
    }
  });

  const dateLabels = labelIndexes
    .map((i) => {
      const anchorX = x(i);
      const anchorY = height - padB + 16;
      return `<text x="${anchorX}" y="${anchorY}" font-size="9" fill="#9c8896" text-anchor="end" transform="rotate(-30 ${anchorX} ${anchorY})">${evolutionFormatDate(attempts[i].taken_at)}</text>`;
    })
    .join("");

  return `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Évolution des blessures de l'âme dans le temps">
      ${bands}
      ${gridLines}
      ${paths}
      ${dateLabels}
    </svg>
  `;
}

// Légende des 5 blessures, commune aux deux usages du graphique.
function buildEvolutionLegendHtml() {
  return WOUNDS.map(
    (w) => `<span><i class="dot" style="background:${w.color}"></i> ${w.name}</span>`
  ).join("");
}
