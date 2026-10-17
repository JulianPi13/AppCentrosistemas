// ---- asistente paso a paso (burbuja) ----
const capi = (v) =>
  v
    .trim()
    .replace(/\s+/g, " ")
    .replace(/(^|\s)(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
const soloDig = (v) => v.replace(/\D/g, "");
const esNo = (v) =>
  /^(no|ninguno|ninguna|nada|no tiene|sin clave|no deja|cero|0)\.?$/i.test(v.trim());
function dinero(v) {
  if (esNo(v)) return "";
  let t = v.toLowerCase().replace(/\$/g, "");
  const m = t
    .replace(/(\d)[.](?=\d{3})/g, "$1")
    .replace(/,/g, ".")
    .match(/\d+(?:\.\d+)?/);
  if (!m) return "";
  let n = parseFloat(m[0]);
  if (/mill[oó]n|millones/.test(t)) n *= 1e6;
  else if (/\bmil\b|\d\s*k\b/.test(t)) n *= 1000;
  else if (n < 1000) n *= 1000;
  return String(Math.round(n));
}
function fechaVoz(v) {
  const t = v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  const iso = (x) => diaDe(x.toISOString());
  if (/pasado manana/.test(t)) {
    d.setDate(d.getDate() + 2);
    return iso(d);
  }
  if (/manana/.test(t)) {
    d.setDate(d.getDate() + 1);
    return iso(d);
  }
  if (/\bhoy\b/.test(t)) return iso(d);
  let m = t.match(/en (\d+) dias?/);
  if (m) {
    d.setDate(d.getDate() + +m[1]);
    return iso(d);
  }
  const dias = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
  for (let i = 0; i < 7; i++)
    if (t.includes(dias[i])) {
      let k = (i - d.getDay() + 7) % 7 || 7;
      d.setDate(d.getDate() + k);
      return iso(d);
    }
  const meses = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];
  m = t.match(/(\d{1,2})\s*de\s*([a-z]+)/);
  if (m) {
    const mi = meses.findIndex((x) => m[2].startsWith(x.slice(0, 3)));
    if (mi >= 0) {
      const r = new Date(d.getFullYear(), mi, +m[1], 12);
      if (r < d) r.setFullYear(r.getFullYear() + 1);
      return iso(r);
    }
  }
  m = t.match(/(\d{1,2})[\/-](\d{1,2})/);
  if (m) {
    const r = new Date(d.getFullYear(), +m[2] - 1, +m[1], 12);
    if (r < d) r.setFullYear(r.getFullYear() + 1);
    return iso(r);
  }
  return "";
}
const PASOS = [
  { q: "¿A nombre de quién es el equipo?", f: "f-cliente", t: capi, req: 1 },
  { q: "¿Cuál es el número de cédula?", f: "f-cedula", t: soloDig, kb: "numeric" },
  { q: "¿Cuál es el número de WhatsApp del cliente?", f: "f-tel", t: soloDig, kb: "tel" },
  { q: "¿Qué marca es el equipo?", f: "f-marca", t: capi, req: 1 },
  { q: "¿Qué referencia o modelo es?", f: "f-modelo", t: (v) => v.trim(), req: 1 },
  { q: "Especifique la falla del equipo.", f: "f-falla", t: (v) => v.trim(), req: 1 },
  {
    q: "¿Se recibe con algo adicional?",
    a: "Forro, cargador, SIM, memoria… y cómo llega: golpes, rayones, tapa partida.",
    f: "f-recibe",
    t: (v) => (esNo(v) ? "Sin accesorios adicionales" : v.trim()),
  },
  {
    q: "¿Tiene clave o patrón de bloqueo?",
    a: "Diga el código. Si es patrón, diga los puntos del 1 al 9, por ejemplo 1 4 7 8 9.",
    f: "f-clave",
    t: (v) => {
      if (esNo(v)) return "";
      const d = v.match(/[1-9]/g) || [];
      if (/patr/i.test(v) && d.length >= 3) {
        patSeq = [...new Set(d.map(Number))];
        pintarPat();
        return "Patrón " + patSeq.join("-");
      }
      return v.trim();
    },
  },
  {
    q: "¿Cuál es el valor de la reparación?",
    a: "Si todavía no se sabe, toque Saltar.",
    f: "f-precio",
    t: dinero,
    kb: "numeric",
  },
  { q: "¿Deja algún abono?", f: "f-abono", t: dinero, kb: "numeric" },
  {
    q: "¿Para cuándo se promete la entrega?",
    a: "Por ejemplo: mañana, el viernes, en 3 días o el 20 de octubre.",
    f: "f-entrega",
    t: fechaVoz,
  },
];
let gPaso = 0,
  gMudo = false;
try {
  gMudo = localStorage.getItem("centro_mudo") === "1";
} catch (e) {}
const LATAM = [
  "es-CO",
  "es-MX",
  "es-US",
  "es-419",
  "es-VE",
  "es-PE",
  "es-EC",
  "es-CL",
  "es-AR",
  "es-PA",
  "es-CR",
  "es-GT",
  "es-DO",
  "es-UY",
  "es-BO",
  "es-PY",
  "es-HN",
  "es-SV",
  "es-NI",
  "es-PR",
  "es-CU",
];
let vocesEs = [],
  vozElegida = "";
try {
  vozElegida = localStorage.getItem("centro_voz") || "";
} catch (e) {}
const normLang = (l) => String(l || "").replace("_", "-");
function rangoVoz(v) {
  const l = normLang(v.lang),
    i = LATAM.findIndex((x) => x.toLowerCase() === l.toLowerCase());
  if (i >= 0) return i;
  if (/^es-ES/i.test(l)) return 900;
  return 500;
}
function cargarVoces() {
  try {
    if (!window.speechSynthesis) return;
    vocesEs = speechSynthesis
      .getVoices()
      .filter((v) => /^es/i.test(v.lang))
      .sort((a, b) => rangoVoz(a) - rangoVoz(b));
    const sel = $("g-voz");
    sel.innerHTML = "";
    vocesEs.forEach((v) => {
      const o = document.createElement("option");
      o.value = v.voiceURI;
      o.textContent = v.name.replace(/Microsoft |Google /, "") + " (" + normLang(v.lang) + ")";
      sel.appendChild(o);
    });
    if (!vocesEs.some((v) => v.voiceURI === vozElegida))
      vozElegida = vocesEs[0] ? vocesEs[0].voiceURI : "";
    sel.value = vozElegida;
    $("g-voz-fila").hidden = vocesEs.length < 2;
  } catch (e) {}
}
try {
  if (window.speechSynthesis) {
    cargarVoces();
    speechSynthesis.addEventListener("voiceschanged", cargarVoces);
  }
} catch (e) {}
$("g-voz").onchange = () => {
  vozElegida = $("g-voz").value;
  try {
    localStorage.setItem("centro_voz", vozElegida);
  } catch (e) {}
  decir(PASOS[gPaso].q);
};
function decir(t) {
  try {
    if (gMudo || !window.speechSynthesis) return;
    if (!vocesEs.length) cargarVoces();
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(t);
    const v = vocesEs.find((x) => x.voiceURI === vozElegida) || vocesEs[0];
    if (v) {
      u.voice = v;
      u.lang = normLang(v.lang);
    } else u.lang = "es-MX";
    u.rate = 1;
    speechSynthesis.speak(u);
  } catch (e) {}
}
function pintarSonido() {
  $("g-sonido").textContent = gMudo ? "Voz: no" : "Voz: sí";
  $("g-sonido").setAttribute("aria-pressed", String(!gMudo));
}
$("g-sonido").onclick = () => {
  gMudo = !gMudo;
  try {
    localStorage.setItem("centro_mudo", gMudo ? "1" : "0");
  } catch (e) {}
  pintarSonido();
  if (gMudo) {
    try {
      speechSynthesis.cancel();
    } catch (e) {}
  } else decir(PASOS[gPaso].q);
};
function iniciarGuia() {
  cerrar();
  abrir(null);
  $("panel").classList.add("con-guia");
  $("guia").hidden = false;
  pintarSonido();
  gPaso = 0;
  mostrarPaso();
}
function mostrarPaso() {
  const p = PASOS[gPaso];
  document.querySelectorAll(".guiando").forEach((x) => x.classList.remove("guiando"));
  $("g-paso").textContent = `Paso ${gPaso + 1} de ${PASOS.length}`;
  $("g-prog").style.width = (gPaso / PASOS.length) * 100 + "%";
  $("g-preg").textContent = p.q;
  $("g-ayuda").textContent = p.a || "Toque el micrófono del teclado y responda.";
  const r = $("g-resp");
  r.value = p.f === "f-precio" || p.f === "f-abono" ? $(p.f).value || "" : $(p.f).value || "";
  if (p.f === "f-tel" && r.value === "3102311490") r.value = "";
  if (p.f === "f-entrega") r.value = "";
  r.inputMode = p.kb || "text";
  r.setAttribute("enterkeyhint", gPaso === PASOS.length - 1 ? "done" : "next");
  $("g-saltar").hidden = !!p.req;
  $("g-atras").disabled = gPaso === 0;
  $("g-sig").textContent = gPaso === PASOS.length - 1 ? "Terminar" : "Siguiente";
  const c = $(p.f);
  c.classList.add("guiando");
  c.scrollIntoView({ block: "center", behavior: "smooth" });
  setTimeout(() => r.focus(), 60);
  decir(p.q);
}
function guardarPaso() {
  const p = PASOS[gPaso],
    v = $("g-resp").value;
  if (!v.trim()) return true;
  const val = p.t ? p.t(v) : v.trim();
  if ((p.f === "f-precio" || p.f === "f-abono") && v.trim() && val === "" && !esNo(v)) {
    $("g-ayuda").textContent = "No entendí el valor. Dígalo así: 80 mil, o 80000.";
    decir("No entendí el valor");
    return false;
  }
  if (p.f === "f-entrega" && !val) {
    $("g-ayuda").textContent =
      "No entendí la fecha. Diga por ejemplo: mañana, el viernes o el 20 de octubre.";
    decir("No entendí la fecha");
    return false;
  }
  $(p.f).value = val;
  $(p.f).classList.remove("pedir");
  cuentas();
  return true;
}
function avanzar() {
  const p = PASOS[gPaso];
  if (p.req && !$("g-resp").value.trim()) {
    $("g-ayuda").textContent = "Este dato es obligatorio.";
    decir("Este dato es obligatorio");
    $("g-resp").focus();
    return;
  }
  if (!guardarPaso()) return;
  if (gPaso < PASOS.length - 1) {
    gPaso++;
    mostrarPaso();
  } else terminarGuia();
}
$("g-form").onsubmit = (ev) => {
  ev.preventDefault();
  avanzar();
};
$("g-sig").onclick = avanzar;
$("g-saltar").onclick = () => {
  if (gPaso < PASOS.length - 1) {
    gPaso++;
    mostrarPaso();
  } else terminarGuia();
};
$("g-atras").onclick = () => {
  guardarPaso();
  if (gPaso > 0) {
    gPaso--;
    mostrarPaso();
  }
};
function cerrarGuia(silencio) {
  $("guia").hidden = true;
  $("panel").classList.remove("con-guia");
  document.querySelectorAll(".guiando").forEach((x) => x.classList.remove("guiando"));
  try {
    speechSynthesis.cancel();
  } catch (e) {}
}
$("g-salir").onclick = () => {
  cerrarGuia();
  $("msg").textContent = "Asistente cerrado. Puede seguir llenando el formulario a mano.";
};
function terminarGuia() {
  cerrarGuia();
  const faltan = [
    ["f-cliente", "nombre"],
    ["f-marca", "marca"],
    ["f-modelo", "referencia"],
    ["f-falla", "falla"],
  ].filter(([id]) => !$(id).value.trim());
  faltan.forEach(([id]) => $(id).classList.add("pedir"));
  const pocas = fotosEdit.length < 2;
  const t = faltan.length
    ? `Falta: ${faltan.map((x) => x[1]).join(", ")}.` +
      (pocas ? " Y tome mínimo 2 fotos del equipo." : "")
    : pocas
      ? "Ahora tome mínimo 2 fotos del equipo, enfocando las fallas o detalles importantes. Después toque Registrar equipo."
      : "Listo. Revise los datos y toque Registrar equipo.";
  $("msg").textContent = t;
  decir(
    faltan.length
      ? t
      : pocas
        ? "Ahora tome mínimo dos fotos del equipo, enfocando las fallas o detalles importantes."
        : "Listo. Revise los datos y toque registrar equipo.",
  );
  (pocas && !faltan.length ? $("g-fotos") : $("guardar")).scrollIntoView({
    block: "center",
    behavior: "smooth",
  });
}
