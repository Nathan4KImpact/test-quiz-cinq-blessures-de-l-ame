// Dossier du participant connecté : son profil et l'historique de ses
// passations. L'identité vient exclusivement du cookie signé — aucun
// paramètre de la requête ne permet de désigner quelqu'un d'autre.

const { supabaseRequest } = require("../_lib/supabase");
const { getParticipantId } = require("../_lib/auth");

module.exports = async (req, res) => {
  const participantId = getParticipantId(req);
  if (!participantId) {
    res.status(401).json({ error: "Non authentifié." });
    return;
  }

  try {
    const found = await supabaseRequest(
      `/participants?id=eq.${participantId}` +
        `&select=id,first_name,last_name,gender,email,phone,city,postal_code,created_at,last_test_at,password_set_at&limit=1`
    );
    const participant = found && found[0];
    if (!participant) {
      res.status(404).json({ error: "Dossier introuvable." });
      return;
    }
    // L'empreinte ne sort jamais de la base : l'interface a seulement
    // besoin de savoir s'il faut proposer de définir un mot de passe.
    participant.hasPassword = !!participant.password_set_at;

    const history = await supabaseRequest(
      `/attempts?participant_id=eq.${participantId}` +
        `&select=attempt_number,taken_at,score_trahison,score_rejet,score_abandon,score_humiliation,score_injustice,dominant_wounds` +
        `&order=attempt_number.asc`
    );

    res.status(200).json({ participant, history: history || [] });
  } catch (err) {
    console.error("me error", err);
    res.status(500).json({ error: "Erreur serveur." });
  }
};
