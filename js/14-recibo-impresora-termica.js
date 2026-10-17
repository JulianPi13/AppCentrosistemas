// ---- recibo para impresora térmica ----
let dl = null;
(async () => {
  try {
    dl = window.claude ? await window.claude.use("downloads") : null;
  } catch (e) {
    dl = null;
  }
  if (!$("panel").hidden) cuentas();
})();
try {
  const g = localStorage.getItem("taller_papel");
  if (g) $("papel").value = g;
} catch (e) {}
$("papel").onchange = () => {
  try {
    localStorage.setItem("taller_papel", $("papel").value);
  } catch (e) {}
};
let logoRecibo = null;
fetch("logo-recibo.png")
  .then((r) => (r.ok ? r.blob() : Promise.reject()))
  .then(
    (b) =>
      new Promise((ok, mal) => {
        const fr = new FileReader();
        fr.onload = () => ok(fr.result);
        fr.onerror = mal;
        fr.readAsDataURL(b);
      }),
  )
  .then((d) => {
    logoRecibo = d;
  })
  .catch(() => {});
function reciboPDF(o, ancho) {
  const { jsPDF } = window.jspdf,
    m = 3,
    w = ancho - 2 * m,
    L = [];
  const sep = () => L.push({ sep: 1 });
  const t = (txt, size, opt = {}) => L.push({ txt: String(txt), size, ...opt });
  const par = (k, v, opt) => {
    if (v !== "" && v != null) t(k + ": " + v, 8.5, opt);
  };
  const p = +o.precio || 0,
    a = +o.abono || 0;
  if (logoRecibo && IMP.logo) L.push({ img: 1 });
  else {
    t(IMP.nombre, ancho > 60 ? 15 : 13, { b: 1, c: 1 });
    if (IMP.sub) t(IMP.sub, 8, { c: 1 });
  }
  sep();
  t("ORDEN #" + o.num, ancho > 60 ? 14 : 12, { b: 1, c: 1 });
  t(
    new Date(o.ingreso || Date.now()).toLocaleString("es-CO", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }),
    8,
    { c: 1 },
  );
  sep();
  par("Cliente", o.cliente);
  par("Teléfono", o.tel);
  par("Cédula", o.cedula);
  par("Equipo", [o.marca, o.modelo].filter(Boolean).join(" "));
  par("IMEI", o.imei);
  par("Falla", o.falla);
  par("Cómo llega", o.recibe);
  if (Array.isArray(o.fotos) && o.fotos.length)
    t(`Se tomaron ${o.fotos.length} foto(s) de cómo llega el equipo.`, 7.5);
  sep();
  par("Valor", p ? pesos(p) : "Por definir");
  if (a) par("Abono", pesos(a));
  if (p) t("SALDO: " + pesos(Math.max(0, p - a)), 10, { b: 1 });
  if (o.entrega) par("Fecha prometida", fecha(o.entrega));
  if (+o.garantia) par("Garantía", o.garantia + " días");
  sep();
  if (IMP.pieIngreso) t(IMP.pieIngreso, 7.5, { c: 1 });
  if (IMP.firma) {
    L.push({ gap: 9 });
    t("______________________", 9, { c: 1 });
    t("Firma del cliente", 7.5, { c: 1 });
  }
  return pintarRecibo(L, ancho);
}
const NO_CUBRE = [
  "Pantallas o vidrios quebrados, rayados, presionados o con manchas después de la entrega.",
  "Equipos mojados, con humedad u oxidación.",
  "Golpes, caídas, partes dobladas o hundidas.",
  "Equipos abiertos o manipulados por otra persona o taller.",
  "Sellos o marcas de garantía rotos o alterados.",
  "Fallas distintas a la reparación indicada en este recibo.",
  "Software, virus, actualizaciones, bloqueos o cuentas (Google, iCloud, Samsung).",
  "Daños por cargadores no originales, mal uso o variaciones de voltaje.",
];
function reciboEntregaPDF(o, ancho) {
  const m = 3,
    L = [];
  const sep = () => L.push({ sep: 1 });
  const t = (txt, size, opt = {}) => L.push({ txt: String(txt), size, ...opt });
  const par = (k, v, opt) => {
    if (v !== "" && v != null) t(k + ": " + v, 8.5, opt);
  };
  const e = o.entregaInfo || {},
    p = +o.precio || 0,
    a = +o.abono || 0,
    fe = new Date(e.fecha || o.entregado || Date.now());
  const dias = +o.garantia || garDef(),
    hasta = new Date(fe.getTime() + dias * 864e5);
  const fmt = (d) =>
    d.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
  if (logoRecibo && IMP.logo) L.push({ img: 1 });
  else t(IMP.nombre, ancho > 60 ? 15 : 13, { b: 1, c: 1 });
  sep();
  const sinR = !!e.sinReparacion;
  t("RECIBO DE ENTREGA", ancho > 60 ? 13 : 11.5, { b: 1, c: 1 });
  if (sinR) t("EQUIPO SIN REPARACIÓN", 9, { b: 1, c: 1 });
  t(
    "Orden #" +
      o.num +
      " · " +
      fe.toLocaleString("es-CO", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    8,
    { c: 1 },
  );
  sep();
  par("Cliente", o.cliente);
  par("Teléfono", o.tel);
  par("Cédula", o.cedula);
  par("Equipo", [o.marca, o.modelo].filter(Boolean).join(" "));
  par("IMEI", o.imei);
  par("Falla reportada", o.falla);
  if (sinR) {
    t("RESULTADO", 8.5, { b: 1 });
    t("El equipo no tuvo reparación." + (o.diag ? " Motivo: " + o.diag : ""), 8.5);
  } else {
    t("REPARACIÓN REALIZADA", 8.5, { b: 1 });
    t(o.diag || "Según orden de servicio.", 8.5);
  }
  const pz = o.pieza && inv.find((x) => x.id === o.pieza);
  if (pz) par("Repuesto instalado", nomItem(pz));
  sep();
  par("Valor total", pesos(p));
  if (e.monto) {
    const antes = a - e.monto;
    if (antes > 0) par("Abonos anteriores", pesos(antes));
    par("Pagado hoy", pesos(e.monto) + (e.metodo ? " (" + e.metodo + ")" : ""));
  } else if (a) par("Pagado", pesos(a));
  const debe = Math.max(0, p - a);
  t(debe ? "SALDO PENDIENTE: " + pesos(debe) : "PAZ Y SALVO", 10, { b: 1 });
  sep();
  if (sinR) {
    t("SIN GARANTÍA", 10, { b: 1, c: 1 });
    t(
      "Como el equipo no fue reparado, no aplica garantía. Se entrega en las mismas condiciones en que se recibió.",
      7.8,
      { c: 1 },
    );
  } else {
    t(`GARANTÍA: ${dias} DÍAS`, 10, { b: 1, c: 1 });
    t(
      `Válida hasta el ${fmt(hasta)}. Cubre solo la reparación y el repuesto indicados en este recibo.`,
      7.8,
      { c: 1 },
    );
    const nc = listaNoCubre();
    if (nc.length) {
      L.push({ gap: 1.5 });
      t("LA GARANTÍA NO CUBRE:", 8, { b: 1 });
      nc.forEach((x) => t("• " + x, 7.3));
    }
    L.push({ gap: 1.5 });
    t(
      "Para hacer válida la garantía presente este recibo y el equipo en las mismas condiciones en que se entregó.",
      7.3,
    );
  }
  sep();
  if (e.conRecibo === false)
    par("Recibió", (e.recibe || "") + (e.cedula ? " · C.C. " + e.cedula : ""));
  if (e.quien) par("Entregó", e.quien);
  t(
    sinR
      ? "El cliente recibe su equipo sin reparación, en las mismas condiciones en que lo dejó."
      : "El cliente recibe el equipo funcionando y probado en su presencia, y acepta las condiciones de garantía.",
    7.3,
  );
  if (IMP.firma) {
    L.push({ gap: 9 });
    t("______________________", 9, { c: 1 });
    t("Firma de quien recibe", 7.5, { c: 1 });
  }
  if (IMP.pieEntrega) {
    L.push({ gap: 2 });
    t(IMP.pieEntrega, 8, { b: 1, c: 1 });
  }
  return pintarRecibo(L, ancho);
}
function pintarRecibo(L, ancho) {
  const { jsPDF } = window.jspdf,
    m = 3,
    w = ancho - 2 * m;
  const tmp = new jsPDF({ unit: "mm", format: [ancho, 200] });
  let h = m + 2;
  L.forEach((l) => {
    if (l.img) {
      l.w = Math.min(w, ancho > 60 ? 54 : 42);
      l.h = (l.w * 712) / 858;
      l.y = h;
      h += l.h + 1;
      return;
    }
    if (l.sep) {
      l.y = h + 1.5;
      h += 4;
      return;
    }
    if (l.gap) {
      h += l.gap;
      return;
    }
    tmp.setFont("helvetica", l.b ? "bold" : "normal");
    tmp.setFontSize(l.size);
    l.lines = tmp.splitTextToSize(l.txt, w);
    l.lh = l.size * 0.42;
    l.y = h + l.lh * 0.8;
    h += l.lines.length * l.lh + 0.8;
  });
  h += m + 4;
  const doc = new jsPDF({ unit: "mm", format: [ancho, Math.max(h, 40)] });
  L.forEach((l) => {
    if (l.sep) {
      doc.setLineDashPattern([1, 1], 0);
      doc.setLineWidth(0.2);
      doc.line(m, l.y, ancho - m, l.y);
      return;
    }
    if (l.gap) return;
    if (l.img) {
      doc.addImage(logoRecibo, "PNG", (ancho - l.w) / 2, l.y, l.w, l.h);
      return;
    }
    doc.setFont("helvetica", l.b ? "bold" : "normal");
    doc.setFontSize(l.size);
    l.lines.forEach((ln, i) =>
      doc.text(ln, l.c ? ancho / 2 : m, l.y + i * l.lh, { align: l.c ? "center" : "left" }),
    );
  });
  return doc.output("blob");
}
$("imprimir").onclick = async () => {
  if (!editando || !dl) return;
  const o = { ...editando };
  for (const [k, id] of Object.entries(CAMPOS)) o[k] = $(id).value.trim();
  const b = $("imprimir");
  b.disabled = true;
  $("msg").textContent = "Preparando el recibo…";
  const ent = o.estado === "entregado";
  try {
    const blob = ent
      ? reciboEntregaPDF(o, +$("papel").value || 58)
      : reciboPDF(o, +$("papel").value || 58);
    await dl.save({
      filename: `${ent ? "recibo-entrega" : "recibo"}-orden-${o.num}.pdf`,
      data: blob,
    });
    $("msg").textContent =
      "Recibo guardado. Ábralo para imprimirlo en la térmica o adjúntelo en el chat de WhatsApp del cliente.";
  } catch (e) {
    $("msg").textContent =
      e && e.code === "declined"
        ? "No se guardó el recibo."
        : "No se pudo preparar el recibo. Intente otra vez.";
  }
  b.disabled = false;
};
