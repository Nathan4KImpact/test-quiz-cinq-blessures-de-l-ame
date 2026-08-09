// Petit client REST pour l'API Supabase (PostgREST), sans dépendance npm.
// Utilise exclusivement la clé service_role : ces fonctions ne tournent
// jamais dans le navigateur, la clé n'est donc jamais exposée.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function assertConfigured() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error(
      "Supabase n'est pas configuré : variables d'environnement SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY manquantes."
    );
  }
}

async function supabaseRequest(path, options = {}) {
  assertConfigured();
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Supabase ${options.method || "GET"} ${path} -> ${res.status}: ${text}`);
  }

  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

module.exports = { supabaseRequest };
