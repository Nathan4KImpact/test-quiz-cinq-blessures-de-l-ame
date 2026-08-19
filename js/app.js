(function () {
  "use strict";

  const STORAGE_KEY = "blessures-ame-quiz-v3";
  const TOTAL = QUIZ.length; // 50
  const SUBMIT_TIMEOUT_MS = 7000;

  /**
   * @typedef {Object} State
   * @property {string} firstName
   * @property {string} lastName
   * @property {string} email
   * @property {string} phone
   * @property {string} city
   * @property {string} postalCode
   * @property {(number|null)[]} answers
   * @property {number} currentIndex
   * @property {number|null} attemptNumber
   */
  let state = emptyState();

  function emptyState() {
    return {
      gender: "",
      firstName: "",
      lastName: "",
      email: "",
      phoneCountry: DEFAULT_PHONE_COUNTRY,
      phoneNational: "",
      phone: "",
      city: "",
      postalCode: "",
      answers: new Array(TOTAL).fill(null),
      currentIndex: 0,
      attemptNumber: null,
      // Passations précédentes de cette personne, renvoyées par /api/submit
      // pour alimenter le graphique d'évolution et l'historique.
      history: [],
    };
  }

  // ---------- Elements ----------
  const screens = {
    welcome: document.getElementById("screen-welcome"),
    quiz: document.getElementById("screen-quiz"),
    results: document.getElementById("screen-results"),
  };

  const startForm = document.getElementById("start-form");
  const genderInputs = document.querySelectorAll('input[name="gender"]');
  const verseWelcome = document.getElementById("verse-text-welcome");
  const verseResults = document.getElementById("verse-text-results");
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  const firstNameInput = document.getElementById("first-name");
  const lastNameInput = document.getElementById("last-name");
  const emailInput = document.getElementById("email");
  const phoneInput = document.getElementById("phone");
  const phoneCountrySelect = document.getElementById("phone-country");
  const cityInput = document.getElementById("city");
  const postalCodeInput = document.getElementById("postal-code");
  const consentInput = document.getElementById("consent");
  const startSubmitBtn = startForm.querySelector("button[type=submit]");
  const resumeBanner = document.getElementById("resume-banner");
  const resumeProgress = document.getElementById("resume-progress");
  const resumeBtn = document.getElementById("resume-btn");
  const discardBtn = document.getElementById("discard-btn");

  const progressFill = document.getElementById("progress-fill");
  const progressTrack = document.querySelector(".progress-track");
  const progressLabel = document.getElementById("progress-label");
  const questionText = document.getElementById("question-text");
  const answerOptions = document.getElementById("answer-options");
  const prevBtn = document.getElementById("prev-btn");

  const attemptMeta = document.getElementById("attempt-meta");
  const dominantName = document.getElementById("dominant-name");
  const dominantMask = document.getElementById("dominant-mask");
  const dominantScore = document.getElementById("dominant-score");
  const scoreChart = document.getElementById("score-chart");
  const woundAccordion = document.getElementById("wound-accordion");
  const resultsTitle = document.getElementById("results-title");
  const bookingLink = document.getElementById("booking-link");
  const printBtn = document.getElementById("print-btn");
  const restartBtn = document.getElementById("restart-btn");

  const evolutionCard = document.getElementById("evolution-card");
  const userRangeButtons = document.getElementById("user-range-buttons");
  const userEvolutionChart = document.getElementById("user-evolution-chart");
  const userEvolutionLegend = document.getElementById("user-evolution-legend");
  const historyCard = document.getElementById("history-card");
  const historyTbody = document.getElementById("history-tbody");
  const historyViewing = document.getElementById("history-viewing");

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

  // ---------- Genre (thème + texte) ----------
  // Capture le gabarit brut ("Bien-aimé(e), ...") avant toute genderisation,
  // pour pouvoir régénérer le texte à chaque changement de genre.
  const verseTemplate = verseWelcome ? verseWelcome.textContent.trim() : "";

  function applyGenderTheme(gender) {
    document.body.dataset.gender = gender || "";
    if (themeColorMeta) {
      themeColorMeta.setAttribute("content", gender === "homme" ? "#2f6fb0" : "#c2478b");
    }
    const verseText = genderize(verseTemplate, gender);
    if (verseWelcome) verseWelcome.textContent = verseText;
    if (verseResults) verseResults.textContent = verseText;
  }

  genderInputs.forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked) applyGenderTheme(input.value);
    });
  });

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
        fillFormFromState();
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

  // Remplit le sélecteur d'indicatif à partir de la liste de data.js.
  PHONE_COUNTRIES.forEach((country) => {
    const option = document.createElement("option");
    option.value = country.code;
    option.textContent = country.label;
    phoneCountrySelect.appendChild(option);
  });
  phoneCountrySelect.value = DEFAULT_PHONE_COUNTRY;

  function fillFormFromState() {
    genderInputs.forEach((input) => {
      input.checked = input.value === state.gender;
    });
    applyGenderTheme(state.gender);
    firstNameInput.value = state.firstName || "";
    lastNameInput.value = state.lastName || "";
    emailInput.value = state.email || "";
    phoneCountrySelect.value = state.phoneCountry || DEFAULT_PHONE_COUNTRY;
    phoneInput.value = state.phoneNational || "";
    cityInput.value = state.city || "";
    postalCodeInput.value = state.postalCode || "";
  }

  startForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const checkedGender = [...genderInputs].find((input) => input.checked);
    const phoneCountry = phoneCountrySelect.value;
    const phoneNational = phoneInput.value.trim();
    const phone = buildInternationalPhone(phoneCountry, phoneNational);

    // Garde-fou : le numéro national doit contenir des chiffres une fois
    // l'indicatif et les zéros initiaux retirés.
    if (!phone) {
      phoneInput.setCustomValidity("Numéro de téléphone invalide.");
      phoneInput.reportValidity();
      return;
    }
    phoneInput.setCustomValidity("");

    state = {
      ...emptyState(),
      gender: checkedGender ? checkedGender.value : "",
      firstName: firstNameInput.value.trim(),
      lastName: lastNameInput.value.trim(),
      email: emailInput.value.trim(),
      phoneCountry,
      phoneNational,
      phone,
      city: cityInput.value.trim(),
      postalCode: postalCodeInput.value.trim(),
    };
    saveState();
    startQuizFromCurrent();
  });

  // Efface l'erreur personnalisée dès que l'utilisateur corrige sa saisie.
  phoneInput.addEventListener("input", () => phoneInput.setCustomValidity(""));

  function startQuizFromCurrent() {
    showScreen("quiz");
    renderQuestion(state.currentIndex);
  }

  // ---------- Quiz screen ----------
  let isTransitioning = false;
  let pendingTransitionTimer = null;

  function renderQuestion(index) {
    isTransitioning = false;
    if (pendingTransitionTimer) {
      window.clearTimeout(pendingTransitionTimer);
      pendingTransitionTimer = null;
    }
    state.currentIndex = index;
    const q = QUIZ[index];

    progressLabel.textContent = `Question ${index + 1} / ${TOTAL}`;

    const pct = Math.round((index / TOTAL) * 100);
    progressFill.style.width = pct + "%";
    progressTrack.setAttribute("aria-valuenow", String(index + 1));

    questionText.textContent = genderize(q.text, state.gender);

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
    // Ignore les clics sur les boutons de la question précédente pendant la
    // transition : sans ce garde-fou, un double-clic rapide peut faire
    // avancer deux fois de suite et sauter une question sans jamais
    // l'enregistrer (elle reste "null").
    if (isTransitioning) return;
    isTransitioning = true;

    state.answers[state.currentIndex] = value;
    saveState();

    [...answerOptions.children].forEach((btn) => {
      btn.classList.toggle("selected", Number(btn.dataset.value) === value);
    });

    const targetIndex = state.currentIndex;

    // petite pause visuelle avant de passer à la question suivante
    pendingTransitionTimer = window.setTimeout(() => {
      pendingTransitionTimer = null;
      if (targetIndex < TOTAL - 1) {
        renderQuestion(targetIndex + 1);
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

  async function finishQuiz() {
    progressFill.style.width = "100%";
    progressLabel.textContent = "Enregistrement de tes réponses…";
    await submitAttempt();
    renderResults();
    showScreen("results");
  }

  // ---------- Envoi au serveur ----------
  async function submitAttempt() {
    const payload = {
      gender: state.gender,
      firstName: state.firstName,
      lastName: state.lastName,
      email: state.email,
      phone: state.phone,
      city: state.city,
      postalCode: state.postalCode,
      answers: state.answers,
      consent: true,
    };

    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), SUBMIT_TIMEOUT_MS);
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      window.clearTimeout(timeout);
      const data = await res.json().catch(() => null);
      if (res.ok) {
        if (data && typeof data.attemptNumber === "number") {
          state.attemptNumber = data.attemptNumber;
        }
        if (data && Array.isArray(data.history)) {
          state.history = data.history;
        }
      } else {
        console.warn("Échec de l'enregistrement de la passation :", res.status, data);
      }
    } catch (e) {
      // Hors-ligne ou serveur indisponible : on affiche quand même les résultats
      // calculés localement, sans numéro de passation.
    }
    saveState();
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

  // Détermine les blessures à détailler : la ou les blessures dominantes
  // (ex æquo compris), et sinon la blessure suivante dans le classement.
  function pickHighlighted(results) {
    const topScore = results[0].score;
    const dominant = results.filter((r) => r.score === topScore);
    if (dominant.length > 1) return { dominant, shown: dominant };
    const shown = results[1] ? [results[0], results[1]] : [results[0]];
    return { dominant, shown };
  }

  // Reconstruit le même format que computeScores() à partir d'une
  // passation stockée (qui ne contient que les scores, pas les réponses
  // brutes) — permet de rejouer le rapport d'un test passé.
  function resultsFromAttempt(attempt) {
    return WOUNDS.map((w) => {
      const score = attempt[SCORE_FIELDS[w.id]];
      return { wound: w, score, level: levelFor(score) };
    });
  }

  // ---------- Results screen ----------
  // attempt === null : résultats du test qui vient d'être passé.
  // attempt fourni : on rejoue le rapport d'une passation antérieure.
  function renderResults(attempt) {
    const isPast = !!attempt;
    const results = (isPast ? resultsFromAttempt(attempt) : computeScores()).sort(
      (a, b) => b.score - a.score
    );
    const { dominant, shown } = pickHighlighted(results);

    resultsTitle.textContent = state.firstName
      ? `Résultats de ${state.firstName}`
      : "Tes résultats";

    const attemptNumber = isPast ? attempt.attempt_number : state.attemptNumber;
    const attemptDate = isPast ? new Date(attempt.taken_at) : new Date();
    if (attemptNumber) {
      attemptMeta.textContent = `Test passé : ${attemptNumber} — ${formatDate(attemptDate)}`;
      attemptMeta.hidden = false;
    } else {
      attemptMeta.hidden = true;
    }

    dominantName.textContent = dominant.map((d) => d.wound.name).join(" - ");
    dominantMask.textContent =
      "Masque : " + dominant.map((d) => d.wound.mask).join(" - ");
    dominantScore.textContent =
      dominant.length > 1
        ? `Blessures ex æquo — ${dominant[0].score} / 50 — ${dominant[0].level.label}`
        : `Score : ${dominant[0].score} / 50 — ${dominant[0].level.label}`;

    renderChart(results);
    renderAccordion(shown, dominant.map((d) => d.wound.id));
    setupBookingLink(dominant, state.firstName);
    renderEvolution();
    renderHistory(isPast ? attempt.attempt_number : null);
  }

  // ---------- Évolution et historique du participant ----------
  let userRange = "all";

  function renderEvolution() {
    const history = state.history || [];
    // Une seule passation ne raconte pas encore d'évolution.
    if (history.length < 2) {
      evolutionCard.hidden = true;
      return;
    }
    evolutionCard.hidden = false;
    userEvolutionLegend.innerHTML = buildEvolutionLegendHtml();

    const filtered = filterAttemptsByRange(history, userRange);
    if (filtered.length === 0) {
      userEvolutionChart.innerHTML =
        `<p class="evolution-empty">Aucun test passé sur cette période.</p>`;
      return;
    }
    userEvolutionChart.innerHTML = buildEvolutionChartSvg(filtered);
  }

  userRangeButtons.addEventListener("click", (e) => {
    const btn = e.target.closest(".range-btn");
    if (!btn) return;
    userRange = btn.dataset.range;
    [...userRangeButtons.children].forEach((b) => {
      b.classList.toggle("active", b.dataset.range === userRange);
    });
    renderEvolution();
  });

  function renderHistory(viewingAttemptNumber) {
    const history = state.history || [];
    if (history.length < 2) {
      historyCard.hidden = true;
      return;
    }
    historyCard.hidden = false;
    historyTbody.innerHTML = "";

    // Plus récent en premier : c'est celui qu'on veut voir d'abord.
    [...history].reverse().forEach((attempt) => {
      const ranked = resultsFromAttempt(attempt).sort((a, b) => b.score - a.score);
      const topScore = ranked[0].score;
      const dominant = ranked.filter((r) => r.score === topScore);
      const isCurrent = viewingAttemptNumber
        ? attempt.attempt_number === viewingAttemptNumber
        : attempt.attempt_number === state.attemptNumber;

      const tr = document.createElement("tr");
      tr.className = "history-row" + (isCurrent ? " current" : "");
      tr.innerHTML = `
        <td>${attempt.attempt_number}</td>
        <td>${formatDate(new Date(attempt.taken_at))}</td>
        <td>${dominant.map((d) => d.wound.name).join(" - ")}</td>
        <td>${topScore} / 50</td>
      `;
      tr.addEventListener("click", () => {
        renderResults(attempt);
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
      historyTbody.appendChild(tr);
    });

    // Bandeau de contexte quand on consulte un test antérieur, avec un
    // retour explicite vers le test qui vient d'être passé.
    const latestNumber = state.attemptNumber || history[history.length - 1].attempt_number;
    if (viewingAttemptNumber && viewingAttemptNumber !== latestNumber) {
      historyViewing.innerHTML =
        `Tu consultes le rapport du test n°${viewingAttemptNumber}. ` +
        `<button type="button" class="link-btn" id="back-to-latest">Revenir à ton dernier test</button>`;
      historyViewing.hidden = false;
      const backBtn = document.getElementById("back-to-latest");
      if (backBtn) {
        backBtn.addEventListener("click", () => {
          renderResults();
          window.scrollTo({ top: 0, behavior: "smooth" });
        });
      }
    } else {
      historyViewing.hidden = true;
    }
  }

  function formatDate(date) {
    return date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
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

  function renderAccordion(shown, dominantIds) {
    woundAccordion.innerHTML = "";

    shown.forEach((r) => {
      const item = document.createElement("div");
      item.className = "accordion-item";
      const isDominant = dominantIds.includes(r.wound.id);
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

      const g = state.gender;
      const body = document.createElement("div");
      body.className = "accordion-body";
      body.innerHTML = `
        <h4>Besoins clés</h4>
        <p>${genderize(r.wound.needs, g)}</p>
        <h4>Comprendre</h4>
        <p>${genderize(r.wound.understand, g)}</p>
        <h4>Cela peut se traduire par</h4>
        <ul>${r.wound.signs.map((s) => `<li>${genderize(s, g)}</li>`).join("")}</ul>
        <h4>3 actions pour te repositionner (dès cette semaine)</h4>
        <ol>${r.wound.actions.map((a) => `<li>${genderize(a, g)}</li>`).join("")}</ol>
      `;

      item.appendChild(toggle);
      item.appendChild(body);
      woundAccordion.appendChild(item);
    });
  }

  function setupBookingLink(dominant, firstName) {
    const woundLabel = dominant.map((d) => `${d.wound.name} (masque ${d.wound.mask})`).join(" & ");
    const subject = "Demande de séance de coaching — Test des 5 blessures de l'âme";
    const greeting = firstName ? `Bonjour, je m'appelle ${firstName}.` : "Bonjour,";
    const body = [
      greeting,
      "",
      `J'ai réalisé le Test des 5 blessures de l'âme.`,
      `Ma/mes blessure(s) dominante(s) ressortent comme : ${woundLabel}, avec un score de ${dominant[0].score}/50.`,
      "",
      "Je souhaiterais réserver une séance d'accompagnement psychologique et spirituel.",
      "",
      "Merci !",
    ].join("\n");

    bookingLink.href =
      "mailto:bouangaesther9@gmail.com" +
      `?subject=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`;
  }

  printBtn.addEventListener("click", () => window.print());

  restartBtn.addEventListener("click", () => {
    clearState();
    state = emptyState();
    startForm.reset();
    applyGenderTheme("");
    resumeBanner.hidden = true;
    showScreen("welcome");
  });

  // ---------- Init ----------
  initWelcome();
  showScreen("welcome");
})();
