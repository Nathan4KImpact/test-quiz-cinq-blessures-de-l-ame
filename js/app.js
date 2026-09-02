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
    login: document.getElementById("screen-login"),
    account: document.getElementById("screen-account"),
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

  const progressCard = document.getElementById("progress-card");
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
  const backToAccountBtn = document.getElementById("back-to-account-btn");

  // Connexion participant
  const accountEntryBtn = document.getElementById("account-entry");
  const accountLogoutBtn = document.getElementById("account-logout");
  const goLoginBtn = document.getElementById("go-login-btn");
  const loginBackBtn = document.getElementById("login-back-btn");
  const signupPasswordInput = document.getElementById("signup-password");
  const passwordLoginForm = document.getElementById("password-login-form");
  const passwordLoginEmail = document.getElementById("password-login-email");
  const passwordLoginPassword = document.getElementById("password-login-password");
  const goCodeBtn = document.getElementById("go-code-btn");
  const backToPasswordBtn = document.getElementById("back-to-password-btn");
  const requestCodeForm = document.getElementById("request-code-form");
  const verifyCodeForm = document.getElementById("verify-code-form");
  const loginEmailInput = document.getElementById("login-email");
  const loginCodeInput = document.getElementById("login-code");
  const codeSentNote = document.getElementById("code-sent-note");
  const resendCodeBtn = document.getElementById("resend-code-btn");
  const loginError = document.getElementById("login-error");

  // Espace participant
  const accountTitle = document.getElementById("account-title");
  const accountSubtitle = document.getElementById("account-subtitle");
  const accountStats = document.getElementById("account-stats");
  const accountNewTestBtn = document.getElementById("account-new-test");
  const accountLastReportBtn = document.getElementById("account-last-report");
  const accountActionsNote = document.getElementById("account-actions-note");
  const accountPasswordCard = document.getElementById("account-password-card");
  const accountPasswordTitle = document.getElementById("account-password-title");
  const accountPasswordNote = document.getElementById("account-password-note");
  const accountPasswordForm = document.getElementById("account-password-form");
  const accountPasswordInput = document.getElementById("account-password");
  const accountPasswordConfirm = document.getElementById("account-password-confirm");
  const accountPasswordMsg = document.getElementById("account-password-msg");

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
    refreshAppBar(name);
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
    pendingPassword = signupPasswordInput.value;
    saveState();
    startQuizFromCurrent();
  });

  // Efface l'erreur personnalisée dès que l'utilisateur corrige sa saisie.
  phoneInput.addEventListener("input", () => phoneInput.setCustomValidity(""));

  function startQuizFromCurrent() {
    showScreen("quiz");
    renderQuestion(state.currentIndex);
  }

  // Mot de passe choisi au formulaire d'accueil. Délibérément gardé hors
  // de `state` : celui-ci est sérialisé dans localStorage à chaque
  // réponse, et un mot de passe en clair y resterait sur l'appareil —
  // partagé ou non — longtemps après la fin du test.
  let pendingPassword = "";

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
    progressLabel.textContent = "Enregistrement des réponses…";
    await submitAttempt();
    refreshSessionHistory();
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
      // Ignoré côté serveur si le téléphone correspond déjà à un dossier :
      // seul /api/auth/set-password, qui exige une session prouvée, peut
      // changer le mot de passe d'un dossier existant.
      password: pendingPassword,
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
    // Le mot de passe a fini son voyage : on ne le garde pas en mémoire.
    pendingPassword = "";
    signupPasswordInput.value = "";
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
      : "Résultats du test";

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

    renderProgress(attemptNumber);
    renderChart(results);
    renderAccordion(shown, dominant.map((d) => d.wound.id));
    setupBookingLink(dominant, state.firstName);
    renderEvolution();
    renderHistory(isPast ? attempt.attempt_number : null);
  }

  // ---------- Bandeau de félicitations ----------
  // Le confetti n'est tiré qu'une fois par affichage d'écran de résultats :
  // rejouer un rapport passé depuis l'historique réaffiche le bandeau, mais
  // sans relancer l'animation à chaque clic.
  let confettiFired = false;

  function renderProgress(attemptNumber) {
    const progress = detectProgress(state.history || [], attemptNumber);
    if (!progress) {
      progressCard.hidden = true;
      progressCard.innerHTML = "";
      return;
    }

    progressCard.innerHTML = buildProgressHtml(progress, state.firstName);
    progressCard.hidden = false;

    if (!confettiFired) {
      confettiFired = true;
      launchConfetti();
    }
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

    const filtered = filterAttemptsByRange(history, userRange);
    // La légende est ordonnée sur les scores affichés : elle suit donc la
    // fenêtre choisie, pas l'historique complet.
    userEvolutionLegend.innerHTML = buildEvolutionLegendHtml(filtered);

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
      // Ancre stable sur le numéro de passation, comme le tableau admin :
      // désigner une ligne par son texte est ambigu (une date contient le
      // numéro d'une autre ligne).
      tr.dataset.attemptNumber = String(attempt.attempt_number);
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
        `Rapport affiché : test passé ${viewingAttemptNumber}. ` +
        `<button type="button" class="link-btn" id="back-to-latest">Revenir au dernier test</button>`;
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
        <h4>3 actions pour se repositionner (dès cette semaine)</h4>
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
    // Connecté : inutile de resaisir le profil, il est déjà en base.
    if (session) {
      startNewTestFromSession();
      return;
    }
    clearState();
    state = emptyState();
    startForm.reset();
    applyGenderTheme("");
    resumeBanner.hidden = true;
    showScreen("welcome");
  });

  backToAccountBtn.addEventListener("click", () => enterAccount());

  // ============================================================
  // Connexion du participant et espace personnel
  // ============================================================
  //
  // L'identité repose sur un code à usage unique reçu par e-mail : c'est
  // la possession de la boîte mail qui ouvre l'accès. Aucun écran ne
  // permet d'obtenir l'historique de quelqu'un à partir d'un simple
  // identifiant deviné.

  let session = null; // { participant, history }

  function showLoginError(message) {
    loginError.textContent = message;
    loginError.hidden = false;
  }

  // Trois formulaires se partagent l'écran de connexion : mot de passe
  // (chemin principal), demande de code puis saisie du code (chemin de
  // secours). Un seul est visible à la fois.
  function showLoginStep(step) {
    loginError.hidden = true;
    passwordLoginForm.hidden = step !== "password";
    requestCodeForm.hidden = step !== "request";
    verifyCodeForm.hidden = step !== "verify";
    if (step !== "verify") loginCodeInput.value = "";
  }

  goLoginBtn.addEventListener("click", () => {
    showLoginStep("password");
    showScreen("login");
  });

  loginBackBtn.addEventListener("click", () => showScreen("welcome"));
  goCodeBtn.addEventListener("click", () => {
    // L'adresse déjà saisie n'a pas à être retapée.
    if (passwordLoginEmail.value.trim()) loginEmailInput.value = passwordLoginEmail.value.trim();
    showLoginStep("request");
  });
  backToPasswordBtn.addEventListener("click", () => showLoginStep("password"));
  resendCodeBtn.addEventListener("click", () => showLoginStep("request"));

  passwordLoginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.hidden = true;
    const submitBtn = passwordLoginForm.querySelector("button[type=submit]");
    submitBtn.disabled = true;

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: passwordLoginEmail.value.trim(),
          password: passwordLoginPassword.value,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showLoginError(data.error || "E-mail ou mot de passe incorrect.");
        return;
      }
      passwordLoginPassword.value = "";
      if (await loadSession()) enterAccount();
      else showLoginError("Connexion établie mais dossier illisible. Réessayer.");
    } catch (err) {
      showLoginError("Erreur réseau. Réessayer dans un instant.");
    } finally {
      submitBtn.disabled = false;
    }
  });

  requestCodeForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.hidden = true;
    const email = loginEmailInput.value.trim();
    const submitBtn = requestCodeForm.querySelector("button[type=submit]");
    submitBtn.disabled = true;
    submitBtn.textContent = "Envoi en cours…";

    try {
      const res = await fetch("/api/auth/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showLoginError(data.error || "Envoi impossible pour le moment.");
        return;
      }
      // Message volontairement identique que l'adresse soit connue ou
      // non : le serveur ne dit pas qui a déjà passé le test, l'écran ne
      // doit pas le dire non plus.
      codeSentNote.textContent =
        `Si un test a déjà été passé avec ${email}, un code à 6 chiffres ` +
        `vient d'y être envoyé. Il est valable 10 minutes.`;
      requestCodeForm.hidden = true;
      verifyCodeForm.hidden = false;
      loginCodeInput.focus();
    } catch (err) {
      showLoginError("Erreur réseau. Réessayer dans un instant.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Recevoir mon code";
    }
  });

  verifyCodeForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.hidden = true;
    const submitBtn = verifyCodeForm.querySelector("button[type=submit]");
    submitBtn.disabled = true;

    try {
      const res = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: loginEmailInput.value.trim(),
          code: loginCodeInput.value.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showLoginError(data.error || "Code incorrect ou expiré.");
        return;
      }
      const loaded = await loadSession();
      if (loaded) {
        enterAccount();
        // Arrivée par code : c'est le moment de proposer un mot de passe
        // à qui n'en a pas encore, la carte est déjà mise en évidence.
        if (!session.participant.hasPassword) {
          accountPasswordCard.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      } else {
        showLoginError("Connexion établie mais dossier illisible. Réessayer.");
      }
    } catch (err) {
      showLoginError("Erreur réseau. Réessayer dans un instant.");
    } finally {
      submitBtn.disabled = false;
    }
  });

  accountLogoutBtn.addEventListener("click", async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    session = null;
    state = emptyState();
    clearState();
    startForm.reset();
    applyGenderTheme("");
    showLoginStep("password");
    loginEmailInput.value = "";
    passwordLoginEmail.value = "";
    passwordLoginPassword.value = "";
    showScreen("welcome");
  });

  accountEntryBtn.addEventListener("click", () => {
    // Quitter en pleine passation perd les réponses données : elles ne
    // sont enregistrées qu'à la 50e. On demande donc confirmation, mais
    // seulement s'il y a réellement quelque chose à perdre.
    if (screens.quiz.classList.contains("active")) {
      const answered = answeredCount(state.answers);
      if (answered > 0) {
        const ok = window.confirm(
          `Quitter le test en cours ?\n\n${answered} réponse${answered > 1 ? "s" : ""} ` +
            `sur ${TOTAL} ${answered > 1 ? "ont" : "a"} déjà été donnée${answered > 1 ? "s" : ""}, ` +
            `mais un test n'est enregistré qu'une fois terminé : ` +
            `ces réponses seront perdues.`
        );
        if (!ok) return;
      }
      // Sans cet effacement, un rechargement proposerait de reprendre un
      // test que la personne vient justement d'abandonner.
      clearState();
      pendingPassword = "";
    }
    enterAccount();
  });

  // Récupère le dossier du participant connecté. Renvoie false si aucune
  // session valide n'est en cours — c'est le cas normal d'un visiteur.
  async function loadSession() {
    try {
      const res = await fetch("/api/auth/me");
      if (!res.ok) {
        session = null;
        return false;
      }
      const data = await res.json();
      if (!data || !data.participant) {
        session = null;
        return false;
      }
      session = { participant: data.participant, history: data.history || [] };
      return true;
    } catch (e) {
      session = null;
      return false;
    }
  }

  // Recharge `state` à partir du dossier en base, pour que tout le rendu
  // déjà écrit (bulletin, évolution, historique) fonctionne à l'identique
  // qu'on vienne de passer le test ou qu'on consulte son espace.
  function hydrateStateFromSession() {
    const p = session.participant;
    const history = session.history || [];
    const latest = history[history.length - 1];
    state = {
      ...emptyState(),
      gender: p.gender || "",
      firstName: p.first_name || "",
      lastName: p.last_name || "",
      email: p.email || "",
      phone: p.phone || "",
      city: p.city || "",
      postalCode: p.postal_code || "",
      history,
      attemptNumber: latest ? latest.attempt_number : null,
    };
    applyGenderTheme(state.gender);
  }

  function enterAccount() {
    if (!session) {
      showScreen("welcome");
      return;
    }
    hydrateStateFromSession();
    renderAccount();
    showScreen("account");
  }

  function renderAccount() {
    const p = session.participant;
    const history = session.history || [];
    const latest = history[history.length - 1];

    accountTitle.textContent = p.first_name
      ? `Espace de ${p.first_name}`
      : "Mon espace";
    accountSubtitle.textContent = latest
      ? `Dernier test le ${formatDate(new Date(latest.taken_at))}.`
      : "Aucun test enregistré pour le moment.";

    const dominant = latest ? dominantNamesOf(latest) : "—";
    accountStats.innerHTML = `
      <div class="account-stat"><span class="num">${history.length}</span><span class="label">test${history.length > 1 ? "s" : ""} passé${history.length > 1 ? "s" : ""}</span></div>
      <div class="account-stat"><span class="num">${latest ? latest.attempt_number : "—"}</span><span class="label">dernier numéro</span></div>
      <div class="account-stat"><span class="num small">${escapeText(dominant)}</span><span class="label">blessure dominante</span></div>
    `;

    accountLastReportBtn.hidden = !latest;
    accountActionsNote.hidden = !latest;
    renderPasswordCard();
  }

  // Un dossier ancien n'a pas encore de mot de passe : la carte invite
  // alors à en définir un, pour que la prochaine connexion se passe du
  // code e-mail. Sinon elle propose simplement d'en changer.
  function renderPasswordCard() {
    const has = !!session.participant.hasPassword;
    accountPasswordTitle.textContent = has
      ? "Changer de mot de passe"
      : "Définir un mot de passe";
    accountPasswordNote.textContent = has
      ? "Le nouveau mot de passe remplacera l'actuel dès l'enregistrement."
      : "Ce dossier n'a pas encore de mot de passe. En définir un permet de se connecter directement la prochaine fois, sans passer par un code.";
    accountPasswordCard.classList.toggle("highlight", !has);
    accountPasswordMsg.hidden = true;
    accountPasswordInput.value = "";
    accountPasswordConfirm.value = "";
  }

  accountPasswordForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const password = accountPasswordInput.value;
    const confirm = accountPasswordConfirm.value;
    accountPasswordMsg.hidden = true;
    accountPasswordMsg.classList.remove("form-success");

    if (password !== confirm) {
      accountPasswordMsg.textContent = "Les deux mots de passe ne correspondent pas.";
      accountPasswordMsg.hidden = false;
      return;
    }

    const submitBtn = accountPasswordForm.querySelector("button[type=submit]");
    submitBtn.disabled = true;
    try {
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        accountPasswordMsg.textContent = data.error || "Enregistrement impossible.";
        accountPasswordMsg.hidden = false;
        return;
      }
      session.participant.hasPassword = true;
      renderPasswordCard();
      accountPasswordMsg.textContent = "Mot de passe enregistré.";
      accountPasswordMsg.classList.add("form-success");
      accountPasswordMsg.hidden = false;
    } catch (err) {
      accountPasswordMsg.textContent = "Erreur réseau. Réessayer dans un instant.";
      accountPasswordMsg.hidden = false;
    } finally {
      submitBtn.disabled = false;
    }
  });

  // Nom de la ou des blessures dominantes d'une passation stockée.
  function dominantNamesOf(attempt) {
    const ranked = resultsFromAttempt(attempt).sort((a, b) => b.score - a.score);
    const top = ranked[0].score;
    return ranked
      .filter((r) => r.score === top)
      .map((r) => r.wound.name)
      .join(" - ");
  }

  function escapeText(str) {
    return String(str || "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]));
  }

  // Le graphique d'évolution et le tableau des tests passés ne sont pas
  // repris ici : le bulletin les porte déjà, et les dupliquer donnait à
  // cet écran deux lectures du même contenu. L'espace se limite donc à
  // ce qui s'y décide — refaire le test, ouvrir le bulletin, gérer son
  // mot de passe.
  function openReport(attempt) {
    hydrateStateFromSession();
    renderResults(attempt);
    showScreen("results");
  }

  accountLastReportBtn.addEventListener("click", () => {
    const history = session.history || [];
    const latest = history[history.length - 1];
    if (latest) openReport(latest);
  });

  accountNewTestBtn.addEventListener("click", startNewTestFromSession);

  // Repasser le test sans reremplir le formulaire : le profil vient du
  // dossier en base, seules les 50 réponses sont à redonner.
  function startNewTestFromSession() {
    hydrateStateFromSession();
    state.answers = new Array(TOTAL).fill(null);
    state.currentIndex = 0;
    state.attemptNumber = null;
    confettiFired = false;
    saveState();
    startQuizFromCurrent();
  }

  // Après une nouvelle passation réussie, le dossier local doit refléter
  // ce qui vient d'être enregistré côté serveur.
  function refreshSessionHistory() {
    if (session && Array.isArray(state.history)) {
      session.history = state.history;
    }
  }

  // ---------- Barre d'application ----------
  // Pendant le quiz, « Mon espace » reste la seule sortie proposée, et
  // demande confirmation : sans elle, une passation lancée par erreur
  // n'aurait aucune issue. La déconnexion, elle, disparaît — une sortie
  // suffit, et celle-ci est la moins définitive.
  function refreshAppBar(screenName) {
    const inQuiz = screenName === "quiz";
    accountEntryBtn.hidden = !session || screenName === "account";
    accountEntryBtn.textContent = inQuiz ? "Quitter le test" : "Mon espace";
    accountLogoutBtn.hidden = !session || inQuiz;
    backToAccountBtn.hidden = !session || screenName !== "results";
  }

  // ---------- Init ----------
  (async function init() {
    initWelcome();
    const saved = loadState();
    const inProgress =
      saved && answeredCount(saved.answers) > 0 && answeredCount(saved.answers) < TOTAL;

    const loggedIn = await loadSession();
    // Une passation inachevée prime : la reprendre est plus urgent que
    // d'afficher l'espace personnel, et le bandeau de reprise est déjà là.
    if (loggedIn && !inProgress) {
      enterAccount();
    } else {
      showScreen("welcome");
    }
  })();
})();
