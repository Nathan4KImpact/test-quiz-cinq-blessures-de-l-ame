const { isAuthorized } = require("../_lib/auth");
const { supabaseRequest } = require("../_lib/supabase");

module.exports = async (req, res) => {
  if (!isAuthorized(req)) {
    res.status(401).json({ error: "Non authentifié." });
    return;
  }

  if (req.method !== "DELETE") {
    res.status(405).json({ error: "Méthode non autorisée." });
    return;
  }

  const id = req.query && req.query.id;
  if (!id) {
    res.status(400).json({ error: "Paramètre id manquant." });
    return;
  }

  try {
    await supabaseRequest(`/attempts?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("admin/attempt DELETE error", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
};
