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
  const participantsTbody = document.getElementById("participants-tbody");
  const emptyState = document.getElementById("empty-state");
  const adminSummary = document.getElementById("admin-summary");

  const backBtn = document.getElementById("back-btn");
  const participantInfo = document.getElementById("participant-info");
  const rangeButtons = document.getElementById("range-buttons");
  const evolutionChart = document.getElementById("evolution-chart");
  const evolutionLegend = document.getElementById("evolution-legend");
  const attemptsTbody = document.getElementById("attempts-tbody");

  let allParticipants = [];
  let currentDetail = null; // { participant, attempts }
  let currentRange = "all";

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
      .join(" & ");
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
    renderParticipants(allParticipants);
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
      <div class="summary-stat"><span class="num">${total}</span><span class="label">Participant(e)s</span></div>
      <div class="summary-stat"><span class="num">${totalAttempts}</span><span class="label">Passations au total</span></div>
      <div class="summary-stat"><span class="num">${activeLast30}</span><span class="label">Test refait ces 30 derniers jours</span></div>
    `;
  }

  function renderParticipants(list) {
    participantsTbody.innerHTML = "";
    emptyState.hidden = list.length > 0;

    list.forEach((p) => {
      const tr = document.createElement("tr");
      const latest = p.latestAttempt;
      const dominant = latest ? dominantLabel(latest.dominant_wounds) : "—";
      const dominantColor = latest && latest.dominant_wounds && latest.dominant_wounds[0]
        ? (woundById(latest.dominant_wounds[0]) || {}).color
        : "#ccc";

      tr.innerHTML = `
        <td>${escapeHtml(p.last_name)} ${escapeHtml(p.first_name)}</td>
        <td>${escapeHtml(p.email)}</td>
        <td>${escapeHtml(p.city || "—")}</td>
        <td>${formatDate(p.last_test_at)}</td>
        <td>${p.attemptsCount}</td>
        <td><span class="wound-tag"><i class="dot" style="background:${dominantColor}"></i>${escapeHtml(dominant)}</span></td>
      `;
      tr.addEventListener("click", () => openDetail(p.id));
      participantsTbody.appendChild(tr);
    });
  }

  searchInput.addEventListener("input", () => {
    const q = searchInput.value.trim().toLowerCase();
    if (!q) {
      renderParticipants(allParticipants);
      return;
    }
    const filtered = allParticipants.filter((p) =>
      [p.first_name, p.last_name, p.email, p.city]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(q))
    );
    renderParticipants(filtered);
  });

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
    renderParticipantInfo(data.participant, data.attempts);
    renderAttemptsTable(data.attempts);
    setActiveRangeButton("all");
    renderEvolutionChart(data.attempts, "all");
    showScreen("detail");
  }

  function renderParticipantInfo(p, attempts) {
    const last = attempts[attempts.length - 1];
    const dominant = last ? dominantLabel(last.dominant_wounds) : "—";
    participantInfo.innerHTML = `
      <h2 class="participant-name">${escapeHtml(p.first_name)} ${escapeHtml(p.last_name)}</h2>
      <div class="participant-meta">
        <div><strong>Email</strong>${escapeHtml(p.email)}</div>
        <div><strong>Téléphone</strong>${escapeHtml(p.phone || "—")}</div>
        <div><strong>Ville</strong>${escapeHtml(p.city || "—")}${p.postal_code ? " (" + escapeHtml(p.postal_code) + ")" : ""}</div>
        <div><strong>Première passation</strong>${formatDate(p.created_at)}</div>
        <div><strong>Dernière passation</strong>${formatDate(p.last_test_at)}</div>
        <div><strong>Nombre de passations</strong>${attempts.length}</div>
        <div><strong>Blessure dominante actuelle</strong>${escapeHtml(dominant)}</div>
      </div>
    `;
  }

  function renderAttemptsTable(attempts) {
    attemptsTbody.innerHTML = "";
    [...attempts].reverse().forEach((a) => {
      const tr = document.createElement("tr");
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
      attemptsTbody.appendChild(tr);
    });
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

  const SCORE_FIELDS = {
    trahison: "score_trahison",
    rejet: "score_rejet",
    abandon: "score_abandon",
    humiliation: "score_humiliation",
    injustice: "score_injustice",
  };

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
    const padL = 36;
    const padR = 16;
    const padT = 16;
    const padB = 30;
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

    const gridLines = [0, 10, 20, 29, 40, 50]
      .map(
        (score) =>
          `<line x1="${padL}" y1="${y(score)}" x2="${width - padR}" y2="${y(score)}" stroke="#f0dbe6" stroke-width="1" />` +
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

    const dateLabels = filtered
      .map((a, i) => {
        if (filtered.length > 8 && i % Math.ceil(filtered.length / 8) !== 0 && i !== filtered.length - 1) {
          return "";
        }
        return `<text x="${x(i)}" y="${height - 8}" font-size="9" fill="#9c8896" text-anchor="middle">${formatDate(a.taken_at)}</text>`;
      })
      .join("");

    evolutionChart.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Évolution des scores dans le temps">
        ${gridLines}
        ${paths}
        ${dateLabels}
      </svg>
    `;
  }

  // ---------- Init ----------
  loadDashboard();
})();
