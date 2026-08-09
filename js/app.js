(function () {
  "use strict";

  const STORAGE_KEY = "blessures-ame-quiz-v1";
  const TOTAL = QUIZ.length; // 50

  /** @type {{firstName: string, answers: (number|null)[], currentIndex: number}} */
  let state = {
    firstName: "",
    answers: new Array(TOTAL).fill(null),
    currentIndex: 0,
  };

  // ---------- Elements ----------
  const screens = {
    welcome: document.getElementById("screen-welcome"),
    quiz: document.getElementById("screen-quiz"),
    results: document.getElementById("screen-results"),
  };

  const startForm = document.getElementById("start-form");
  const firstNameInput = document.getElementById("first-name");
  const resumeBanner = document.getElementById("resume-banner");
  const resumeProgress = document.getElementById("resume-progress");
  const resumeBtn = document.getElementById("resume-btn");
  const discardBtn = document.getElementById("discard-btn");

  const progressFill = document.getElementById("progress-fill");
  const progressTrack = document.querySelector(".progress-track");
  const progressLabel = document.getElementById("progress-label");
  const woundPill = document.getElementById("wound-pill");
  const questionText = document.getElementById("question-text");
  const answerOptions = document.getElementById("answer-options");
  const prevBtn = document.getElementById("prev-btn");

  const dominantName = document.getElementById("dominant-name");
  const dominantMask = document.getElementById("dominant-mask");
  const dominantScore = document.getElementById("dominant-score");
  const scoreChart = document.getElementById("score-chart");
  const woundAccordion = document.getElementById("wound-accordion");
  const resultsTitle = document.getElementById("results-title");
  const bookingLink = document.getElementById("booking-link");
  const printBtn = document.getElementById("print-btn");
  const restartBtn = document.getElementById("restart-btn");

  // ---------- Persistence ----------
  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      /* stockage indisponible : on continue sans persistance */
    }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        Array.isArray(parsed.answers) &&
        parsed.answers.length === TOTAL
      ) {
        return parsed;
      }
    } catch (e) {
      /* ignore */
    }
    return null;
  }

  function clearState() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      /* ignore */
    }
  }

  function answeredCount(answers) {
    return answers.filter((a) => a !== null).length;
  }

  // ---------- Screen switching ----------
  function showScreen(name) {
    Object.entries(screens).forEach(([key, el]) => {
      const active = key === name;
      el.classList.toggle("active", active);
      el.setAttribute("aria-hidden", String(!active));
    });
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }

  // ---------- Welcome screen ----------
  function initWelcome() {
    const saved = loadState();
    if (saved && answeredCount(saved.answers) > 0) {
      const count = answeredCount(saved.answers);
      resumeProgress.textContent = `${count} / ${TOTAL} questions répondues`;
      resumeBanner.hidden = false;
      resumeBtn.onclick = () => {
        state = saved;
        firstNameInput.value = state.firstName || "";
        if (count === TOTAL) {
          renderResults();
          showScreen("results");
        } else {
          state.currentIndex = Math.min(state.currentIndex, TOTAL - 1);
          startQuizFromCurrent();
        }
      };
      discardBtn.onclick = () => {
        clearState();
        resumeBanner.hidden = true;
      };
    }
  }

  startForm.addEventListener("submit", (e) => {
    e.preventDefault();
    state = {
      firstName: firstNameInput.value.trim(),
      answers: new Array(TOTAL).fill(null),
      currentIndex: 0,
    };
    saveState();
    startQuizFromCurrent();
  });

  function startQuizFromCurrent() {
    showScreen("quiz");
    renderQuestion(state.currentIndex);
  }

  // ---------- Quiz screen ----------
  function renderQuestion(index) {
    state.currentIndex = index;
    const q = QUIZ[index];
    const wound = WOUNDS.find((w) => w.id === q.woundId);

    woundPill.textContent = wound.name;
    woundPill.style.background = wound.color;
    progressLabel.textContent = `Question ${index + 1} / ${TOTAL}`;

    const pct = Math.round((index / TOTAL) * 100);
    progressFill.style.width = pct + "%";
    progressTrack.setAttribute("aria-valuenow", String(index + 1));

    questionText.textContent = q.text;

    answerOptions.innerHTML = "";
    ANSWER_OPTIONS.forEach((opt) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "answer-btn";
      btn.textContent = `${opt.label}`;
      btn.dataset.value = String(opt.value);
      if (state.answers[index] === opt.value) {
        btn.classList.add("selected");
      }
      btn.addEventListener("click", () => selectAnswer(opt.value));
      answerOptions.appendChild(btn);
    });

    prevBtn.disabled = index === 0;
    prevBtn.style.visibility = index === 0 ? "hidden" : "visible";

    saveState();
  }

  function selectAnswer(value) {
    state.answers[state.currentIndex] = value;
    saveState();

    [...answerOptions.children].forEach((btn) => {
      btn.classList.toggle("selected", Number(btn.dataset.value) === value);
    });

    // petite pause visuelle avant de passer à la question suivante
    window.setTimeout(() => {
      if (state.currentIndex < TOTAL - 1) {
        renderQuestion(state.currentIndex + 1);
      } else {
        finishQuiz();
      }
    }, 220);
  }

  prevBtn.addEventListener("click", () => {
    if (state.currentIndex > 0) {
      renderQuestion(state.currentIndex - 1);
    }
  });

  document.addEventListener("keydown", (e) => {
    if (!screens.quiz.classList.contains("active")) return;
    if (["1", "2", "3"].includes(e.key)) {
      selectAnswer(Number(e.key));
    } else if (e.key === "ArrowLeft") {
      prevBtn.click();
    }
  });

  function finishQuiz() {
    progressFill.style.width = "100%";
    renderResults();
    showScreen("results");
  }

  // ---------- Scoring ----------
  function computeScores() {
    const raw = {};
    WOUNDS.forEach((w) => (raw[w.id] = 0));

    QUIZ.forEach((q, i) => {
      const value = state.answers[i] || 0;
      raw[q.woundId] += value;
    });

    // Chaque blessure repose sur 10 questions (max brut = 30),
    // ramenée sur 50 pour correspondre au barème de lecture du test.
    return WOUNDS.map((w) => {
      const rawScore = raw[w.id];
      const scaled = Math.round((rawScore / 30) * 50);
      return { wound: w, rawScore, score: scaled, level: levelFor(scaled) };
    });
  }

  // ---------- Results screen ----------
  function renderResults() {
    const results = computeScores().sort((a, b) => b.score - a.score);
    const top = results[0];

    resultsTitle.textContent = state.firstName
      ? `Résultats de ${state.firstName}`
      : "Tes résultats";

    dominantName.textContent = top.wound.name;
    dominantMask.textContent = `Masque : ${top.wound.mask}`;
    dominantScore.textContent = `Score : ${top.score} / 50 — ${top.level.label}`;

    renderChart(results);
    renderAccordion(results, top.wound.id);
    setupBookingLink(top, state.firstName);
  }

  function renderChart(results) {
    scoreChart.innerHTML = "";
    results.forEach((r) => {
      const row = document.createElement("div");
      row.className = "chart-row";

      const name = document.createElement("span");
      name.className = "name";
      name.textContent = r.wound.name;

      const track = document.createElement("div");
      track.className = "chart-track";
      const fill = document.createElement("div");
      fill.className = "chart-fill";
      fill.style.width = "0%";
      fill.style.background = r.wound.color;
      track.appendChild(fill);

      const value = document.createElement("span");
      value.className = "value";
      value.textContent = `${r.score}`;

      row.appendChild(name);
      row.appendChild(track);
      row.appendChild(value);
      scoreChart.appendChild(row);

      // anime la barre après insertion dans le DOM
      requestAnimationFrame(() => {
        fill.style.width = Math.min(100, (r.score / 50) * 100) + "%";
      });
    });
  }

  function renderAccordion(results, dominantId) {
    woundAccordion.innerHTML = "";

    results.forEach((r) => {
      const item = document.createElement("div");
      item.className = "accordion-item";
      const isDominant = r.wound.id === dominantId;
      if (isDominant) {
        item.classList.add("open");
        item.dataset.dominant = "true";
      }

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "accordion-toggle";
      toggle.innerHTML = `
        <span class="toggle-left">
          <span class="wound-swatch" style="background:${r.wound.color}"></span>
          <span>
            <strong>${r.wound.name}${isDominant ? " · dominante" : ""}</strong>
            <span class="toggle-meta">Masque ${r.wound.mask} — ${r.score}/50 (${r.level.label})</span>
          </span>
        </span>
        <span class="chev" aria-hidden="true">⌄</span>
      `;
      toggle.addEventListener("click", () => {
        item.classList.toggle("open");
      });

      const body = document.createElement("div");
      body.className = "accordion-body";
      body.innerHTML = `
        <h4>Besoins clés</h4>
        <p>${r.wound.needs}</p>
        <h4>Comprendre</h4>
        <p>${r.wound.understand}</p>
        <h4>Cela peut se traduire par</h4>
        <ul>${r.wound.signs.map((s) => `<li>${s}</li>`).join("")}</ul>
        <h4>3 actions pour te repositionner (dès cette semaine)</h4>
        <ol>${r.wound.actions.map((a) => `<li>${a}</li>`).join("")}</ol>
      `;

      item.appendChild(toggle);
      item.appendChild(body);
      woundAccordion.appendChild(item);
    });
  }

  function setupBookingLink(top, firstName) {
    const subject = "Demande de séance de coaching — Test des 5 blessures de l'âme";
    const greeting = firstName ? `Bonjour, je m'appelle ${firstName}.` : "Bonjour,";
    const body = [
      greeting,
      "",
      `J'ai réalisé le Test des 5 blessures de l'âme.`,
      `Ma blessure dominante ressort comme : ${top.wound.name} (masque ${top.wound.mask}), avec un score de ${top.score}/50.`,
      "",
      "Je souhaiterais réserver une séance d'accompagnement psychologique et spirituel.",
      "",
      "Merci !",
    ].join("\n");

    bookingLink.href =
      "mailto:nathanaeltalla@hotmail.com" +
      `?subject=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`;
  }

  printBtn.addEventListener("click", () => window.print());

  restartBtn.addEventListener("click", () => {
    clearState();
    state = {
      firstName: "",
      answers: new Array(TOTAL).fill(null),
      currentIndex: 0,
    };
    firstNameInput.value = "";
    resumeBanner.hidden = true;
    showScreen("welcome");
  });

  // ---------- Init ----------
  initWelcome();
  showScreen("welcome");
})();
