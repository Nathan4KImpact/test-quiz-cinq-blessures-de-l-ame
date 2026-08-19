/**
 * Contenu du "Test des 5 blessures de l'âme" (50 questions inspirées des
 * cinq blessures émotionnelles décrites par Lise Bourbeau).
 * Toutes les données restent locales au navigateur : rien n'est envoyé
 * à un serveur.
 */

const WOUNDS = [
  {
    id: "trahison",
    name: "Trahison",
    mask: "Contrôlant",
    color: "#c2478b",
    needs: "Confiance mutuelle, respect des engagements, sécurité affective et capacité à lâcher prise progressivement.",
    understand:
      "Tu ressens une forte inquiétude lorsque les engagements ne sont pas respectés ou lorsque les comportements des autres te semblent imprévisibles. Cela peut t'amener à vouloir anticiper, contrôler ou vérifier afin de te sentir rassuré(e).",
    signs: [
      "une tendance à vouloir organiser, prévoir ou contrôler les situations et les décisions familiales ;",
      "des difficultés à faire confiance ou à déléguer certaines responsabilités au sein du couple ou de la famille ;",
      "une forte réactivité lorsque les promesses ou les engagements ne sont pas tenus.",
    ],
    actions: [
      "Clarifie les attentes et les engagements de chacun afin d'éviter les malentendus.",
      "Confie volontairement une responsabilité à un proche sans intervenir systématiquement, en convenant simplement d'un moment d'échange.",
      "Choisis une situation où tu acceptes de ne pas tout maîtriser et observe les effets sur ta sérénité.",
    ],
  },
  {
    id: "rejet",
    name: "Rejet",
    mask: "Fuyant",
    color: "#7c5cbf",
    needs: "Acceptation, reconnaissance, sentiment d'appartenance et liberté d'être soi-même.",
    understand:
      "Tu es particulièrement sensible au regard des autres et tu peux craindre de ne pas être pleinement accepté(e) ou de ne pas avoir ta place au sein de ta famille ou de tes relations.",
    signs: [
      "une tendance à te mettre en retrait ou à ne pas exprimer tes besoins et tes émotions ;",
      "une difficulté à demander de l'aide ou à partager ce que tu ressens par peur d'être jugé(e) ;",
      "une autocritique importante qui limite ta spontanéité.",
    ],
    actions: [
      "Exprime chaque jour un besoin, une opinion ou une émotion à un proche.",
      "Demande à une personne de confiance ce qu'elle apprécie chez toi afin d'accueillir un regard positif.",
      "Prends quelques minutes pour noter les moments où tu t'es senti(e) écouté(e), reconnu(e) ou accepté(e).",
    ],
  },
  {
    id: "abandon",
    name: "Abandon",
    mask: "Dépendant",
    color: "#2b8a7e",
    needs: "Soutien rassurant, autonomie progressive et confiance en ses ressources.",
    understand:
      "Tu crains d'être laissé(e) seul(e), de ne pas être suffisamment soutenu(e) ou de devoir faire face aux difficultés sans appui.",
    signs: [
      "un besoin fréquent d'être rassuré(e), encouragé(e) ou validé(e) par tes proches ;",
      "une difficulté à prendre certaines décisions seul(e) ;",
      "une peur de la distance affective ou du manque de disponibilité des personnes importantes pour toi.",
    ],
    actions: [
      "Identifie clairement les situations où tu as réellement besoin de soutien et celles que tu peux gérer seul(e).",
      "Accorde-toi chaque jour un moment pour prendre une décision sans rechercher immédiatement l'avis des autres.",
      "Lorsque tu demandes de l'aide, exprime précisément ton besoin plutôt que d'attendre que l'autre le devine.",
    ],
  },
  {
    id: "humiliation",
    name: "Humiliation",
    mask: "Masochiste",
    color: "#c97a2b",
    needs: "Respect, reconnaissance, estime de soi et droit de poser des limites.",
    understand:
      "Tu as tendance à t'oublier pour préserver les autres, à culpabiliser lorsque tu penses à toi ou à accepter davantage que ce que tu souhaiterais réellement.",
    signs: [
      "une difficulté à dire non ou à poser des limites claires ;",
      "une tendance à faire passer les besoins des autres avant les tiens ;",
      "une minimisation de tes réussites ou de ta valeur.",
    ],
    actions: [
      "Identifie une limite importante que tu souhaites faire respecter dans ta vie familiale ou relationnelle.",
      "Exerce-toi à dire non avec bienveillance, en proposant si besoin une autre solution ou un autre moment.",
      "Note chaque semaine trois situations où tu as pris soin de toi ou où tu as affirmé tes besoins avec respect.",
    ],
  },
  {
    id: "injustice",
    name: "Injustice",
    mask: "Rigide",
    color: "#3d6fb4",
    needs: "Équité, cohérence, clarté et droit à l'imperfection.",
    understand:
      "Tu es particulièrement sensible au respect des règles, à l'équité et à la cohérence dans les relations. Tu es également exigeant(e) envers toi-même comme envers les autres.",
    signs: [
      "des attentes élevées envers toi-même, ton partenaire ou tes proches ;",
      "une difficulté à accepter les imperfections, les imprévus ou les différences de fonctionnement ;",
      "une forte réaction lorsque tu as le sentiment qu'une situation est injuste ou déséquilibrée.",
    ],
    actions: [
      "Accepte qu'une situation puisse être satisfaisante sans être parfaite.",
      "Prends le temps d'échanger sur les attentes de chacun afin d'éviter les incompréhensions et de rechercher un équilibre.",
      "Lorsque tu ressens une injustice, exprime d'abord le besoin touché (respect, équité, reconnaissance...) avant de formuler une demande concrète.",
    ],
  },
];

// 10 questions par blessure, dans l'ordre du test original (Q1-50).
const QUESTIONS = [
  // Trahison (1-10)
  "J'ai besoin de m'assurer que les choses sont faites comme convenu.",
  "J'ai du mal à laisser les autres gérer une situation sans intervenir.",
  "Je ressens une forte déception ou de la colère lorsqu'une promesse n'est pas tenue.",
  "J'anticipe les difficultés afin d'éviter les mauvaises surprises.",
  "Je peux me sentir blessé(e) lorsque la confiance est rompue ou que je me sens trompé(e).",
  "Je protège ce qui est important pour moi, ainsi que les personnes auxquelles je tiens.",
  "Je remarque rapidement les écarts entre ce qui est dit et ce qui est réellement fait.",
  "J'éprouve le besoin que les échanges se terminent sur une compréhension claire et partagée.",
  "Il me faut du temps pour accorder pleinement ma confiance à une nouvelle personne.",
  "Je préfère prendre les choses en main pour être certain(e) que tout se passe bien.",
  // Rejet (11-20)
  "Je préfère rester en retrait lors des échanges professionnels ou familiaux.",
  "Je crains que mes opinions, mes choix ou mes émotions soient mal compris ou jugés.",
  "J'ai tendance à minimiser mes qualités ou mes réussites pour ne pas attirer l'attention sur moi.",
  "Il m'arrive de douter de ma place au sein d'une équipe, de ma famille ou dans mes relations.",
  "J'hésite à demander de l'aide ou du soutien, de peur de déranger ou de peser sur les autres.",
  "Je crains de ne pas être suffisamment apprécié(e) ou de ne pas répondre aux attentes de mes proches ou de mes collègues.",
  "J'évite les situations où je pourrais être particulièrement exposé(e) ou au centre de l'attention.",
  "J'ai du mal à accueillir les compliments ou les marques d'affection sans les remettre en question.",
  "Je préfère me taire plutôt que d'exprimer mon point de vue ou mes besoins.",
  "Je ne trouve pas pleinement ma place dans certaines relations professionnelles ou au sein de mon entourage.",
  // Abandon (21-30)
  "J'ai besoin d'être rassuré(e) ou encouragé(e) avant de prendre une décision importante.",
  "Je me sens démuni(e) lorsque je dois faire face seul(e) à une situation difficile.",
  "Je crains d'être mis(e) à l'écart ou de ne plus avoir ma place auprès des personnes qui comptent pour moi.",
  "J'ai besoin de sentir que mes collègues ou proches sont présents et disponibles lorsque j'ai besoin d'eux.",
  "Je peux ressentir de l'angoisse lorsque mes messages ou mes appels restent sans réponse pendant un certain temps.",
  "Je fais beaucoup d'efforts pour être aimé(e), apprécié(e) ou ne pas décevoir les autres.",
  "Je crains de perdre la confiance, l'affection ou le soutien de mes proches.",
  "Je crains de décevoir les personnes qui sont importantes à mes yeux.",
  "Je me sens plus serein(e) lorsque je bénéficie d'un cadre rassurant ou de repères clairs.",
  "J'ai besoin de me sentir accompagné(e) et soutenu(e), surtout lorsque je traverse une période d'incertitude.",
  // Humiliation (31-40)
  "Je redoute de faire une erreur ou d'être jugé(e) devant les personnes qui me sont proches.",
  "J'ai tendance à en faire plus que nécessaire pour répondre aux attentes de ma famille, de mon entourage ou dans mon travail.",
  "J'ai du mal à dire non, de peur de décevoir ou d'être perçu(e) comme égoïste.",
  "Je me sens mal à l'aise lorsque l'on me complimente ou que l'on attire l'attention sur moi.",
  "J'ai tendance à minimiser mes qualités ou à me dévaloriser dans mes propos.",
  "Je fais souvent passer les besoins et le bien-être des autres avant les miens.",
  "Je préfère supporter une situation qui me fait souffrir plutôt que d'exprimer ce que je ressens ou de poser mes limites.",
  "Je crains que mes erreurs ou mes fragilités modifient le regard que les autres portent sur moi.",
  "Je ressens facilement de la honte ou de la culpabilité lorsque je n'atteins pas ce que j'attendais de moi-même.",
  "Je fais beaucoup d'efforts pour montrer que je suis à la hauteur et pour ne pas donner l'impression d'être insuffisant(e).",
  // Injustice (41-50)
  "Je suis particulièrement sensible lorsque je perçois un traitement inégal ou injuste entre les membres de ma famille ou de mon entourage.",
  "J'accorde beaucoup d'importance au respect des règles, des valeurs et des engagements partagés.",
  "J'ai des attentes élevées envers moi-même, mais aussi envers les personnes qui me sont proches.",
  "Je ressens de la frustration lorsque les efforts, les attentions ou les responsabilités de chacun ne me semblent pas reconnus de manière équitable.",
  "J'ai du mal à accepter les décisions qui me paraissent injustifiées, incohérentes ou prises sans concertation.",
  "J'aime faire les choses avec sérieux et j'ai tendance à rechercher la qualité ou la perfection dans ce que j'entreprends.",
  "J'accepte difficilement que les mêmes comportements ou erreurs se répètent sans qu'ils soient pris en compte.",
  "Je prends naturellement la défense des personnes que je perçois comme injustement traitées.",
  "Les favoritismes ou les privilèges qui me semblent immérités peuvent susciter chez moi de l'agacement.",
  "J'apprécie que les règles de vie, les attentes et les responsabilités soient clairement définies et appliquées de manière équitable à chacun.",
];

// Construit la liste finale des questions avec leur blessure associée.
const QUIZ = QUESTIONS.map((text, index) => ({
  id: index + 1,
  text,
  woundId: WOUNDS[Math.floor(index / 10)].id,
}));

const ANSWER_OPTIONS = [
  { value: 1, label: "Non" },
  { value: 2, label: "Parfois" },
  { value: 3, label: "Oui" },
];

// Chaque blessure est notée sur 10 questions (max 30 points bruts),
// ramenée sur 50 pour correspondre au barème de lecture du test original.
function levelFor(score) {
  if (score >= 40) return { label: "Blessure dominante", tier: "high" };
  if (score >= 29) return { label: "Blessure modérée", tier: "moderate" };
  if (score >= 20) return { label: "Blessure peu présente", tier: "low" };
  return { label: "Blessure peu marquée", tier: "minimal" };
}

// Tout le contenu du test est écrit avec la convention "mot(e)" (ex.
// "accepté(e)"). genderize() résout cette convention selon le genre choisi :
// "homme" -> "accepté", "femme" (ou toute autre valeur) -> "acceptée".
function genderize(text, gender) {
  if (typeof text !== "string") return text;
  return gender === "homme" ? text.replace(/\(e\)/g, "") : text.replace(/\(e\)/g, "e");
}

// Indicatifs téléphoniques proposés à la saisie. Les pays francophones les
// plus probables pour ce test sont placés en tête ; la liste reste courte
// volontairement (une liste mondiale complète nuirait à la lisibilité sur
// mobile). L'indicatif est obligatoire : combiné au numéro national, il
// forme l'identifiant international qui relie les tests successifs d'une
// même personne.
const PHONE_COUNTRIES = [
  { code: "+33", label: "France +33" },
  { code: "+32", label: "Belgique +32" },
  { code: "+41", label: "Suisse +41" },
  { code: "+1", label: "Canada / USA +1" },
  { code: "+352", label: "Luxembourg +352" },
  { code: "+225", label: "Côte d'Ivoire +225" },
  { code: "+237", label: "Cameroun +237" },
  { code: "+221", label: "Sénégal +221" },
  { code: "+243", label: "RD Congo +243" },
  { code: "+242", label: "Congo-Brazzaville +242" },
  { code: "+241", label: "Gabon +241" },
  { code: "+229", label: "Bénin +229" },
  { code: "+228", label: "Togo +228" },
  { code: "+226", label: "Burkina Faso +226" },
  { code: "+223", label: "Mali +223" },
  { code: "+224", label: "Guinée +224" },
  { code: "+227", label: "Niger +227" },
  { code: "+235", label: "Tchad +235" },
  { code: "+236", label: "Centrafrique +236" },
  { code: "+261", label: "Madagascar +261" },
  { code: "+230", label: "Maurice +230" },
  { code: "+509", label: "Haïti +509" },
  { code: "+212", label: "Maroc +212" },
  { code: "+213", label: "Algérie +213" },
  { code: "+216", label: "Tunisie +216" },
  { code: "+44", label: "Royaume-Uni +44" },
  { code: "+49", label: "Allemagne +49" },
  { code: "+34", label: "Espagne +34" },
  { code: "+39", label: "Italie +39" },
  { code: "+351", label: "Portugal +351" },
];

const DEFAULT_PHONE_COUNTRY = "+33";

// Assemble indicatif + numéro national en un numéro international
// normalisé (chiffres uniquement, précédés de "+"). Le 0 initial des
// numéros nationaux (ex. "06 12 34 56 78" en France) est retiré : il ne
// s'utilise pas derrière un indicatif international.
function buildInternationalPhone(countryCode, nationalNumber) {
  const digits = String(nationalNumber || "").replace(/\D/g, "").replace(/^0+/, "");
  const code = String(countryCode || "").replace(/[^\d+]/g, "");
  if (!digits || !code) return "";
  return `${code}${digits}`;
}
