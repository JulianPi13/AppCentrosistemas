// ---- entregar equipo ----
let entSel = null,
  entConRecibo = true,
  entFoto = null,
  entConfirmar = false,
  entUltima = null;
function pintarEntInfo(o) {
  const g = $("ent-info"),
    e = o && o.entregaInfo;
  g.hidden = !e;
  if (!e) return;
  const t = [
    `Entregado el ${new Date(e.fecha).toLocaleString("es-CO", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}` +
      (e.quien ? ` por ${e.quien}` : ""),
  ];
  if (e.monto) t.push(`Cobró ${pesos(e.monto)}` + (e.metodo ? ` (${e.metodo})` : ""));
  if (e.debe) t.push(`Quedó debiendo ${pesos(e.debe)}`);
  t.push(
    e.conRecibo
      ? "El cliente presentó el recibo."
      : `Sin recibo. Recibió ${e.recibe || "—"}, cédula ${e.cedula || "—"}.`,
  );
  $("ent-info-txt").textContent = t.join(" · ");
  const z = $("ent-info-foto");
  z.innerHTML = "";
  if (e.foto) {
    const s = document.createElement("div");
    s.className = "slot llena";
    const im = document.createElement("img");
    ponerSrc(im, e.foto);
    im.alt = "Foto de quien recibió el equipo con su cédula";
    im.onclick = () => verFoto(e.foto);
    s.appendChild(im);
    z.appendChild(s);
  }
}
function entPendientes() {
  const q = $("ent-buscar").value.trim().toLowerCase();
  return ordenes
    .filter(
      (o) =>
        o.estado !== "entregado" &&
        (!q ||
          [o.num, o.cliente, o.tel, o.marca, o.modelo, o.imei].join(" ").toLowerCase().includes(q)),
    )
    .sort(
      (a, b) =>
        (/listo|sinreparacion/.test(a.estado) ? 0 : 1) -
          (/listo|sinreparacion/.test(b.estado) ? 0 : 1) || (+b.num || 0) - (+a.num || 0),
    );
}
function pintarEntLista() {
  const l = $("ent-lista"),
    v = entPendientes();
  l.innerHTML = "";
  if (!v.length) {
    l.innerHTML =
      '<p class="aviso" style="margin:0">No hay equipos pendientes por entregar' +
      ($("ent-buscar").value ? " que coincidan" : "") +
      ".</p>";
    return;
  }
  v.forEach((o) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "mov";
    b.innerHTML = "<span></span><b></b><small></small>";
    b.querySelector("span").textContent =
      `#${o.num} · ${[o.marca, o.modelo].filter(Boolean).join(" ")} · ${o.cliente || ""}`;
    const ep = estadoPago(o);
    b.querySelector("b").textContent = ep.txt;
    b.querySelector("b").style.color = ep.pagado ? "var(--s-listo)" : "var(--s-rep)";
    b.querySelector("small").textContent = est(o.estado).n + (o.tel ? " · " + o.tel : "");
    b.onclick = () => elegirEnt(o.id);
    l.appendChild(b);
  });
}
function abrirEntrega(id) {
  cerrar();
  $("fondo").hidden = false;
  $("ent").hidden = false;
  $("ent-fin").hidden = true;
  $("ent-buscar").value = "";
  if (id) elegirEnt(id);
  else {
    $("ent-paso1").hidden = false;
    $("ent-paso2").hidden = true;
    pintarEntLista();
    $("ent-buscar").focus();
  }
}
function elegirEnt(id) {
  const o = ordenes.find((x) => x.id === id);
  if (!o) return;
  entSel = o.id;
  entConfirmar = false;
  entFoto = null;
  $("ent-paso1").hidden = true;
  $("ent-paso2").hidden = false;
  $("ent-msg").textContent = "";
  const p = +o.precio || 0,
    a = +o.abono || 0,
    sal = Math.max(0, p - a);
  $("ent-tit").textContent = `Orden #${o.num}`;
  const filas = [
    ["Cliente", o.cliente],
    ["Teléfono", o.tel],
    ["Equipo", [o.marca, o.modelo].filter(Boolean).join(" ")],
    ["Trabajo", o.diag || o.falla],
    ["Estado", est(o.estado).n],
    ["Valor", p ? pesos(p) : "Sin valor"],
    ["Abonado", pesos(a)],
    ["Saldo", p ? pesos(sal) : "Sin valor"],
    ["Pago", estadoPago(o).txt],
  ];
  const dl = document.createElement("dl");
  dl.className = "ent-res";
  dl.style.margin = "0";
  filas.forEach(([k, v]) => {
    if (v === "" || v == null) return;
    const dt = document.createElement("dt");
    dt.textContent = k;
    const dd = document.createElement("dd");
    dd.textContent = v;
    if (k === "Saldo") dd.className = "grande";
    dl.append(dt, dd);
  });
  $("ent-res").innerHTML = "";
  $("ent-res").appendChild(dl);
  if (o.estado !== "listo" && o.estado !== "sinreparacion") {
    const w = document.createElement("p");
    w.className = "falta";
    w.style.margin = "8px 0 0";
    w.textContent = `Ojo: esta orden está en "${est(o.estado).n}", no en "Listo para entregar".`;
    $("ent-res").appendChild(w);
  }
  $("ent-monto").value = sal || "";
  $("ent-monto").disabled = !perm("cobros");
  $("ent-cedula").value = o.cedula || "";
  $("ent-quien").value = o.cliente || "";
  ponerRecibo(true);
  entDebe();
  $("ent-ok").textContent = "Cerrar orden y entregar";
}
function estadoPago(o) {
  const p = +o.precio || 0,
    pag = pagosDe(o).reduce((s, x) => s + (+x.monto || 0), 0),
    sal = Math.max(0, p - pag);
  if (!p) return { pagado: false, sal: 0, txt: "Pendiente de pago (sin valor)" };
  if (sal <= 0) return { pagado: true, sal: 0, txt: "Pagado" };
  return { pagado: false, sal, txt: "Pendiente de pago " + pesos(sal) };
}
function entDebe() {
  const o = ordenes.find((x) => x.id === entSel);
  if (!o) return;
  const sal = Math.max(0, (+o.precio || 0) - (+o.abono || 0)),
    m = +$("ent-monto").value || 0;
  const d = $("ent-debe");
  entConfirmar = false;
  $("ent-ok").textContent = "Cerrar orden y entregar";
  if (!+o.precio) {
    d.textContent = m
      ? `Se registrará ${pesos(m)} como valor de la reparación y quedará pagado en la caja.`
      : "Esta orden no tiene valor registrado. Escriba cuánto paga el cliente.";
    d.style.color = m ? "var(--muted)" : "var(--s-rep)";
    return;
  }
  if (m < sal) {
    d.textContent = `El cliente quedaría debiendo ${pesos(sal - m)}.`;
    d.style.color = "var(--s-rep)";
  } else if (m > sal) {
    d.textContent = `Está recibiendo ${pesos(m - sal)} más que el saldo. Revise el valor.`;
    d.style.color = "var(--s-rep)";
  } else {
    d.textContent = sal
      ? "Con este pago la orden queda a paz y salvo."
      : "La orden ya está pagada.";
    d.style.color = "var(--muted)";
  }
}
$("ent-monto").addEventListener("input", entDebe);
function ponerRecibo(si) {
  entConRecibo = si;
  $("ent-si").setAttribute("aria-pressed", String(si));
  $("ent-no").setAttribute("aria-pressed", String(!si));
  $("ent-sin").hidden = si;
  if (!si) pintarEntFoto();
}
$("ent-si").onclick = () => ponerRecibo(true);
$("ent-no").onclick = () => ponerRecibo(false);
function pintarEntFoto() {
  const z = $("ent-foto-zona");
  z.innerHTML = "";
  if (!puedeFotos()) {
    z.innerHTML =
      '<p class="falta" style="margin:0;grid-column:1/-1">Esta cuenta no puede guardar fotos en la app, así que no se puede entregar sin recibo desde aquí. Pídale al administrador que haga la entrega.</p>';
    return;
  }
  if (entFoto) {
    const s = document.createElement("div");
    s.className = "slot llena";
    const im = document.createElement("img");
    ponerSrc(im, entFoto);
    im.alt = "Foto de quien recibe con su cédula";
    im.onclick = () => verFoto(entFoto);
    const q = document.createElement("button");
    q.type = "button";
    q.className = "quitar";
    q.textContent = "Repetir";
    q.onclick = () => {
      const f = entFoto;
      entFoto = null;
      pintarEntFoto();
      borrarFoto(f);
    };
    s.append(im, q);
    z.appendChild(s);
    return;
  }
  const s = document.createElement("label");
  s.className = "slot";
  s.textContent = "+ Tomar foto con la cédula";
  const inp = document.createElement("input");
  inp.type = "file";
  inp.accept = "image/*";
  inp.setAttribute("capture", "environment");
  inp.id = "ent-foto";
  inp.onchange = async () => {
    const f = inp.files && inp.files[0];
    if (!f) return;
    $("ent-msg").textContent = "Subiendo foto…";
    try {
      entFoto = await subirBlobFoto(f);
      $("ent-msg").textContent = "";
    } catch (e) {
      $("ent-msg").textContent = errFoto(e);
    }
    pintarEntFoto();
  };
  s.appendChild(inp);
  z.appendChild(s);
}
$("ent-paso2").onsubmit = async (ev) => {
  ev.preventDefault();
  const o = ordenes.find((x) => x.id === entSel);
  if (!o) {
    $("ent-msg").textContent = "Esa orden ya no existe.";
    return;
  }
  if (o.estado === "entregado") {
    $("ent-msg").textContent = "Esta orden ya fue entregada.";
    return;
  }
  const sal = Math.max(0, (+o.precio || 0) - (+o.abono || 0)),
    m = Math.max(0, Math.round(+$("ent-monto").value || 0));
  if (!entConRecibo) {
    if (!$("ent-cedula").value.trim()) {
      $("ent-msg").textContent = "Escriba la cédula de quien recibe el equipo.";
      $("ent-cedula").focus();
      return;
    }
    if (!entFoto) {
      $("ent-msg").textContent = "Falta la foto de la persona con su cédula y el equipo.";
      return;
    }
  }
  if (!+o.precio && !m) {
    if (!entConfirmar) {
      entConfirmar = true;
      $("ent-ok").textContent = "Sí, entregar sin cobrar nada";
      $("ent-msg").textContent =
        "La orden no tiene valor y no escribió ningún pago. Toque otra vez para confirmar.";
      return;
    }
  }
  if (m < sal) {
    if (!perm("bajar")) {
      $("ent-msg").textContent =
        `Debe cobrar el saldo completo (${pesos(sal)}). Para entregar debiendo, pídaselo al administrador.`;
      return;
    }
    if (!entConfirmar) {
      entConfirmar = true;
      $("ent-ok").textContent = `Sí, entregar debiendo ${pesos(sal - m)}`;
      $("ent-msg").textContent = "Toque otra vez para confirmar que el cliente queda debiendo.";
      return;
    }
  }
  const ahora = new Date().toISOString(),
    quien = sesion ? sesion.nombre : "";
  const n = { ...o, estado: "entregado", entregado: ahora, abono: (+o.abono || 0) + m };
  if (!+o.precio && m) n.precio = m;
  if (m)
    n.pagos = pagosDe(o).concat([{ fecha: ahora, monto: m, quien, metodo: $("ent-metodo").value }]);
  n.entregaInfo = {
    sinReparacion: o.estado === "sinreparacion",
    fecha: ahora,
    quien,
    monto: m,
    metodo: m ? $("ent-metodo").value : "",
    debe: Math.max(0, sal - m),
    conRecibo: entConRecibo,
    cedula: entConRecibo ? "" : $("ent-cedula").value.trim(),
    recibe: entConRecibo ? "" : $("ent-quien").value.trim(),
    foto: entConRecibo ? null : entFoto,
  };
  if (!entConRecibo && !n.cedula && $("ent-quien").value.trim() === (o.cliente || ""))
    n.cedula = $("ent-cedula").value.trim();
  const b = $("ent-ok");
  b.disabled = true;
  $("ent-msg").textContent = "Guardando…";
  try {
    await guardarOrden(n);
    $("ent-paso2").hidden = true;
    $("ent-fin").hidden = false;
    $("ent-fin-txt").textContent =
      `Orden #${n.num} cerrada. ${m ? `Se registró en la caja el pago de ${pesos(m)} (${n.entregaInfo.metodo}).` : "No hubo cobro."}${n.entregaInfo.debe ? ` Queda debiendo ${pesos(n.entregaInfo.debe)}.` : ""}`;
    const href = perm("whatsapp") ? linkWA(n) : null;
    $("ent-wa").hidden = !href;
    if (href) $("ent-wa").href = href;
    entFoto = null;
    entUltima = n;
    $("ent-pdf").hidden = !(dl && window.jspdf);
  } catch (e) {
    $("ent-msg").textContent = "No se pudo guardar. Revise la conexión e intente otra vez.";
  }
  b.disabled = false;
};
$("ent-buscar").oninput = pintarEntLista;
$("ent-otra").onclick = () => {
  if (entFoto) {
    borrarFoto(entFoto);
    entFoto = null;
  }
  $("ent-paso2").hidden = true;
  $("ent-paso1").hidden = false;
  pintarEntLista();
};
$("ent-otro").onclick = () => abrirEntrega(null);
$("ent-pdf").onclick = async () => {
  if (!entUltima || !dl) return;
  const b = $("ent-pdf");
  b.disabled = true;
  try {
    await dl.save({
      filename: `recibo-entrega-orden-${entUltima.num}.pdf`,
      data: reciboEntregaPDF(entUltima, +$("papel").value || 58),
    });
    $("ent-fin-txt").textContent +=
      " Recibo de entrega guardado: ábralo para imprimirlo o adjúntelo en el WhatsApp del cliente.";
  } catch (e) {
    if (!(e && e.code === "declined"))
      $("ent-fin-txt").textContent += " No se pudo preparar el recibo de entrega.";
  }
  b.disabled = false;
};
$("btn-ent").onclick = () => abrirEntrega(null);
$("ent-cerrar").onclick = () => {
  if (entFoto && !$("ent-paso2").hidden) {
    borrarFoto(entFoto);
    entFoto = null;
  }
  cerrar();
};
