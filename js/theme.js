/**
 * Sélection du jeu de thèmes, partagée entre l'app publique et l'admin.
 *
 * Le thème est posé sur <html> par un court script inline en <head> (voir
 * index.html / admin.html) AVANT le premier rendu : sans cela, la page
 * s'afficherait un instant dans le thème par défaut avant de basculer.
 * Ce fichier ne fait que câbler les boutons et mémoriser le choix.
 */

const THEME_STORAGE_KEY = "blessures-ame-theme";
const THEMES = ["signature", "classique"];
const DEFAULT_THEME = "signature";

function readStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return THEMES.includes(stored) ? stored : DEFAULT_THEME;
  } catch (e) {
    // Navigation privée ou stockage bloqué : le thème par défaut suffit.
    return DEFAULT_THEME;
  }
}

function applyTheme(theme) {
  const chosen = THEMES.includes(theme) ? theme : DEFAULT_THEME;
  document.documentElement.dataset.theme = chosen;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, chosen);
  } catch (e) {
    /* le thème reste appliqué pour la session en cours */
  }
  document.querySelectorAll("[data-theme-choice]").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.dataset.themeChoice === chosen));
  });
}

function initThemeSwitch() {
  applyTheme(readStoredTheme());
  document.querySelectorAll("[data-theme-choice]").forEach((btn) => {
    btn.addEventListener("click", () => applyTheme(btn.dataset.themeChoice));
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initThemeSwitch);
} else {
  initThemeSwitch();
}
