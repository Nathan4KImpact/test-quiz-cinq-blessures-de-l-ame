// Recalcule les scores côté serveur à partir des réponses brutes, pour ne
// jamais faire confiance à des scores calculés côté client.

const WOUND_IDS = ["trahison", "rejet", "abandon", "humiliation", "injustice"];

function questionWoundId(index) {
  return WOUND_IDS[Math.floor(index / 10)];
}

function isValidAnswers(answers) {
  return (
    Array.isArray(answers) &&
    answers.length === 50 &&
    answers.every((a) => a === 1 || a === 2 || a === 3)
  );
}

function computeScores(answers) {
  const raw = { trahison: 0, rejet: 0, abandon: 0, humiliation: 0, injustice: 0 };
  for (let i = 0; i < 50; i++) {
    raw[questionWoundId(i)] += answers[i];
  }

  const scaled = {};
  WOUND_IDS.forEach((id) => {
    scaled[id] = Math.round((raw[id] / 30) * 50);
  });

  const maxScore = Math.max(...Object.values(scaled));
  const dominant = WOUND_IDS.filter((id) => scaled[id] === maxScore);

  return { raw, scaled, dominant };
}

module.exports = { WOUND_IDS, computeScores, isValidAnswers };
