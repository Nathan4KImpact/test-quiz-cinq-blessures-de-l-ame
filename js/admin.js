(function () {
  "use strict";

  const screens = {
    login: document.getElementById("admin-login"),
    dashboard: document.getElementById("admin-dashboard"),
    detail: document.getElementById("admin-detail"),
  };

  const loginForm = document.getElementById("login-form");
  const loginError = document.getElementById("login-error");
  const logoutBtn = document.getElementById("logout-btn");
  const searchInput = document.getElementById("search-input");
  const woundFilter = document.getElementById("wound-filter");
  const participantsTbody = document.getElementById("participants-tbody");
  const emptyState = document.getElementById("empty-state");
  const adminSummary = document.getElementById("admin-summary");

  const backBtn = document.getElementById("back-btn");
  const adminPrintBtn = document.getElementById("admin-print-btn");
  const participantInfo = document.getElementById("participant-info");
  const rangeButtons = document.getElementById("range-buttons");
  const evolutionChart = document.getElementById("evolution-chart");
  const evolutionLegend = document.getElementById("evolution-legend");
  const attemptsTbody = document.getElementById("attempts-tbody");
  const attemptReportCard = document.getElementById("attempt-report-card");
  const attemptReportTitle = document.getElementById("attempt-report-title");
  const attemptReport = document.getElementById("attempt-report");

  let allParticipants = [];
  let currentDetail = null; // { participant, attempts }
  let currentRange = "all";

  woundFilter.innerHTML =
    `<option value="">Toutes les blessures dominantes</option>` +
    WOUNDS.map((w) => `<option value="${w.id}">${w.name}</option>`).join("");

  function showScreen(name) {
    Object.entries(screens).forEach(([key, el]) => {
      el.classList.toggle("active", key === name);
    });
    window.scrollTo({ top: 0 });
  }

  function woundById(id) {
    return WOUNDS.find((w) => w.id === id);
  }

  function formatDate(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  function dominantLabel(ids) {
    if (!ids || ids.length === 0) return "—";
    return ids
      .map((id) => woundById(id))
      .filter(Boolean)
      .map((w) => w.name)
      .join(" - ");
  }

  const SCORE_FIELDS = {
    trahison: "score_trahison",
    rejet: "score_rejet",
    abandon: "score_abandon",
    humiliation: "score_humiliation",
    injustice: "score_injustice",
  };

  // Classe les 5 blessures d'une passation par score décroissant.
  function rankWounds(attempt) {
    return WOUNDS.map((w) => ({ wound: w, score: attempt[SCORE_FIELDS[w.id]] })).sort(
      (a, b) => b.score - a.score
    );
  }

  // La ou les blessures "modérées" : celles qui suivent immédiatement la
  // dominante dans le classement (même logique que sur la page résultats).
  function moderateWounds(attempt) {
    const ranked = rankWounds(attempt);
    const dominantIds = attempt.dominant_wounds || [];
    const rest = ranked.filter((r) => !dominantIds.includes(r.wound.id));
    if (rest.length === 0) return [];
    const nextScore = rest[0].score;
    return rest.filter((r) => r.score === nextScore).map((r) => r.wound.id);
  }

  // ---------- Auth ----------
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.hidden = true;
    const password = document.getElementById("admin-password").value;

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        loginError.textContent = data.error || "Connexion impossible.";
        loginError.hidden = false;
        return;
      }
      loginForm.reset();
      await loadDashboard();
    } catch (err) {
      loginError.textContent = "Erreur réseau. Réessaie.";
      loginError.hidden = false;
    }
  });

  logoutBtn.addEventListener("click", async () => {
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => {});
    showScreen("login");
  });

  backBtn.addEventListener("click", () => {
    showScreen("dashboard");
  });

  adminPrintBtn.addEventListener("click", () => window.print());

  // ---------- Dashboard ----------
  async function loadDashboard() {
    const res = await fetch("/api/admin/participants");
    if (res.status === 401) {
      showScreen("login");
      return;
    }
    const data = await res.json();
    allParticipants = data.participants || [];
    renderSummary(allParticipants);
    applyFilters();
    showScreen("dashboard");
  }

  function renderSummary(list) {
    const total = list.length;
    const totalAttempts = list.reduce((sum, p) => sum + (p.attemptsCount || 0), 0);
    const now = Date.now();
    const activeLast30 = list.filter(
      (p) => p.last_test_at && now - new Date(p.last_test_at).getTime() < 30 * 24 * 3600 * 1000
    ).length;

    adminSummary.innerHTML = `
      <div class="summary-stat"><span class="num">${total}</span><span class="label">Participant·es</span></div>
      <div class="summary-stat"><span class="num">${totalAttempts}</span><span class="label">Tests passés au total</span></div>
      <div class="summary-stat"><span class="num">${activeLast30}</span><span class="label">Test refait ces 30 derniers jours</span></div>
    `;
  }

  function renderParticipants(list) {
    participantsTbody.innerHTML = "";
    emptyState.hidden = list.length > 0;

    list.forEach((p) => {
      const tr = document.createElement("tr");
      const latest = p.latestAttempt;
      const dominantIds = latest ? latest.dominant_wounds || [] : [];
      const dominantColor = dominantIds[0] ? (woundById(dominantIds[0]) || {}).color : "#ccc";
      const dominantText = dominantLabel(dominantIds);
      const moderateIds = latest ? moderateWounds(latest) : [];
      const moderateColor = moderateIds[0] ? (woundById(moderateIds[0]) || {}).color : "#ccc";
      const moderateBlock = moderateIds.length
        ? `<span class="wound-tag secondary"><i class="dot" style="background:${moderateColor}"></i>${escapeHtml(dominantLabel(moderateIds))} (modérée)</span>`
        : "";

      tr.innerHTML = `
        <td>${escapeHtml(p.last_name)} ${escapeHtml(p.first_name)}</td>
        <td>${escapeHtml(p.email || "—")}</td>
        <td>${escapeHtml(p.city || "—")}</td>
        <td>${formatDate(p.last_test_at)}</td>
        <td>${p.attemptsCount}</td>
        <td>
          <div class="wound-tag-group">
            <span class="wound-tag"><i class="dot" style="background:${dominantColor}"></i>${escapeHtml(dominantText)}</span>
            ${moderateBlock}
          </div>
        </td>
      `;
      tr.addEventListener("click", () => openDetail(p.id));
      participantsTbody.appendChild(tr);
    });
  }

  function applyFilters() {
    const q = searchInput.value.trim().toLowerCase();
    const woundId = woundFilter.value;
    let filtered = allParticipants;
    if (q) {
      filtered = filtered.filter((p) =>
        [p.first_name, p.last_name, p.email, p.phone, p.city]
          .filter(Boolean)
          .some((field) => field.toLowerCase().includes(q))
      );
    }
    if (woundId) {
      filtered = filtered.filter((p) => {
        const latest = p.latestAttempt;
        return latest && (latest.dominant_wounds || []).includes(woundId);
      });
    }
    renderParticipants(filtered);
  }

  searchInput.addEventListener("input", applyFilters);
  woundFilter.addEventListener("change", applyFilters);

  function escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]));
  }

  // ---------- Detail / evolution ----------
  async function openDetail(id) {
    const res = await fetch(`/api/admin/participant?id=${encodeURIComponent(id)}`);
    if (res.status === 401) {
      showScreen("login");
      return;
    }
    if (!res.ok) return;
    const data = await res.json();
    currentDetail = data;
    currentRange = "all";
    attemptReportCard.hidden = true;
    renderParticipantInfo(data.participant, data.attempts);
    renderAttemptsTable(data.attempts);
    setActiveRangeButton("all");
    renderEvolutionChart(data.attempts, "all");
    showScreen("detail");
  }

  function renderParticipantInfo(p, attempts) {
    const last = attempts[attempts.length - 1];
    const dominant = last ? dominantLabel(last.dominant_wounds) : "—";
    const genderLabel = p.gender === "homme" ? "Homme (Kanegnon)" : p.gender === "femme" ? "Femme (Leaman)" : "—";
    participantInfo.innerHTML = `
      <h2 class="participant-name">${escapeHtml(p.first_name)} ${escapeHtml(p.last_name)}</h2>
      <div class="participant-meta">
        <div><strong>Genre</strong>${escapeHtml(genderLabel)}</div>
        <div><strong>Téléphone</strong>${escapeHtml(p.phone || "—")}</div>
        <div><strong>Email</strong>${escapeHtml(p.email || "—")}</div>
        <div><strong>Ville</strong>${escapeHtml(p.city || "—")}${p.postal_code ? " (" + escapeHtml(p.postal_code) + ")" : ""}</div>
        <div><strong>Premier test</strong>${formatDate(p.created_at)}</div>
        <div><strong>Dernier test</strong>${formatDate(p.last_test_at)}</div>
        <div><strong>Nombre de tests passés</strong>${attempts.length}</div>
        <div><strong>Blessure dominante actuelle</strong>${escapeHtml(dominant)}</div>
      </div>
    `;
  }

  function renderAttemptsTable(attempts) {
    attemptsTbody.innerHTML = "";
    [...attempts].reverse().forEach((a) => {
      const tr = document.createElement("tr");
      tr.className = "attempt-row";
      tr.dataset.attemptNumber = String(a.attempt_number);
      tr.innerHTML = `
        <td>${a.attempt_number}</td>
        <td>${formatDate(a.taken_at)}</td>
        <td>${a.score_trahison}</td>
        <td>${a.score_rejet}</td>
        <td>${a.score_abandon}</td>
        <td>${a.score_humiliation}</td>
        <td>${a.score_injustice}</td>
        <td>${escapeHtml(dominantLabel(a.dominant_wounds))}</td>
      `;
      tr.addEventListener("click", () => {
        [...attemptsTbody.children].forEach((row) => row.classList.remove("selected"));
        tr.classList.add("selected");
        renderAttemptReport(a, currentDetail && currentDetail.participant);
      });
      attemptsTbody.appendChild(tr);
    });
  }

  function levelFromScore(score) {
    if (score >= 40) return { label: "Blessure dominante", tier: "high" };
    if (score >= 29) return { label: "Blessure modérée", tier: "moderate" };
    if (score >= 20) return { label: "Blessure peu présente", tier: "low" };
    return { label: "Blessure peu marquée", tier: "minimal" };
  }

  // Rebâtit le rapport complet d'une passation, tel qu'il a été présenté à
  // l'utilisateur, à partir des scores stockés + du contenu WOUNDS.
  function renderAttemptReport(attempt, participant) {
    const ranked = rankWounds(attempt).map((r) => ({
      ...r,
      level: levelFromScore(r.score),
    }));
    const dominantIds = attempt.dominant_wounds || [];
    const dominantEntries = ranked.filter((r) => dominantIds.includes(r.wound.id));
    const moderateIds = moderateWounds(attempt);
    const shownIds = new Set([...dominantIds, ...moderateIds]);
    const shown = ranked.filter((r) => shownIds.has(r.wound.id));

    const gender = participant && participant.gender;
    const dominantName = dominantLabel(dominantIds);
    const dominantMasks = dominantEntries.map((r) => r.wound.mask).join(" - ");
    const topScore = dominantEntries[0] ? dominantEntries[0].score : 0;
    const topLevel = dominantEntries[0] ? dominantEntries[0].level.label : "—";

    const chartRows = ranked
      .map(
        (r) => `
          <div class="chart-row">
            <span class="name">${escapeHtml(r.wound.name)}</span>
            <div class="chart-track"><div class="chart-fill" style="background:${r.wound.color}; width:${Math.min(100, (r.score / 50) * 100)}%"></div></div>
            <span class="value">${r.score}</span>
          </div>`
      )
      .join("");

    const accordionItems = shown
      .map((r) => {
        const isDominant = dominantIds.includes(r.wound.id);
        return `
          <div class="accordion-item open" ${isDominant ? 'data-dominant="true"' : ""}>
            <div class="accordion-toggle" style="cursor:default">
              <span class="toggle-left">
                <span class="wound-swatch" style="background:${r.wound.color}"></span>
                <span>
                  <strong>${escapeHtml(r.wound.name)}${isDominant ? " · dominante" : " · modérée"}</strong>
                  <span class="toggle-meta">Masque ${escapeHtml(r.wound.mask)} — ${r.score}/50 (${escapeHtml(r.level.label)})</span>
                </span>
              </span>
            </div>
            <div class="accordion-body" style="max-height:none; padding:0 20px 20px">
              <h4>Besoins clés</h4>
              <p>${genderize(r.wound.needs, gender)}</p>
              <h4>Comprendre</h4>
              <p>${genderize(r.wound.understand, gender)}</p>
              <h4>Cela peut se traduire par</h4>
              <ul>${r.wound.signs.map((s) => `<li>${genderize(s, gender)}</li>`).join("")}</ul>
              <h4>3 actions pour te repositionner (dès cette semaine)</h4>
              <ol>${r.wound.actions.map((a) => `<li>${genderize(a, gender)}</li>`).join("")}</ol>
            </div>
          </div>`;
      })
      .join("");

    attemptReportTitle.textContent = `Rapport du test passé ${attempt.attempt_number} — ${formatDate(attempt.taken_at)}`;
    attemptReport.innerHTML = `
      <div class="report-block">
        <p class="eyebrow">Blessure${dominantEntries.length > 1 ? "s" : ""} dominante${dominantEntries.length > 1 ? "s" : ""}</p>
        <h2>${escapeHtml(dominantName)}</h2>
        <p class="mask-line">Masque : ${escapeHtml(dominantMasks)}</p>
        <p class="score-line">Score : ${topScore} / 50 — ${escapeHtml(topLevel)}</p>
      </div>
      <div class="report-chart">
        <h4>Vue d'ensemble des 5 blessures</h4>
        <div class="score-chart">${chartRows}</div>
      </div>
      <div class="accordion">${accordionItems}</div>
    `;
    attemptReportCard.hidden = false;
    attemptReportCard.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  rangeButtons.addEventListener("click", (e) => {
    const btn = e.target.closest(".range-btn");
    if (!btn || !currentDetail) return;
    currentRange = btn.dataset.range;
    setActiveRangeButton(currentRange);
    renderEvolutionChart(currentDetail.attempts, currentRange);
  });

  function setActiveRangeButton(range) {
    [...rangeButtons.children].forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.range === range);
    });
  }

  function filterByRange(attempts, range) {
    if (range === "all") return attempts;
    const months = Number(range);
    const cutoff = Date.now() - months * 30 * 24 * 3600 * 1000;
    return attempts.filter((a) => new Date(a.taken_at).getTime() >= cutoff);
  }

  // Zones colorées de fond : dominante (40-50), modérée (29-39), peu
  // présente (20-28), peu marquée (<20). Le lecteur peut ainsi lire à
  // quelle catégorie appartient chaque score sans se référer à la légende.
  const SEVERITY_BANDS = [
    { min: 40, max: 50, color: "rgba(194, 71, 139, 0.10)", textColor: "#a13570", label: "Dominante" },
    { min: 29, max: 40, color: "rgba(217, 140, 63, 0.10)", textColor: "#a05e1e", label: "Modérée" },
    { min: 20, max: 29, color: "rgba(124, 159, 191, 0.10)", textColor: "#4d7290", label: "Peu présente" },
    { min: 0, max: 20, color: "rgba(154, 168, 154, 0.10)", textColor: "#5f6f5f", label: "Peu marquée" },
  ];

  function renderEvolutionChart(attempts, range) {
    const filtered = filterByRange(attempts, range);
    evolutionLegend.innerHTML = WOUNDS.map(
      (w) => `<span><i class="dot" style="background:${w.color}"></i> ${w.name}</span>`
    ).join("");

    if (filtered.length === 0) {
      evolutionChart.innerHTML = `<p class="evolution-empty">Aucune passation dans cette période.</p>`;
      return;
    }

    const width = 640;
    const height = 280;
    // Colonne de gauche élargie pour accueillir les libellés verticaux
    // des zones de sévérité, en plus des repères d'axe.
    const padL = 96;
    const padR = 16;
    const padT = 16;
    // padB agrandi car les libellés de date sont désormais en oblique et
    // occupent plus de hauteur qu'un simple texte horizontal.
    const padB = 44;
    const innerW = width - padL - padR;
    const innerH = height - padT - padB;

    const dates = filtered.map((a) => new Date(a.taken_at).getTime());
    const minDate = Math.min(...dates);
    const maxDate = Math.max(...dates);
    const dateSpan = maxDate - minDate || 1;

    function x(i) {
      if (filtered.length === 1) return padL + innerW / 2;
      return padL + ((dates[i] - minDate) / dateSpan) * innerW;
    }
    function y(score) {
      return padT + innerH - (score / 50) * innerH;
    }

    // Bandes de fond + libellé de sévérité horizontal dans la gouttière
    // gauche, centré verticalement sur la bande et aligné à droite juste
    // avant les repères de l'axe Y (les nombres 0/20/29/40/50 restent
    // visibles). Un léger décalage vertical est appliqué quand la bande
    // est trop petite pour éviter le chevauchement avec un repère d'axe.
    const LABEL_X = padL - 22;
    const AXIS_MARKS = [0, 20, 29, 40, 50];
    const bands = SEVERITY_BANDS.map((b) => {
      const yTop = y(b.max);
      const yBot = y(b.min);
      const yMid = (yTop + yBot) / 2;
      const bandHeight = yBot - yTop;
      const rect = `<rect x="${padL}" y="${yTop}" width="${innerW}" height="${bandHeight}" fill="${b.color}" />`;
      // Décale le libellé si le milieu de la bande tombe sur un repère d'axe.
      let labelY = yMid + 3;
      if (AXIS_MARKS.some((score) => Math.abs(y(score) - yMid) < 8)) {
        labelY = yMid - 6;
      }
      const label = `<text x="${LABEL_X}" y="${labelY}" font-size="10" font-weight="700" fill="${b.textColor}" text-anchor="end">${b.label}</text>`;
      return rect + label;
    }).join("");

    const gridLines = [0, 20, 29, 40, 50]
      .map(
        (score) =>
          `<line x1="${padL}" y1="${y(score)}" x2="${width - padR}" y2="${y(score)}" stroke="#e0d0d8" stroke-width="1" stroke-dasharray="2,2" />` +
          `<text x="${padL - 8}" y="${y(score) + 3}" font-size="9" fill="#9c8896" text-anchor="end">${score}</text>`
      )
      .join("");

    let paths = "";
    WOUNDS.forEach((w) => {
      const field = SCORE_FIELDS[w.id];
      const points = filtered.map((a, i) => `${x(i)},${y(a[field])}`).join(" ");
      if (filtered.length === 1) {
        const [px, py] = points.split(",");
        paths += `<circle cx="${px}" cy="${py}" r="4" fill="${w.color}" />`;
      } else {
        paths += `<polyline points="${points}" fill="none" stroke="${w.color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />`;
        filtered.forEach((a, i) => {
          paths += `<circle cx="${x(i)}" cy="${y(a[field])}" r="3" fill="${w.color}" />`;
        });
      }
    });

    // Labels de date en oblique (~30°) pour éviter le chevauchement quand
    // deux tests sont rapprochés dans le temps. text-anchor="end" +
    // transform rotate autour du point d'ancrage juste sous chaque tick.
    const dateLabels = filtered
      .map((a, i) => {
        if (filtered.length > 8 && i % Math.ceil(filtered.length / 8) !== 0 && i !== filtered.length - 1) {
          return "";
        }
        const anchorX = x(i);
        const anchorY = height - padB + 16;
        return `<text x="${anchorX}" y="${anchorY}" font-size="9" fill="#9c8896" text-anchor="end" transform="rotate(-30 ${anchorX} ${anchorY})">${formatDate(a.taken_at)}</text>`;
      })
      .join("");

    evolutionChart.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Évolution des blessures de l'âme dans le temps">
        ${bands}
        ${gridLines}
        ${paths}
        ${dateLabels}
      </svg>
    `;
  }

  // ---------- Init ----------
  loadDashboard();
})();
