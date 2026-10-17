// ---- reportar reparación ----
const PEND_REP = ["recibido", "diagnostico", "repuesto", "reparacion"];
let repSel = null,
  repFotos = [];
function abrirRep() {
  cerrar();
  $("fondo").hidden = false;
  $("rep").hidden = false;
  $("rep-buscar").value = "";
  verRepLista();
}
function verRepLista() {
  limpiarRepFotos();
  repSel = null;
  $("rep-paso1").hidden = false;
  $("rep-paso2").hidden = true;
  $("rep-msg").textContent = "";
  pintarRepLista();
}
function limpiarRepFotos() {
  repFotos.forEach((f) => borrarFoto(f));
  repFotos = [];
}
$("btn-rep").onclick = abrirRep;
$("rep-cerrar").onclick = () => {
  limpiarRepFotos();
  cerrar();
};
$("rep-otra").onclick = verRepLista;
function pintarRepLista() {
  const q = $("rep-buscar").value.trim().toLowerCase(),
    l = $("rep-lista");
  l.innerHTML = "";
  const v = ordenes
    .filter(
      (o) =>
        PEND_REP.includes(o.estado) &&
        (!q ||
          [o.num, o.cliente, o.tel, o.marca, o.modelo, o.falla]
            .join(" ")
            .toLowerCase()
            .includes(q)),
    )
    .sort(
      (a, b) =>
        diasAtraso(b) - diasAtraso(a) ||
        PEND_REP.indexOf(b.estado) - PEND_REP.indexOf(a.estado) ||
        (+a.num || 0) - (+b.num || 0),
    );
  $("rep-lista-t").textContent =
    `Equipos pendientes por reparar · ${ordenes.filter((o) => PEND_REP.includes(o.estado)).length}`;
  if (!v.length) {
    l.innerHTML =
      '<p class="aviso" style="margin:0">No hay equipos pendientes' +
      (q ? " que coincidan" : "") +
      ".</p>";
    return;
  }
  v.forEach((o) => {
    const e = est(o.estado),
      b = document.createElement("button");
    b.type = "button";
    b.className = "mov";
    b.style.borderLeft = `5px solid var(${e.c})`;
    b.style.paddingLeft = "10px";
    b.innerHTML = "<span></span><b></b><small></small>";
    b.querySelector("span").textContent =
      `#${o.num} · ${[o.marca, o.modelo].filter(Boolean).join(" ")} · ${o.cliente || ""}`;
    {
      const da = diasAtraso(o);
      b.querySelector("b").textContent = da >= DIAS_ATRASO ? `${da} días sin revisar` : e.n;
      b.querySelector("b").style.color = da >= DIAS_ATRASO ? "#c0392b" : `var(${e.c})`;
      if (da >= DIAS_ATRASO) b.style.borderLeftColor = "#c0392b";
    }
    b.querySelector("small").textContent = (o.falla || "") + " · entró " + fecha(o.ingreso);
    b.onclick = () => elegirRep(o.id);
    l.appendChild(b);
  });
}
$("rep-buscar").oninput = pintarRepLista;
function elegirRep(id) {
  const o = ordenes.find((x) => x.id === id);
  if (!o) return;
  repSel = o.id;
  repFotos = [];
  $("rep-paso1").hidden = true;
  $("rep-paso2").hidden = false;
  $("rep-msg").textContent = "";
  $("rep-exp").textContent = "";
  $("rep-tit").textContent = `Orden #${o.num}`;
  const dl2 = document.createElement("dl");
  dl2.className = "ent-res";
  dl2.style.margin = "0";
  [
    ["Equipo", [o.marca, o.modelo].filter(Boolean).join(" ")],
    ["Cliente", o.cliente],
    ["Falla", o.falla],
    ["Cómo llegó", o.recibe],
    ["Clave", o.clave || (o.patron ? "Patrón " + o.patron : "")],
    ["Estado", est(o.estado).n],
    ["Trabajo anterior", o.diag],
    ["Valor actual", +o.precio ? pesos(o.precio) : "Sin valor"],
  ].forEach(([k, v]) => {
    if (!v) return;
    const dt = document.createElement("dt");
    dt.textContent = k;
    const dd = document.createElement("dd");
    dd.textContent = v;
    dl2.append(dt, dd);
  });
  $("rep-res").innerHTML = "";
  $("rep-res").appendChild(dl2);
  $("rep-nota").value = "";
  $("rep-trab").value = "";
  $("rep-estado").value = "listo";
  $("rep-valor").value = +o.precio || "";
  const piezas = inv.filter((it) => (+it.cantidad || 0) > 0 || it.id === o.pieza);
  $("rep-pieza").innerHTML =
    '<option value="">Ninguno o no está en el inventario</option>' +
    piezas
      .map(
        (it) =>
          `<option value="${esc(it.id)}">${esc(nomItem(it))} (quedan ${+it.cantidad || 0})</option>`,
      )
      .join("");
  $("rep-pieza").value = o.pieza || "";
  $("c-repcosto").hidden = !esAdmin;
  $("rep-costo").value = esAdmin ? costos[o.id] || "" : "";
  $("rep-valor").disabled = !(perm("cobros") || perm("reportar"));
  pintarRepFotos();
  setTimeout(() => $("rep-nota").focus(), 60);
}
function pintarRepFotos() {
  const z = $("rep-fotos");
  z.innerHTML = "";
  repFotos.forEach((f, i) => {
    const s = document.createElement("div");
    s.className = "slot llena";
    const im = document.createElement("img");
    ponerSrc(im, f);
    im.alt = "Foto " + (i + 1) + " de la solución";
    im.onclick = () => verFoto(f);
    const q = document.createElement("button");
    q.type = "button";
    q.className = "quitar";
    q.textContent = "Quitar";
    q.onclick = () => {
      repFotos.splice(i, 1);
      borrarFoto(f);
      pintarRepFotos();
    };
    s.append(im, q);
    z.appendChild(s);
  });
  if (!puedeFotos()) {
    z.innerHTML =
      '<p class="falta" style="margin:0;grid-column:1/-1">Esta cuenta no puede guardar fotos, así que no puede guardar el reporte.</p>';
    return;
  }
  if (repFotos.length < 3) {
    const s = document.createElement("label");
    s.className = "slot";
    s.textContent = "+ Foto de la solución";
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "image/*";
    inp.setAttribute("capture", "environment");
    inp.id = "rep-foto-" + repFotos.length;
    inp.onchange = async () => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      $("rep-msg").textContent = "Subiendo foto…";
      try {
        repFotos.push(await subirBlobFoto(f));
        $("rep-msg").textContent = "";
      } catch (e) {
        $("rep-msg").textContent = errFoto(e);
      }
      pintarRepFotos();
    };
    s.appendChild(inp);
    z.appendChild(s);
  }
}
$("rep-leer").onclick = async () => {
  const nota = $("rep-nota").value.trim(),
    o = ordenes.find((x) => x.id === repSel);
  if (!nota) {
    $("rep-msg").textContent = "Primero dicte o escriba qué se le hizo al equipo.";
    return;
  }
  if (!sample) {
    $("rep-trab").value = nota;
    return;
  }
  const piezas = inv.filter((it) => (+it.cantidad || 0) > 0);
  const b = $("rep-leer");
  b.disabled = true;
  $("rep-msg").textContent = "Entendiendo lo que dictó…";
  try {
    const d = await sample.json(
      `Eres el asistente de un taller de reparación de celulares en Colombia. Un técnico dictó por voz (puede tener errores de dictado) lo que le hizo a este equipo:
Equipo: ${[o.marca, o.modelo].filter(Boolean).join(" ")} · Falla reportada: ${o.falla || ""} · Valor actual: ${+o.precio || 0}
Lo que dictó: """${nota}"""
Repuestos en inventario (id | nombre | cantidad):
${piezas.map((it) => `${it.id} | ${nomItem(it)} | ${+it.cantidad || 0}`).join("\n") || "(vacío)"}
Responde SOLO con un objeto JSON:
- trabajo: frase clara y corta de lo que se hizo, para el historial (ej: "Cambio de módulo de pantalla Redmi 12C. Queda funcionando").
- estado: uno de "listo" (quedó reparado), "reparacion" (sigue trabajando en él), "repuesto" (hay que pedir o esperar repuesto), "sinreparacion" (no se pudo reparar o el cliente no aceptó). Si no dice nada distinto, "listo".
- valor: valor a cobrar al cliente en pesos, entero ("160 mil" = 160000). 0 si no lo dice.
- costo_repuesto: solo si dice cuánto le COSTÓ la pieza al taller; si no, 0.
- repuesto_id: id del repuesto del inventario usado, solo si coincide claramente; "" si no.
- repuesto_nombre: repuesto que dice que usó, aunque no esté en el inventario; "".
- duda: frase corta si algo no está claro (por ejemplo si "costó" es lo que se cobra o lo que costó la pieza); "" si todo está claro.
No inventes datos.`,
      { modelTier: "default" },
    );
    $("rep-trab").value = d.trabajo || nota;
    if (["listo", "reparacion", "repuesto", "sinreparacion"].includes(d.estado))
      $("rep-estado").value = d.estado;
    if (+d.valor && !$("rep-valor").disabled) $("rep-valor").value = +d.valor;
    if (piezas.some((it) => it.id === d.repuesto_id)) $("rep-pieza").value = d.repuesto_id;
    if (esAdmin && +d.costo_repuesto) $("rep-costo").value = +d.costo_repuesto;
    const exp = [];
    if (d.repuesto_nombre && !$("rep-pieza").value)
      exp.push(
        `El repuesto "${d.repuesto_nombre}" no está en el inventario, así que no se descuenta nada.`,
      );
    if (d.duda) exp.push(d.duda);
    $("rep-exp").textContent = exp.join(" ");
    $("rep-exp").style.color = exp.length ? "var(--s-rep)" : "var(--muted)";
    $("rep-msg").textContent = repFotos.length
      ? "Revise los datos y toque Guardar reporte."
      : "Revise los datos, tome mínimo 1 foto de la solución y toque Guardar reporte.";
  } catch (e) {
    $("rep-msg").textContent =
      e && e.code === "not_granted"
        ? "Debe permitir que la app use a Claude para entender lo que dictó."
        : e && e.code === "rate_limited"
          ? "Demasiadas solicitudes seguidas. Espere un momento."
          : "No se pudo entender el texto. Escriba el trabajo hecho a mano.";
    if (!$("rep-trab").value) $("rep-trab").value = nota;
  }
  b.disabled = false;
};
$("rep-paso2").onsubmit = async (ev) => {
  ev.preventDefault();
  const o = ordenes.find((x) => x.id === repSel);
  if (!o) {
    $("rep-msg").textContent = "Esa orden ya no existe.";
    return;
  }
  const trab = $("rep-trab").value.trim() || $("rep-nota").value.trim();
  if (!trab) {
    $("rep-msg").textContent = "Escriba o dicte qué se le hizo al equipo.";
    $("rep-nota").focus();
    return;
  }
  if (!repFotos.length) {
    $("rep-msg").textContent = "Falta la foto de la solución: tome mínimo 1.";
    $("rep-fotos").scrollIntoView({ block: "center", behavior: "smooth" });
    return;
  }
  const valor = +$("rep-valor").value || 0,
    pz = $("rep-pieza").value,
    es = $("rep-estado").value,
    ahora = new Date().toISOString();
  if (valor && valor < (+o.precio || 0) && !perm("bajar")) {
    $("rep-msg").textContent =
      `El valor nuevo es menor al que ya tenía la orden (${pesos(o.precio)}). No tiene permiso para bajarlo; pídaselo al administrador.`;
    return;
  }
  const n = { ...o, estado: es };
  n.diag = (o.diag ? o.diag + "\n" : "") + trab;
  if (valor && (perm("cobros") || perm("reportar"))) n.precio = valor;
  if (pz) n.pieza = pz;
  n.fotosSolucion = (Array.isArray(o.fotosSolucion) ? o.fotosSolucion : []).concat(repFotos);
  n.reportes = (Array.isArray(o.reportes) ? o.reportes : [])
    .concat([{ fecha: ahora, quien: sesion ? sesion.nombre : "", trabajo: trab, estado: es }])
    .slice(-20);
  if (sesion && !o.tecnico && rolActual() === "tecnico") n.tecnico = sesion.nombre;
  if (es !== o.estado) {
    n.estadoDesde = ahora;
    if (o.estado === "repuesto" && es !== "repuesto") n.llegoRepuesto = ahora;
  }
  if (es === "listo" && !o.listoEn) n.listoEn = ahora;
  if (esAdmin && +$("rep-costo").value) n.repuesto = +$("rep-costo").value;
  const ok = $("rep-ok");
  ok.disabled = true;
  $("rep-msg").textContent = "Guardando…";
  try {
    await guardarOrden(n);
    if (invCol && pz && pz !== (o.pieza || "")) {
      try {
        if (o.pieza) await moverInv(o.pieza, 1, "devuelto, orden #" + o.num);
        await moverInv(pz, -1, "instalado, orden #" + o.num);
      } catch (e) {}
    }
    repFotos = [];
    cerrar();
    abrir(n);
    $("msg").textContent =
      `Reporte guardado. La orden #${n.num} quedó en "${est(es).n}".` +
      (perm("whatsapp") && !$("wa").hidden ? " Ya puede avisarle al cliente por WhatsApp." : "");
  } catch (e) {
    $("rep-msg").textContent =
      e && e.code === "invalid_argument"
        ? "Esta cuenta no tiene permiso para guardar."
        : "No se pudo guardar. Revise la conexión e intente otra vez.";
  }
  ok.disabled = false;
};
