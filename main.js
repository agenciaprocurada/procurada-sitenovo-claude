/* ===========================================================
   PROCURADA — interações + GSAP
   =========================================================== */
(function () {
  "use strict";

  const hasGSAP = window.gsap && window.ScrollTrigger;
  const root = document.documentElement;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- NAV: estado "scrolled" ---------- */
  const nav = document.getElementById("nav");
  const onScrollNav = () => nav.classList.toggle("scrolled", window.scrollY > 24);
  onScrollNav();
  window.addEventListener("scroll", onScrollNav, { passive: true });

  if (!hasGSAP || reduce) {
    // Fallback: tudo visível, sem animação.
    root.classList.remove("no-gsap");
    document.querySelectorAll("[data-reveal],[data-hero]").forEach((el) => {
      el.style.opacity = "1";
      el.style.transform = "none";
    });
    return;
  }

  root.classList.remove("no-gsap");
  const { gsap } = window;
  gsap.registerPlugin(window.ScrollTrigger);

  /* ===========================================================
     HERO — entrada impactante (load) do logo e dos textos.
     ----------------------------------------------------------
     A "mídia" (#hero-media .media-el) é o placeholder do vídeo
     GSAP scroll-scrub. O parallax/zoom abaixo já está ligado ao
     progresso do scroll do #hero — no Claude Code, troque o
     <img> por <video>/<canvas> e dirija o frame por `self.progress`.
     =========================================================== */
  const media = document.querySelector("[data-hero-media]");
  const q = (s) => document.querySelector(`[data-hero="${s}"]`);
  const titleWords = gsap.utils.toArray(".hero h1 .word");

  // estado inicial
  gsap.set([q("logo"), q("eyebrow"), q("sub"), q("actions"), q("cue")], { opacity: 0 });
  gsap.set(q("logo"), { y: 30, scale: 0.92, filter: "blur(8px)" });
  gsap.set(q("eyebrow"), { y: 18, letterSpacing: "0.6em" });
  gsap.set(titleWords, { opacity: 0, yPercent: 120, rotateX: -40 });
  gsap.set(q("sub"), { y: 22 });
  gsap.set(q("actions"), { y: 18 });
  gsap.set(media, { scale: 1.16, filter: "saturate(0.7) brightness(0.55)" });

  const intro = gsap.timeline({ defaults: { ease: "power3.out" }, delay: 0.15 });
  intro
    .to(media, { scale: 1.06, filter: "saturate(1.05) contrast(1.02) brightness(1)", duration: 1.6, ease: "power2.out" }, 0)
    .to(q("logo"), { opacity: 1, y: 0, scale: 1, filter: "blur(0px)", duration: 1.0 }, 0.15)
    .to(q("eyebrow"), { opacity: 1, y: 0, letterSpacing: "0.42em", duration: 0.7 }, 0.5)
    .to(titleWords, { opacity: 1, yPercent: 0, rotateX: 0, duration: 0.9, stagger: 0.08, ease: "power4.out" }, 0.6)
    .to(q("sub"), { opacity: 1, y: 0, duration: 0.7 }, 1.15)
    .to(q("actions"), { opacity: 1, y: 0, duration: 0.7 }, 1.3)
    .to(q("cue"), { opacity: 1, duration: 0.6 }, 1.5);

  // Segurança: se por algum motivo o intro não progredir (rAF travado, etc.),
  // garante que o conteúdo da hero apareça.
  setTimeout(() => {
    if (parseFloat(getComputedStyle(q("logo")).opacity) < 0.05) {
      intro.progress(1);
    }
  }, 4200);

  /* ---------- HERO scroll-scrub: parallax + saída dos textos ----------
     Demonstra o gancho para o vídeo GSAP. self.progress (0→1) percorre
     toda a passagem da hero. */
  const heroContent = document.querySelector(".hero__inner");
  gsap.timeline({
    scrollTrigger: {
      trigger: "#topo",
      start: "top top",
      end: "+=90%",
      scrub: 1,
      // pin: true,  // ative junto com o vídeo scroll-scrub no Claude Code
    },
  })
    .to(media, { scale: 1.22, yPercent: 8, filter: "saturate(1.15) brightness(1.05)", ease: "none" }, 0)
    .to(heroContent, { yPercent: -12, opacity: 0.0, ease: "none" }, 0)
    .to(q("cue"), { opacity: 0, duration: 0.2 }, 0);

  /* ===========================================================
     REVEALS — entrada das seções
     =========================================================== */
  gsap.utils.toArray("[data-reveal]").forEach((el) => {
    gsap.fromTo(
      el,
      { opacity: 0, y: 42 },
      {
        opacity: 1,
        y: 0,
        duration: 0.9,
        ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 86%", once: true },
      }
    );
  });

  // stagger interno em grids
  ["#servicos .services-grid", "#cases .cases-grid", "#processo .steps"].forEach((sel) => {
    const grid = document.querySelector(sel);
    if (!grid) return;
    const items = grid.children;
    gsap.fromTo(
      items,
      { opacity: 0, y: 40 },
      {
        opacity: 1,
        y: 0,
        duration: 0.7,
        ease: "power3.out",
        stagger: 0.09,
        scrollTrigger: { trigger: grid, start: "top 82%", once: true },
      }
    );
  });

  /* ===========================================================
     CONTADORES
     =========================================================== */
  gsap.utils.toArray("[data-count]").forEach((el) => {
    const target = parseFloat(el.getAttribute("data-count"));
    const suffix = el.getAttribute("data-suffix") || "";
    const obj = { v: 0 };
    ScrollTrigger.create({
      trigger: el,
      start: "top 88%",
      once: true,
      onEnter: () => {
        gsap.to(obj, {
          v: target,
          duration: 1.6,
          ease: "power2.out",
          onUpdate: () => {
            el.textContent = Math.round(obj.v) + suffix;
          },
        });
      },
    });
  });

  ScrollTrigger.refresh();
})();
