/* Auto Estufa Vitoriano — script principal (GSAP + ScrollTrigger) */

// ⚠️ NÚMERO DO WHATSAPP: somente dígitos, com DDI+DDD (Brasil = 55). Ex.: "5511999999999"
const WHATSAPP_NUMBER = "5511984055055"; // ← troque aqui se o número mudar
// 📍 Link do Google Maps da oficina (troque pelo link exato, se tiver).
const GOOGLE_MAPS_URL = "https://www.google.com/maps/search/?api=1&query=Rua+Max+Mangels+S%C3%AAnior%2C+466%2C+S%C3%A3o+Bernardo+do+Campo+-+SP";
const COMPANY = "Auto Estufa Vitoriano";

const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const fine = matchMedia("(hover:hover) and (pointer:fine)").matches;
const isMobile = /Android|iPhone|iPad|iPod|Mobi/i.test(navigator.userAgent);
const hasGsap = typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined";
if (!hasGsap) document.addEventListener("DOMContentLoaded", () => $("#waFloat").classList.add("on"));

/* ---------- WhatsApp ---------- */
function openExternal(url) {
  const w = window.open(url, "_blank");
  if (w) { w.opener = null; return; }
  try { window.top.location.href = url; } catch (e) { location.href = url; } // pop-up bloqueado
}
function openWhatsApp(text) {
  const t = encodeURIComponent(text);
  const url = isMobile
    ? `https://wa.me/${WHATSAPP_NUMBER}?text=${t}`
    : `https://web.whatsapp.com/send?phone=${WHATSAPP_NUMBER}&text=${t}`;
  openExternal(url);
}
$$("[data-wa]").forEach((a) => a.addEventListener("click", (e) => {
  e.preventDefault();
  openWhatsApp(`Olá! Gostaria de saber mais sobre os serviços da ${COMPANY}.`);
}));

$$("[data-maps]").forEach((a) => (a.href = GOOGLE_MAPS_URL));

/* ---------- Formulários (página + modais) ---------- */
const thisYear = new Date().getFullYear();
function validate(form, rules) {
  let first = null;
  for (const [name, ok] of Object.entries(rules)) {
    const wrap = form.querySelector(`[data-f="${name}"]`);
    wrap.classList.toggle("has-error", !ok(form.elements[name].value.trim()));
    if (!first && wrap.classList.contains("has-error")) first = form.elements[name];
  }
  first?.focus();
  return !first;
}
const req = (v) => !!v;
const anoOk = (v) => !v || (/^\d{4}$/.test(v) && +v >= 1950 && +v <= thisYear + 1);
const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const brDate = (iso) => iso.split("-").reverse().join("/");
const bind = (form, rules, build, after) => {
  form.addEventListener("input", (e) => e.target.closest(".field")?.classList.remove("has-error"));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!validate(form, rules)) return;
    const v = Object.fromEntries(new FormData(form).entries());
    Object.keys(v).forEach((k) => (v[k] = String(v[k]).trim()));
    openWhatsApp(build(v));
    after?.();
  });
};
const veic = (v) => `Veículo: ${v.veiculo}${v.ano ? ` (${v.ano})` : ""}`;

// modal: solicitar orçamento
const cepOk = (v) => !v || v.replace(/\D/g, "").length === 8;
bind($("#formQuote"), { nome: req, veiculo: req, ano: anoOk, servico: req, cep: cepOk }, (v) =>
  `Olá! Meu nome é ${v.nome}.\n\nGostaria de solicitar um orçamento.\n\n${veic(v)}\nServiço: ${v.servico}` +
  (v.rua ? `\nEndereço: ${v.rua}, ${v.bairro} - ${v.cidade}/${v.estado} - CEP ${v.cep}` : "") +
  (v.desc ? `\n\nO que precisa ser feito:\n${v.desc}` : "") + `\n\nAguardo retorno. Obrigado!`, () => closeModal());

// modal: levar o carro à oficina (apenas solicitação, não é reserva)
const formVisit = $("#formVisit");
bind(formVisit, { nome: req, veiculo: req, ano: anoOk, data: (v) => !!v && v >= today(), hora: req, servico: req, cep: cepOk }, (v) =>
  `Olá! Meu nome é ${v.nome}.\n\nGostaria de solicitar um horário para levar meu carro à oficina.\n\n${veic(v)}\n` +
  `Serviço: ${v.servico}\nData desejada: ${brDate(v.data)}\nHorário desejado: ${v.hora}` +
  (v.rua ? `\nEndereço: ${v.rua}, ${v.bairro} - ${v.cidade}/${v.estado} - CEP ${v.cep}` : "") +
  (v.desc ? `\n\nO que precisa ser feito:\n${v.desc}` : "") +
  `\n\nEntendo que é apenas uma solicitação e que o horário precisa ser confirmado pela equipe. Aguardo retorno!`, () => closeModal());


/* ---------- CEP: busca endereço na ViaCEP (sem backend) ---------- */
function setupCep(form, hintId) {
  const inp = form.elements.cep, hint = document.getElementById(hintId), addr = form.querySelector(".addr");
  if (!inp) return;
  const digits = (v) => v.replace(/\D/g, "").slice(0, 8);
  inp.addEventListener("input", () => { inp.value = digits(inp.value).replace(/(\d{5})(\d)/, "$1-$2"); });
  let timer = null, token = 0;
  inp.addEventListener("input", () => {
    clearTimeout(timer);
    const cep = digits(inp.value);
    hint.hidden = !cep; hint.className = "field__hint";
    if (cep.length < 8) { addr.classList.remove("show"); return; }
    const my = ++token;
    hint.hidden = false; hint.classList.add("loading"); hint.textContent = "Buscando endereço…";
    timer = setTimeout(async () => {
      try {
        const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const d = await r.json();
        if (my !== token) return;
        if (d.erro) { hint.className = "field__hint bad"; hint.textContent = "CEP não encontrado."; addr.classList.remove("show"); return; }
        form.elements.rua.value = d.logradouro || "";
        form.elements.bairro.value = d.bairro || "";
        form.elements.cidade.value = d.localidade || "";
        form.elements.estado.value = d.uf || "";
        hint.className = "field__hint ok"; hint.textContent = "Endereço encontrado.";
        addr.classList.add("show");
        (d.logradouro ? form.elements.bairro : form.elements.rua).focus({ preventScroll: true });
      } catch (e) { if (my === token) { hint.className = "field__hint bad"; hint.textContent = "Não foi possível buscar o CEP agora."; } }
    }, 450);
  });
}
setupCep($("#formQuote"), "cepHintQuote");
setupCep($("#formVisit"), "cepHintVisit");

/* ---------- Botão flutuante + modais ---------- */
const fab = $("#waFloat"), fabMain = $("#fabMain"), scrim = $("#fabScrim");
let openModal = null, lastFocus = null;
const setFab = (open) => {
  fab.classList.toggle("is-open", open); scrim.classList.toggle("on", open);
  fabMain.setAttribute("aria-expanded", open);
};
function showModal(id) {
  setFab(false);
  openModal = $(id); lastFocus = fabMain;
  if (id === "#modalVisit") formVisit.elements.data.min = today();
  openModal.classList.add("is-open"); openModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  setTimeout(() => openModal?.querySelector("input,select")?.focus({ preventScroll: true }), 350);
}
function closeModal() {
  if (!openModal) return;
  openModal.classList.remove("is-open"); openModal.setAttribute("aria-hidden", "true");
  openModal = null; document.body.style.overflow = "";
  lastFocus?.focus({ preventScroll: true });
}
fabMain.addEventListener("click", () => setFab(!fab.classList.contains("is-open")));
scrim.addEventListener("click", () => setFab(false));
$$("[data-act]").forEach((b) => b.addEventListener("click", () => {
  const a = b.dataset.act;
  if (a === "quote") showModal("#modalQuote");
  else if (a === "visit") showModal("#modalVisit");
  else { setFab(false); a === "maps" ? openExternal(GOOGLE_MAPS_URL) : openWhatsApp("Olá! Vim pelo site e gostaria de saber mais sobre os serviços da oficina."); }
}));
$$(".modal").forEach((m) => m.addEventListener("pointerdown", (e) => { if (e.target === m) closeModal(); }));
$$("[data-close]").forEach((b) => b.addEventListener("click", closeModal));
addEventListener("keydown", (e) => { if (e.key === "Escape") { closeModal(); setFab(false); } });

/* ---------- Navegação ---------- */
const nav = $("#nav"), burger = $("#burger"), menu = $("#menu");
const setMenu = (open) => {
  menu.classList.toggle("is-open", open);
  burger.setAttribute("aria-expanded", open);
  document.body.style.overflow = open ? "hidden" : "";
};
burger.addEventListener("click", () => setMenu(!menu.classList.contains("is-open")));
addEventListener("keydown", (e) => e.key === "Escape" && setMenu(false));
$$("[data-go]").forEach((a) => a.addEventListener("click", (e) => {
  const id = a.getAttribute("href");
  if (!id || id[0] !== "#") return;
  e.preventDefault();
  setMenu(false);
  const el = $(id);
  if (el) scrollTo({ top: el.getBoundingClientRect().top + scrollY, behavior: reduce ? "auto" : "smooth" });
}));
const onScrollNav = () => nav.classList.toggle("is-solid", scrollY > 60);
addEventListener("scroll", onScrollNav, { passive: true }); onScrollNav();
$("#year").textContent = new Date().getFullYear();

/* ---------- Comparador Antes / Depois ---------- */
function initCompare() {
  const box = $("#cmp");
  let pos = 50, drag = false, intro = null;
  const set = (v) => {
    pos = Math.max(0, Math.min(100, v));
    box.style.setProperty("--pos", pos + "%");
    box.setAttribute("aria-valuenow", Math.round(pos));
  };
  const fromX = (cx) => { const r = box.getBoundingClientRect(); set(((cx - r.left) / r.width) * 100); };
  const stopIntro = () => { intro?.kill(); intro = null; };
  box.addEventListener("pointerdown", (e) => {
    stopIntro(); drag = true; box.classList.add("is-drag");
    box.setPointerCapture(e.pointerId); fromX(e.clientX);
  });
  box.addEventListener("pointermove", (e) => { if (drag) fromX(e.clientX); }); // só move enquanto o botão/dedo estiver pressionado
  const end = () => { drag = false; box.classList.remove("is-drag"); };
  box.addEventListener("pointerup", end); box.addEventListener("pointercancel", end);
  box.addEventListener("keydown", (e) => {
    const d = { ArrowLeft: -4, ArrowRight: 4, Home: -100, End: 100 }[e.key];
    if (d) { e.preventDefault(); stopIntro(); set(pos + d); }
  });
  set(0);
  if (hasGsap && !reduce) {
    ScrollTrigger.create({ trigger: box, start: "top 75%", once: true, onEnter: () => {
      const o = { v: 0 };
      intro = gsap.to(o, { v: 50, duration: 1.8, ease: "power3.inOut", onUpdate: () => set(o.v) });
    } });
  } else set(50);
}
initCompare();

/* ---------- Carro 3D (carregamento sob demanda) ---------- */
let carMod = null, carP = 0, carActive = false;
function initCar() {
  const sec = $("#experiencia");
  const io = new IntersectionObserver(async ([en]) => {
    if (!en.isIntersecting || carMod) return;
    io.disconnect();
    try {
      const m = await import("./car3d.js");
      carMod = m.createCar($("#carCanvas"), "models/car.glb", () => $("#carCanvas").classList.add("is-ready"));
      if (!carMod) sec.classList.add("no-webgl");
      else { carMod.setProgress(carP); carMod.setActive(carActive); }
    } catch (err) { console.error("Falha ao iniciar o 3D:", err); sec.classList.add("no-webgl"); }
  }, { rootMargin: "800px 0px" });
  io.observe(sec);
  addEventListener("pagehide", () => carMod?.dispose());
}
initCar();

/* ---------- Animações ---------- */
function initMotion() {
  gsap.registerPlugin(ScrollTrigger);

  // Hero: entrada (após o loader) + saída ligada ao scroll
  const heroIn = () => {
    gsap.fromTo("#inicio h1 .mask>span", { yPercent: 110, rotate: 2 }, { yPercent: 0, rotate: 0, duration: 1.4, ease: "expo.out", stagger: 0.12 });
    gsap.fromTo("[data-hero-fade]", { y: 24, opacity: 0, filter: "blur(8px)" }, { y: 0, opacity: 1, filter: "blur(0px)", duration: 1.2, ease: "power3.out", delay: 0.6, stagger: 0.12 });
    gsap.fromTo("#heroBg img", { scale: 1.2 }, { scale: 1, duration: 2.4, ease: "expo.out" });
    gsap.fromTo("#heroSweep", { xPercent: -120 }, { xPercent: 120, duration: 2.6, ease: "power2.inOut", delay: 0.3 });
  };
  window.__heroIn = heroIn;

  if (!reduce) {
    const hero = gsap.timeline({ scrollTrigger: { trigger: "#inicio", start: "top top", end: "bottom top", scrub: true } });
    hero.to("#heroBg", { scale: 1.3, filter: "blur(10px)", opacity: 0.35, yPercent: 8, ease: "none" }, 0)
        .to("#heroInner", { yPercent: -18, opacity: 0, filter: "blur(10px)", ease: "none" }, 0);

    // Sobre
    $$(".about h2 .mask>span").forEach((s, i) => gsap.from(s, { yPercent: 110, ease: "none", scrollTrigger: { trigger: s, start: "top 98%", end: "top 62%", scrub: 0.6 } }));
    $$("[data-rise]").forEach((el) => gsap.from(el, { y: 50, opacity: 0, filter: "blur(6px)", ease: "none", scrollTrigger: { trigger: el, start: "top 95%", end: "top 70%", scrub: 0.6 } }));
    $$(".about__lines i").forEach((l, i) => gsap.from(l, { scaleY: 0, ease: "none", scrollTrigger: { trigger: ".about", start: "top 90%", end: "bottom 50%", scrub: 1 + i * 0.3 } }));
    gsap.to(".about__img img", { yPercent: 8, ease: "none", scrollTrigger: { trigger: ".about", scrub: true } });

    // Títulos de seção
    $$(".services__head .mask>span,.projects__head .mask>span,.ba__head .mask>span,.process__side .mask>span,.contact__side .mask>span,.final .mask>span").forEach((s) =>
      gsap.from(s, { yPercent: 110, duration: 1.3, ease: "expo.out", scrollTrigger: { trigger: s, start: "top 92%", toggleActions: "play none none reverse" } }));

    // Pintura: a imagem cresce e o texto acompanha
    const paint = gsap.timeline({ scrollTrigger: { trigger: "#pintura", start: "top top", end: "bottom bottom", scrub: 0.8 } });
    paint.fromTo("#paintMedia", { clipPath: "inset(28% 30% 28% 30%)" }, { clipPath: "inset(0% 0% 0% 0%)", ease: "power2.inOut", duration: 0.5 }, 0)
         .fromTo("#pintura img", { scale: 1.5, filter: "blur(14px)" }, { scale: 1, filter: "blur(0px)", ease: "none", duration: 1 }, 0)
         .from("#pintura .mask>span", { yPercent: 110, stagger: 0.08, duration: 0.3, ease: "power3.out" }, 0.35)
         .from("#pintura .lead,#pintura .tag", { opacity: 0, y: 20, duration: 0.2 }, 0.6)
         .from("#pintura .stage__hud i", { scaleX: 0, stagger: 0.1, duration: 0.2 }, 0.65);

    // Polimento: aproximação lenta, frases e luz varrendo
    const words = $$("#polishWords span"), phr = $$("#polishPhrase p");
    gsap.set(phr, { opacity: 0, y: 40, filter: "blur(10px)" });
    ScrollTrigger.create({ trigger: "#polimento", start: "top top", end: "bottom bottom", scrub: true, onUpdate: (s) => {
      const p = s.progress, i = p < 0.33 ? 0 : p < 0.66 ? 1 : 2;
      words.forEach((w, k) => w.classList.toggle("on", k === i));
    } });
    const pol = gsap.timeline({ scrollTrigger: { trigger: "#polimento", start: "top top", end: "bottom bottom", scrub: 0.8 } });
    pol.fromTo("#polishMedia", { clipPath: "inset(18% 12% 18% 12%)" }, { clipPath: "inset(0% 0% 0% 0%)", ease: "none", duration: 0.25 }, 0)
       .fromTo("#polimento img", { scale: 1 }, { scale: 1.35, ease: "none", duration: 1 }, 0)
       .fromTo("#polishLight", { xPercent: -100 }, { xPercent: 100, ease: "none", duration: 1 }, 0)
       .to(phr[0], { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.15 }, 0.1)
       .to(phr[0], { opacity: 0, y: -30, filter: "blur(10px)", duration: 0.15 }, 0.5)
       .to(phr[1], { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.15 }, 0.62);

    // Projetos: moldura abre, imagem em parallax, meta desliza
    $$(".proj").forEach((p) => {
      gsap.to($(".proj__frame", p), { clipPath: "inset(0% 0% 0% 0%)", ease: "none", scrollTrigger: { trigger: p, start: "top 85%", end: "top 25%", scrub: 0.8 } });
      gsap.fromTo($(".proj__frame img", p), { yPercent: -6, scale: 1.2 }, { yPercent: 6, scale: 1, ease: "none", scrollTrigger: { trigger: p, start: "top bottom", end: "bottom top", scrub: true } });
      gsap.from($$(".proj__meta > *", p), { y: 60, opacity: 0, filter: "blur(8px)", stagger: 0.1, ease: "none", scrollTrigger: { trigger: p, start: "top 60%", end: "top 20%", scrub: 0.8 } });
    });


    // Cards de contato: entram em sequência (máscara sobe, foto assenta, textos deslizam)
    gsap.set(".tile", { clipPath: "inset(100% 0% 0% 0%)", y: 60, opacity: 0 });
    ScrollTrigger.batch(".tile", { start: "top 92%", once: true, onEnter: (els) => {
      gsap.to(els, { clipPath: "inset(0% 0% 0% 0%)", y: 0, opacity: 1, duration: 1.3, ease: "expo.out", stagger: 0.14, clearProps: "clipPath,transform,opacity" });
      gsap.fromTo(els.map((e) => $("img", e)), { scale: 1.4 }, { scale: 1, duration: 2, ease: "expo.out", stagger: 0.14, clearProps: "transform" });
      gsap.from(els.flatMap((e) => [$(".tile__ico", e), $("b", e), $("b + span", e)]), { y: 26, opacity: 0, duration: 0.9, ease: "power3.out", delay: 0.4, stagger: 0.06, clearProps: "transform,opacity" });
    } });

    // Processo
    gsap.to("#railFill", { scaleY: 1, ease: "none", scrollTrigger: { trigger: "#steps", start: "top 60%", end: "bottom 60%", scrub: true } });
    $$(".step").forEach((s) => ScrollTrigger.create({ trigger: s, start: "top 62%", onEnter: () => s.classList.add("is-on"), onLeaveBack: () => s.classList.remove("is-on") }));

    // Final: carro entra pela lateral, faixas de velocidade deslizam, informações sobem
    gsap.fromTo("#finalCar", { xPercent: 22, scale: 1.12 }, { xPercent: 0, scale: 1, ease: "none", scrollTrigger: { trigger: "#final", start: "top 85%", end: "top 15%", scrub: 0.8 } });
    $$(".final__stripes i").forEach((s, i) => gsap.fromTo(s, { xPercent: i % 2 ? 35 : -35 }, { xPercent: i % 2 ? -8 : 8, ease: "none", scrollTrigger: { trigger: "#final", start: "top bottom", end: "bottom top", scrub: 1 } }));
    gsap.from(".final__info > *", { y: 40, opacity: 0, filter: "blur(8px)", stagger: 0.1, duration: 1, ease: "power3.out", scrollTrigger: { trigger: ".final__info", start: "top 92%", toggleActions: "play none none reverse" } });
  } else {
    $$(".step").forEach((s) => s.classList.add("is-on"));
    gsap.set(["#railFill"], { scaleY: 1 });
    $$(".proj__frame").forEach((f) => (f.style.clipPath = "none"));
    gsap.set("#polishPhrase p:first-child", { opacity: 1 });
  }

  // Serviços: ativa por hover (desktop) ou pelo centro da tela (toque)
  const rows = $$(".svc");
  if (fine) {
    rows.forEach((r) => { r.addEventListener("pointerenter", () => { rows.forEach((x) => x.classList.toggle("is-active", x === r)); }); });
    $("#svcList").addEventListener("pointerleave", () => rows.forEach((x) => x.classList.remove("is-active")));
    rows[0].classList.add("is-active");
  } else {
    rows.forEach((r) => ScrollTrigger.create({ trigger: r, start: "top 60%", end: "bottom 40%", onToggle: (s) => r.classList.toggle("is-active", s.isActive) }));
  }

  // Carro 3D: progresso da seção controla câmera, luz e textos
  const carSec = $("#experiencia"), words3 = $$("#carWords .display"), tag = $("#carTag");
  const phase = $("#carPhase"), angle = $("#carAngle"), bar = $("#carBar");
  const names = ["Forma", "Superfície", "Reflexo", "Acabamento"];
  let last = -1;
  gsap.set(words3, { opacity: 0, y: 60, filter: "blur(12px)" });
  ScrollTrigger.create({ trigger: carSec, start: "top top", end: "bottom bottom", scrub: true, onUpdate: (s) => {
    const p = s.progress;
    carP = p; carMod?.setProgress(p);
    angle.textContent = String(Math.round(p * 300)).padStart(3, "0") + "°";
    bar.style.transform = `scaleY(${p})`;
    const i = Math.min(3, Math.floor(p * 4));
    if (i !== last) {
      if (last >= 0) gsap.to(words3[last], { opacity: 0, y: -50, filter: "blur(12px)", duration: 0.5, ease: "power2.in", overwrite: true });
      gsap.fromTo(words3[i], { opacity: 0, y: 60, filter: "blur(12px)" }, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.9, ease: "expo.out", delay: last >= 0 ? 0.25 : 0, overwrite: true });
      phase.textContent = names[i]; tag.textContent = `0${i + 1} / 04`; last = i;
    }
  } });
  // 3D só renderiza enquanto a seção está visível
  ScrollTrigger.create({ trigger: carSec, start: "top bottom", end: "bottom top", onToggle: (s) => { carActive = s.isActive; carMod?.setActive(carActive); } });

  // WhatsApp flutuante: aparece depois do Hero
  ScrollTrigger.create({ trigger: "#inicio", start: "bottom 70%", onEnter: () => fab.classList.add("on"), onLeaveBack: () => fab.classList.remove("on") });
}

/* ---------- Loader: intro cinematográfica Auto Estufa Vitoriano ---------- */
function runLoader() {
  const loader = $("#loader"), fill = $("#ldBar"), pct = $("#ldPct");
  const MIN = reduce ? 450 : 2000;
  const MAX = 8500;
  const heroImg = $("#heroBg img");
  const carImg = $("#ldCar img");
  const tasks = [
    document.fonts ? document.fonts.ready : Promise.resolve(),
    new Promise((r) => (heroImg.complete ? r() : (heroImg.onload = heroImg.onerror = r))),
    new Promise((r) => (carImg.complete ? r() : (carImg.onload = carImg.onerror = r))),
    new Promise((r) => (document.readyState === "complete" ? r() : addEventListener("load", r, { once: true }))),
  ];
  let done = 0;
  tasks.forEach((t) => Promise.resolve(t).catch(() => {}).then(() => done++));

  if (hasGsap && !reduce) {
    gsap.set("#inicio h1 .mask>span", { yPercent: 110 });
    gsap.set("[data-hero-fade]", { opacity: 0 });
  }

  const leave = () => {
    loader.classList.add("is-out");
    document.body.classList.remove("is-loading");
    window.__heroIn?.();
    setTimeout(() => { loader.remove(); if (hasGsap) ScrollTrigger.refresh(); }, 800);
  };

  const t0 = performance.now();
  let p = 0;
  const tick = (now) => {
    const elapsed = now - t0;
    const eased = 1 - Math.pow(1 - Math.min(1, elapsed / MIN), 2.05);
    const loaded = done / tasks.length;
    const cap = elapsed > MAX ? 100 : Math.min(96, 28 + loaded * 68);
    const target = Math.min(eased * 100, cap);
    p += (target - p) * .18;
    if (target - p < .05) p = target;
    fill.style.transform = `scaleX(${p / 100})`;
    pct.textContent = `${Math.round(p)}%`;
    if (p >= 99.95) { fill.style.transform = "scaleX(1)"; pct.textContent = "100%"; setTimeout(leave, reduce ? 100 : 140); return; }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

if (hasGsap) initMotion();
runLoader();
