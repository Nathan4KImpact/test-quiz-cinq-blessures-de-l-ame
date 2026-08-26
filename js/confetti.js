/**
 * Petit confetti maison, sans dépendance.
 *
 * Lancé une seule fois quand l'écran de résultats annonce un progrès. Le
 * canvas est créé à la demande, posé au-dessus de la page en
 * pointer-events:none (il ne doit jamais intercepter un clic), puis retiré
 * du DOM à la fin de l'animation. Respecte prefers-reduced-motion : les
 * personnes qui ont désactivé les animations ne voient rien bouger, le
 * bandeau de félicitations suffit à porter le message.
 */

const CONFETTI_COLORS = ["#c2478b", "#7c5cbf", "#2b8a7e", "#c97a2b", "#3d6fb4", "#f2c14e"];
const CONFETTI_COUNT = 90;
const CONFETTI_DURATION_MS = 2600;

function launchConfetti() {
  if (typeof window === "undefined" || !window.requestAnimationFrame) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const canvas = document.createElement("canvas");
  canvas.className = "confetti-canvas";
  canvas.setAttribute("aria-hidden", "true");
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  let width = window.innerWidth;
  let height = window.innerHeight;

  function size() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  size();
  window.addEventListener("resize", size);
  document.body.appendChild(canvas);

  // Les pièces partent du haut de l'écran, avec une vitesse et une
  // rotation propres à chacune pour éviter l'effet "pluie régulière".
  const pieces = Array.from({ length: CONFETTI_COUNT }, () => ({
    x: Math.random() * width,
    y: -20 - Math.random() * height * 0.5,
    w: 6 + Math.random() * 6,
    h: 9 + Math.random() * 8,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    vy: 2.2 + Math.random() * 2.6,
    vx: -1.2 + Math.random() * 2.4,
    angle: Math.random() * Math.PI * 2,
    spin: -0.12 + Math.random() * 0.24,
  }));

  const start = performance.now();

  function frame(now) {
    const elapsed = now - start;
    // Fondu sur le dernier tiers : la disparition ne doit pas être sèche.
    const fade = Math.max(0, Math.min(1, (CONFETTI_DURATION_MS - elapsed) / 700));

    ctx.clearRect(0, 0, width, height);
    ctx.globalAlpha = fade;

    pieces.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.angle += p.spin;
      // Léger balancement latéral, comme une pièce de papier qui tombe.
      p.vx += (Math.random() - 0.5) * 0.06;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });

    if (elapsed < CONFETTI_DURATION_MS) {
      window.requestAnimationFrame(frame);
    } else {
      window.removeEventListener("resize", size);
      canvas.remove();
    }
  }

  window.requestAnimationFrame(frame);
}
