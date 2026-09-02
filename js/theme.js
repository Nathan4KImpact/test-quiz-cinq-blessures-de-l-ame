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

/**
 * Aligne la couleur d'interface du navigateur mobile (barre d'adresse)
 * sur l'accent courant. Lue depuis la variable CSS plutôt que codée en
 * dur : elle suit ainsi le thème ET le genre sans table de
 * correspondance à maintenir en double.
 */
function syncThemeColorMeta() {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  const accent = getComputedStyle(document.body).getPropertyValue("--rose").trim();
  if (accent) meta.setAttribute("content", accent);
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
  syncThemeColorMeta();
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
