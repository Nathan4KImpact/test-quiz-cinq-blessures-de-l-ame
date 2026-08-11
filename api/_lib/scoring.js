// Recalcule les scores côté serveur à partir des réponses brutes, pour ne
// jamais faire confiance à des scores calculés côté client.

const WOUND_IDS = ["trahison", "rejet", "abandon", "humiliation", "injustice"];

function questionWoundId(index) {
  return WOUND_IDS[Math.floor(index / 10)];
}

// Tolère les valeurs envoyées comme chaînes ("1") en plus des nombres (1) :
// le format exact du JSON transmis ne doit pas faire échouer une réponse
// par ailleurs valide.
function normalizeAnswerValue(a) {
  const n = typeof a === "string" ? Number(a) : a;
  return n === 1 || n === 2 || n === 3 ? n : null;
}

function isValidAnswers(answers) {
  return (
    Array.isArray(answers) &&
    answers.length === 50 &&
    answers.every((a) => normalizeAnswerValue(a) !== null)
  );
}

// Pour le diagnostic : explique pourquoi des réponses sont jugées invalides.
function describeAnswersProblem(answers) {
  if (!Array.isArray(answers)) return `answers n'est pas un tableau (type: ${typeof answers})`;
  if (answers.length !== 50) return `longueur ${answers.length} au lieu de 50`;
  const badIndexes = [];
  answers.forEach((a, i) => {
    if (normalizeAnswerValue(a) === null) badIndexes.push(`#${i}=${JSON.stringify(a)}`);
  });
  if (badIndexes.length > 0) {
    return `valeurs invalides : ${badIndexes.slice(0, 5).join(", ")}${badIndexes.length > 5 ? "…" : ""}`;
  }
  return "raison inconnue";
}

function computeScores(answers) {
  const raw = { trahison: 0, rejet: 0, abandon: 0, humiliation: 0, injustice: 0 };
  for (let i = 0; i < 50; i++) {
    raw[questionWoundId(i)] += normalizeAnswerValue(answers[i]);
  }

  const scaled = {};
  WOUND_IDS.forEach((id) => {
    scaled[id] = Math.round((raw[id] / 30) * 50);
  });

  const maxScore = Math.max(...Object.values(scaled));
  const dominant = WOUND_IDS.filter((id) => scaled[id] === maxScore);

  return { raw, scaled, dominant };
}

module.exports = { WOUND_IDS, computeScores, isValidAnswers, describeAnswersProblem };
