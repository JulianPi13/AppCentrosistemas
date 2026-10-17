// ---- apertura y cierre de caja ----
let cajaDocs = {};
const WA_ADMIN_DEF = "3017002149";
let waAdmin = WA_ADMIN_DEF;
$("a-wa-ok").onclick = async () => {
  const t = $("a-wa").value.replace(/\D/g, "");
  if (t.length < 10) {
    $("admin-msg").textContent = "Escriba un número de WhatsApp de 10 dígitos.";
    return;
  }
  waAdmin = t;
  await guardarPermisos({ waAdmin: t });
};
function textoCierre(dia) {
  const c = cajaDocs[dia];
  if (!c || !c.cierre) return "";
  const r = resumen(dia),
    q = cuadre(dia, r, c),
    k = c.cierre;
  const esp = q.base + q.efectivo - q.sal - (+k.retiros || 0),
    dif = (+k.contado || 0) - esp;
  const fd = new Date(dia + "T12:00").toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const l = [
    `*CIERRE DE CAJA · ${IMP.nombre}*`,
    fd.charAt(0).toUpperCase() + fd.slice(1),
    ``,
    `Abrió: ${c.abiertaPor || "—"} (${hhmm(c.abiertaEn)})`,
    `Cerró: ${k.cerradaPor || "—"} (${hhmm(k.cerradaEn)})`,
    ``,
    `*Ingresos*`,
  ];
  const pm = Object.entries(q.porMet);
  if (!pm.length) l.push("Sin ingresos");
  pm.forEach(([m, v]) => l.push(`${m}: ${pesos(v)}`));
  l.push(
    `*Total: ${pesos(r.ing)}*`,
    ``,
    `*Efectivo*`,
    `Base: ${pesos(q.base)}`,
    `Recibido: ${pesos(q.efectivo)}`,
    `Salidas: ${pesos(q.sal)}` +
      (r.sal.length ? " (" + r.sal.map((x) => x.concepto).join(", ") + ")" : ""),
    `Otros retiros: ${pesos(k.retiros)}`,
    `Debía haber: ${pesos(esp)}`,
    `Se contó: ${pesos(k.contado)}`,
    dif === 0 ? `✅ La caja cuadra` : `⚠️ ${dif > 0 ? "Sobran" : "Faltan"} ${pesos(Math.abs(dif))}`,
    ``,
    `*Equipos*`,
    `Recibidos: ${r.rec.length} · Reparados: ${r.lis.length} · Entregados: ${r.ent.length}`,
  );
  if (r.ent.length)
    l.push(`Reparaciones entregadas: ${pesos(r.ent.reduce((s, o) => s + (+o.precio || 0), 0))}`);
  if (r.vn) l.push(`Ventas de mostrador: ${r.vn} (${pesos(r.vtot)})`);
  if (k.nota) l.push(``, `Observaciones: ${k.nota}`);
  return l.join("\n");
}
function linkCierre(dia) {
  const t = String(waAdmin || "").replace(/\D/g, "");
  if (t.length < 7) return null;
  return `https://wa.me/${t.length === 10 ? "57" + t : t}?text=${encodeURIComponent(textoCierre(dia))}`;
}
const HORA_CIERRE = 19;
const horaBogota = () => {
  try {
    return +new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Bogota",
      hour: "numeric",
      hourCycle: "h23",
    }).format(new Date());
  } catch (e) {
    return new Date().getHours();
  }
};
const hhmm = (iso) =>
  iso ? new Date(iso).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" }) : "";
function cuadre(dia, r, c) {
  const porMet = {};
  r.pg.forEach((p) => {
    const m = p.metodo || "Efectivo";
    porMet[m] = (porMet[m] || 0) + (+p.monto || 0);
  });
  const efectivo = porMet["Efectivo"] || 0,
    base = +c.base || 0,
    retiros = c.cierre ? +c.cierre.retiros || 0 : 0;
  const sal = r.salTot || 0;
  return { porMet, efectivo, base, retiros, sal, esperado: base + efectivo - sal - retiros };
}
function pintarTurno(dia, r) {
  const g = $("c-turno"),
    c = cajaDocs[dia],
    hoy = dia === hoyStr();
  g.innerHTML = "";
  const fila = (html) => {
    const d = document.createElement("div");
    d.className = "t-fila";
    d.innerHTML = html;
    g.appendChild(d);
    return d;
  };
  if (!c) {
    if (!hoy) {
      fila(
        '<h3 style="margin:0">Turno de caja</h3><span class="t-estado t-sin">No se abrió</span>',
      );
      return;
    }
    fila(
      '<h3 style="margin:0">Abrir la caja de hoy</h3><span class="t-estado t-sin">Sin abrir</span>',
    );
    const p = document.createElement("p");
    p.className = "aviso campo full";
    p.style.margin = "0";
    p.textContent = "Cuente el dinero con el que empieza el día y escríbalo como base.";
    g.appendChild(p);
    const cb = document.createElement("div");
    cb.className = "campo";
    cb.innerHTML =
      '<label for="t-base">Base inicial (efectivo)</label><input id="t-base" type="number" min="0" step="1000" inputmode="numeric">';
    g.appendChild(cb);
    const cbt = document.createElement("div");
    cbt.className = "campo";
    cbt.innerHTML =
      '<label>&nbsp;</label><button type="button" class="btn-main" id="t-abrir">Abrir caja</button>';
    g.appendChild(cbt);
    $("t-abrir").onclick = async () => {
      const v = $("t-base").value.trim();
      if (v === "") {
        $("caja-msg").textContent = "Escriba la base, aunque sea 0.";
        $("t-base").focus();
        return;
      }
      try {
        await db
          .doc("caja/" + dia)
          .set({
            base: Math.max(0, Math.round(+v || 0)),
            abiertaPor: sesion ? sesion.nombre : "",
            abiertaEn: new Date().toISOString(),
          });
        logAccion(
          "Caja abierta",
          "Base " + pesos(Math.max(0, Math.round(+v || 0))) + " (" + dia + ")",
        );
        $("caja-msg").textContent = "Caja abierta.";
      } catch (e) {
        $("caja-msg").textContent =
          e && e.code === "invalid_argument"
            ? "Esta cuenta no tiene permiso para abrir la caja."
            : "No se pudo abrir la caja. Revise la conexión.";
      }
    };
    return;
  }
  const q = cuadre(dia, r, c);
  fila(
    `<h3 style="margin:0">Turno de caja</h3><span class="t-estado ${c.cierre ? "t-cerrada" : "t-abierta"}">${c.cierre ? "Cerrada" : "Abierta"}</span>`,
  );
  const info = fila("");
  info.innerHTML = `<span>Abrió <b></b> a las ${hhmm(c.abiertaEn)} con base <b>${pesos(q.base)}</b></span>`;
  info.querySelector("b").textContent = c.abiertaPor || "—";
  if (esAdmin) {
    const fb = fila(
      '<span class="aviso" style="margin:0">Cambiar la base:</span><input id="t-base2" type="number" min="0" step="1000" inputmode="numeric" style="width:130px" aria-label="Base nueva"><button type="button" id="t-base2-ok">Guardar base</button>',
    );
    $("t-base2").value = q.base;
    $("t-base2-ok").onclick = async () => {
      const v = $("t-base2").value.trim();
      if (v === "") {
        $("caja-msg").textContent = "Escriba la base nueva.";
        return;
      }
      try {
        const nb = Math.max(0, Math.round(+v || 0));
        await db
          .doc("caja/" + dia)
          .set({
            ...c,
            base: nb,
            baseCambiadaPor: sesion ? sesion.nombre : "",
            baseCambiadaEn: new Date().toISOString(),
          });
        logAccion("Base de caja cambiada", `${pesos(q.base)} → ${pesos(nb)} (${dia})`);
        $("caja-msg").textContent =
          "Base cambiada a " +
          pesos(nb) +
          "." +
          (c.cierre ? " Como la caja ya estaba cerrada, el cuadre se recalculó." : "");
      } catch (e) {
        $("caja-msg").textContent = "No se pudo cambiar la base.";
      }
    };
  }
  if (c.cierre) {
    const k = c.cierre,
      dif = (+k.contado || 0) - ((+c.base || 0) + q.efectivo - q.sal - (+k.retiros || 0));
    const dl2 = document.createElement("dl");
    dl2.className = "cuadre";
    dl2.innerHTML = `<dt>Base</dt><dd>${pesos(q.base)}</dd><dt>Efectivo recibido</dt><dd>${pesos(q.efectivo)}</dd><dt>Salidas registradas</dt><dd>− ${pesos(q.sal)}</dd><dt>Otros retiros</dt><dd>− ${pesos(k.retiros)}</dd><dt class="tot">Debía haber</dt><dd class="tot">${pesos(q.base + q.efectivo - q.sal - (+k.retiros || 0))}</dd><dt>Se contó</dt><dd>${pesos(k.contado)}</dd><dt>Diferencia</dt><dd class="${dif === 0 ? "dif-ok" : "dif-mal"}">${dif === 0 ? "Cuadra" : (dif > 0 ? "Sobran " : "Faltan ") + pesos(Math.abs(dif))}</dd>`;
    g.appendChild(dl2);
    const cf = fila("");
    cf.innerHTML = `<span>Cerró <b></b> a las ${hhmm(k.cerradaEn)}</span>`;
    cf.querySelector("b").textContent = k.cerradaPor || "—";
    const bt = fila(
      '<a class="wa" id="t-wa" target="_blank" rel="noopener" href="#">Enviar reporte al administrador por WhatsApp</a><button type="button" class="btn-main" id="t-rep">Reporte de cierre (PDF)</button>' +
        (puedeReabrir()
          ? '<button type="button" class="btn-danger" id="t-reabrir">Reabrir caja</button>'
          : ""),
    );
    {
      const h = linkCierre(dia);
      $("t-wa").hidden = !h;
      if (h) $("t-wa").href = h;
    }
    $("t-rep").hidden = !(dl && window.jspdf);
    $("t-rep").onclick = () => reporteCierre(dia);
    if (puedeReabrir())
      $("t-reabrir").onclick = async (ev) => {
        const b = ev.target;
        if (!b.dataset.ok) {
          b.dataset.ok = "1";
          b.textContent = "¿Seguro? Reabrir";
          return;
        }
        try {
          const { cierre, ...resto } = c;
          await db.doc("caja/" + dia).set(resto);
          logAccion("Caja reabierta", dia);
        } catch (e) {
          $("caja-msg").textContent = "No se pudo reabrir.";
        }
      };
    return;
  }
  const tarde = hoy && horaBogota() >= HORA_CIERRE;
  const p = document.createElement("p");
  p.className = "campo full";
  p.style.margin = "0";
  p.innerHTML = tarde
    ? '<b class="falta">Ya son las 7:00 p. m. Haga el cierre de caja.</b>'
    : '<span class="aviso">El cierre se hace al final del día (7:00 p. m.). Si cierra antes, puede hacerlo igual.</span>';
  g.appendChild(p);
  const dl3 = document.createElement("dl");
  dl3.className = "cuadre";
  const metTxt =
    Object.entries(q.porMet)
      .map(([m, v]) => `<dt>${esc(m)}</dt><dd>${pesos(v)}</dd>`)
      .join("") || "<dt>Sin pagos</dt><dd>$ 0</dd>";
  dl3.innerHTML = `<dt>Base</dt><dd>${pesos(q.base)}</dd>${metTxt}<dt>Salidas de caja</dt><dd>− ${pesos(q.sal)}</dd><dt class="tot">Efectivo que debería haber</dt><dd class="tot" id="t-esp">${pesos(q.base + q.efectivo - q.sal)}</dd>`;
  g.appendChild(dl3);
  const c1 = document.createElement("div");
  c1.className = "campo";
  c1.innerHTML =
    '<label for="t-retiros">Otros retiros no registrados como salida</label><input id="t-retiros" type="number" min="0" step="1000" inputmode="numeric" placeholder="0">';
  g.appendChild(c1);
  const c2 = document.createElement("div");
  c2.className = "campo";
  c2.innerHTML =
    '<label for="t-contado">Efectivo contado al cerrar</label><input id="t-contado" type="number" min="0" step="1000" inputmode="numeric">';
  g.appendChild(c2);
  const c3 = document.createElement("div");
  c3.className = "campo full";
  c3.innerHTML = '<label for="t-nota">Observaciones (opcional)</label><input id="t-nota">';
  g.appendChild(c3);
  const c4 = document.createElement("p");
  c4.className = "campo full";
  c4.id = "t-dif";
  c4.style.margin = "0";
  g.appendChild(c4);
  const c5 = document.createElement("div");
  c5.className = "campo full";
  c5.innerHTML =
    '<button type="button" class="btn-main" id="t-cerrar">Hacer cierre de caja</button>';
  g.appendChild(c5);
  const calc = () => {
    const ret = +$("t-retiros").value || 0,
      esp = q.base + q.efectivo - q.sal - ret,
      cont = $("t-contado").value;
    $("t-esp").textContent = pesos(esp);
    if (cont === "") {
      $("t-dif").textContent = "";
      return;
    }
    const d = (+cont || 0) - esp;
    $("t-dif").className = "campo full " + (d === 0 ? "dif-ok" : "dif-mal");
    $("t-dif").textContent =
      d === 0 ? "La caja cuadra." : (d > 0 ? "Sobran " : "Faltan ") + pesos(Math.abs(d)) + ".";
  };
  $("t-retiros").oninput = calc;
  $("t-contado").oninput = calc;
  $("t-cerrar").onclick = async () => {
    const cont = $("t-contado").value.trim();
    if (cont === "") {
      $("caja-msg").textContent = "Cuente el efectivo y escriba cuánto hay.";
      $("t-contado").focus();
      return;
    }
    const b = $("t-cerrar");
    b.disabled = true;
    try {
      await db
        .doc("caja/" + dia)
        .set({
          ...c,
          cierre: {
            contado: Math.round(+cont || 0),
            retiros: Math.round(+$("t-retiros").value || 0),
            nota: $("t-nota").value.trim(),
            cerradaPor: sesion ? sesion.nombre : "",
            cerradaEn: new Date().toISOString(),
            ingresos: q.porMet,
            totalIngresos: r.ing,
            recibidos: r.rec.length,
            reparados: r.lis.length,
            entregados: r.ent.length,
          },
        });
      logAccion(
        "Caja cerrada",
        `${dia} · contado ${pesos(Math.round(+cont || 0))} · entró ${pesos(r.ing)}`,
      );
      $("caja-msg").textContent =
        "Caja cerrada. Toque el botón verde para enviarle el reporte al administrador por WhatsApp, o descargue el PDF.";
    } catch (e) {
      $("caja-msg").textContent =
        e && e.code === "invalid_argument"
          ? "Esta cuenta no tiene permiso para cerrar la caja."
          : "No se pudo cerrar la caja. Revise la conexión.";
    }
    b.disabled = false;
  };
}
function reporteCierre(dia) {
  const c = cajaDocs[dia];
  if (!c || !c.cierre || !dl) return;
  const r = resumen(dia),
    q = cuadre(dia, r, c),
    k = c.cierre,
    ancho = +$("papel").value || 58;
  const L = [],
    sep = () => L.push({ sep: 1 }),
    t = (x, s, o = {}) => L.push({ txt: String(x), size: s, ...o }),
    par = (a, b, o) => t(a + ": " + b, 8.3, o);
  const fd = new Date(dia + "T12:00").toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  if (logoRecibo && IMP.logo) L.push({ img: 1 });
  else t(IMP.nombre, 14, { b: 1, c: 1 });
  sep();
  t("CIERRE DE CAJA", ancho > 60 ? 13 : 11.5, { b: 1, c: 1 });
  t(fd, 8, { c: 1 });
  sep();
  par("Abrió", (c.abiertaPor || "—") + " · " + hhmm(c.abiertaEn));
  par("Cerró", (k.cerradaPor || "—") + " · " + hhmm(k.cerradaEn));
  sep();
  t("INGRESOS POR FORMA DE PAGO", 8.5, { b: 1 });
  const pm = Object.entries(q.porMet);
  if (!pm.length) t("Sin ingresos", 8.3);
  pm.forEach(([m, v]) => par(m, pesos(v)));
  t("TOTAL INGRESOS: " + pesos(r.ing), 9.5, { b: 1 });
  sep();
  t("CUADRE DE EFECTIVO", 8.5, { b: 1 });
  par("Base inicial", pesos(q.base));
  par("Efectivo recibido", pesos(q.efectivo));
  par("Salidas de caja", "− " + pesos(q.sal));
  par("Otros retiros", "− " + pesos(k.retiros));
  const esp = q.base + q.efectivo - q.sal - (+k.retiros || 0),
    dif = (+k.contado || 0) - esp;
  par("Debía haber", pesos(esp));
  par("Se contó", pesos(k.contado));
  t(
    dif === 0 ? "LA CAJA CUADRA" : (dif > 0 ? "SOBRANTE: " : "FALTANTE: ") + pesos(Math.abs(dif)),
    10,
    { b: 1 },
  );
  sep();
  t("DETALLE DE PAGOS", 8.5, { b: 1 });
  if (!r.pg.length) t("Ninguno", 8);
  r.pg
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .forEach((p) =>
      t(
        `${hora(p.fecha)} · ${p.venta ? "Venta: " + resumenVenta(p.venta) : "#" + p.o.num + " " + (p.o.cliente || "")} · ${p.metodo || "Efectivo"} · ${pesos(p.monto)}` +
          (p.quien ? ` (${p.quien})` : ""),
        7.3,
      ),
    );
  sep();
  t("EQUIPOS DEL DÍA", 8.5, { b: 1 });
  par("Recibidos", r.rec.length);
  par("Reparados", r.lis.length);
  par("Entregados", r.ent.length);
  if (r.ent.length)
    par("Reparaciones entregadas", pesos(r.ent.reduce((s, o) => s + (+o.precio || 0), 0)));
  if (r.vn) par("Ventas de mostrador", r.vn + " · " + pesos(r.vtot));
  if (esAdmin) {
    sep();
    t("SOLO ADMINISTRADOR", 8.5, { b: 1 });
    par("Gastos registrados", pesos(r.gas));
    par("Utilidad reparaciones", pesos(r.gan));
    par("Utilidad ventas", pesos(r.ganV));
    par("Utilidad encargos", pesos(r.ganE));
  }
  if (r.sal.length) {
    sep();
    t("SALIDAS DE CAJA", 8.5, { b: 1 });
    r.sal.forEach((x) =>
      t(
        `${hora(x.hora)} · ${x.concepto} · ${pesos(x.valor)}` + (x.quien ? ` (${x.quien})` : ""),
        7.3,
      ),
    );
  }
  if (k.nota) {
    sep();
    par("Observaciones", k.nota);
  }
  L.push({ gap: 9 });
  t("______________________", 9, { c: 1 });
  t("Firma de quien cierra", 7.5, { c: 1 });
  dl.save({ filename: `cierre-caja-${dia}.pdf`, data: pintarRecibo(L, ancho) }).catch(() => {});
}
const puedeReabrir = () => esAdmin || (rolActual() === "asesor" && perm("caja"));
function cajaAbiertaHoy() {
  const c = cajaDocs[hoyStr()];
  return !!c && !c.cierre;
}
function revisarAvisoCaja() {
  const a = $("aviso-caja");
  if (!db || !sesion || !perm("caja") || rolActual() === "consulta") {
    a.hidden = true;
    return;
  }
  const c = cajaDocs[hoyStr()],
    h = horaBogota();
  if (!c && h >= 6 && h < HORA_CIERRE) {
    a.hidden = false;
    a.classList.remove("tarde");
    $("aviso-caja-txt").textContent =
      "La caja de hoy todavía no se ha abierto. Ábrala con la base del día.";
    $("aviso-caja-btn").textContent = "Abrir caja";
  } else if (c && !c.cierre && h >= HORA_CIERRE) {
    a.hidden = false;
    a.classList.add("tarde");
    $("aviso-caja-txt").textContent =
      "Ya son las 7:00 p. m. Haga el cierre de caja y saque el reporte del día.";
    $("aviso-caja-btn").textContent = "Hacer cierre";
  } else a.hidden = true;
}
$("aviso-caja-btn").onclick = () => $("btn-caja").onclick();
function pintarRCaja() {
  const z = $("rcaja");
  if (!db || !sesion || rolActual() !== "asesor" || !perm("caja")) {
    z.hidden = true;
    return;
  }
  const d = hoyStr(),
    r = resumen(d),
    c = cajaDocs[d],
    por = {};
  r.pg.forEach((p) => {
    const m = p.metodo || "Efectivo";
    por[m] = (por[m] || 0) + (+p.monto || 0);
  });
  z.hidden = false;
  z.innerHTML = "";
  const h = document.createElement("h3");
  h.textContent = "Caja de hoy · " + (c ? (c.cierre ? "cerrada" : "abierta") : "sin abrir");
  z.appendChild(h);
  const f = document.createElement("div");
  f.className = "fila";
  Object.entries(por).forEach(([m, v]) => {
    const s = document.createElement("span");
    s.textContent = m + ": " + pesos(v);
    f.appendChild(s);
  });
  const t = document.createElement("span");
  t.className = "tot";
  t.textContent = "Entró hoy: " + pesos(r.ing);
  f.appendChild(t);
  const v = document.createElement("span");
  v.textContent = r.vn + (r.vn === 1 ? " venta" : " ventas");
  f.appendChild(v);
  z.appendChild(f);
}
setInterval(() => {
  try {
    pintarRCaja();
  } catch (e) {}
}, 60000);
$("rcaja").onclick = () => $("btn-caja").onclick();
setInterval(revisarAvisoCaja, 60000);
