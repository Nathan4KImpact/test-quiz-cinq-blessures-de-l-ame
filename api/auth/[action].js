// Point d'entrée unique de toute l'authentification participant.
//
// Pourquoi une route dynamique plutôt qu'un fichier par endpoint : le plan
// Hobby de Vercel plafonne un déploiement à 12 fonctions serverless, et
// chaque fichier de `api/` en devient une. Les six chemins de
// l'authentification ne consomment ici qu'un seul emplacement.
//
// Les handlers vivent sous `api/_auth/` : un dossier préfixé par « _ »
// n'est pas transformé en fonction, exactement comme `api/_lib/`.
//
// Les URL publiques sont inchangées — /api/auth/login, /api/auth/me… —
// Vercel plaçant le segment d'URL dans req.query.action.

const handlers = {
  login: require("../_auth/login"),
  precheck: require("../_auth/precheck"),
  logout: require("../_auth/logout"),
  "request-code": require("../_auth/request-code"),
  "verify-code": require("../_auth/verify-code"),
  "set-password": require("../_auth/set-password"),
  me: require("../_auth/me"),
};

module.exports = async (req, res) => {
  const action = String((req.query && req.query.action) || "");
  const handler = Object.prototype.hasOwnProperty.call(handlers, action)
    ? handlers[action]
    : null;

  if (!handler) {
    res.status(404).json({ error: "Endpoint inconnu." });
    return;
  }

  return handler(req, res);
};

// Exporté pour les tests : permet de vérifier la table de routage sans
// démarrer de serveur.
module.exports.handlers = handlers;
