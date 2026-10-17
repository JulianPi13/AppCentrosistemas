// ---- formulario ----
$("f-estado").innerHTML = ESTADOS.map((e) => `<option value="${e.k}">${e.n}</option>`).join("");
const CAMPOS = {
  tipo: "f-tipo",
  cliente: "f-cliente",
  tel: "f-tel",
  cedula: "f-cedula",
  marca: "f-marca",
  modelo: "f-modelo",
  imei: "f-imei",
  clave: "f-clave",
  falla: "f-falla",
  recibe: "f-recibe",
  estado: "f-estado",
  tecnico: "f-tecnico",
  entrega: "f-entrega",
  garantia: "f-garantia",
  diag: "f-diag",
  precio: "f-precio",
  repuesto: "f-repuesto",
  abono: "f-abono",
};
const NUM = ["precio", "repuesto", "abono", "garantia"];
function abrir(o) {
  editando = o || null;
  $("ptit").textContent = o ? `Orden #${o.num}` : "Recibir equipo";
  for (const [k, id] of Object.entries(CAMPOS))
    $(id).value = o
      ? (o[k] ?? (k === "tipo" ? "Celular" : ""))
      : k === "tipo"
        ? "Celular"
        : k === "estado"
          ? "recibido"
          : k === "garantia"
            ? "15"
            : k === "tel"
              ? "3102311490"
              : "";
  $("f-marca").placeholder = "";
  $("f-modelo").placeholder = "";
  $("f-marca").classList.remove("pedir");
  $("f-modelo").classList.remove("pedir");
  pintarEntInfo(o);
  {
    const fs = o && Array.isArray(o.fotosSolucion) ? o.fotosSolucion : [];
    $("g-sol").hidden = !fs.length;
    const z = $("sol-fotos");
    z.innerHTML = "";
    fs.forEach((f, i) => {
      const s = document.createElement("div");
      s.className = "slot llena";
      const im = document.createElement("img");
      ponerSrc(im, f);
      im.alt = "Foto " + (i + 1) + " de la reparación";
      im.onclick = () => verFoto(f);
      s.appendChild(im);
      z.appendChild(s);
    });
  }
  if (o) $("f-repuesto").value = o.repuesto ?? costos[o.id] ?? "";
  $("f-repref").value = (o && o.repref) || "";
  bloquear(!o);
  piezasSelect();
  $("f-pieza").value = (o && o.pieza) || "";
  $("f-pieza").disabled = !perm("estados");
  $("borrar").hidden = !o || !perm("eliminar");
  $("borrar2").hidden = true;
  $("msg").textContent = "";
  fotosEdit = o && Array.isArray(o.fotos) ? o.fotos.slice() : [];
  pintarFotos();
  patSeq =
    o && o.patron
      ? String(o.patron)
          .split("-")
          .map(Number)
          .filter((n) => n >= 1 && n <= 9)
      : [];
  pintarPat();
  $("guardar").textContent = o ? "Guardar cambios" : "Registrar equipo";
  $("fondo").hidden = false;
  $("panel").hidden = false;
  cuentas();
  $("panel").scrollTop = 0;
  if (!o) $("f-cliente").focus();
}
function cerrar() {
  if (!$("enc").hidden) {
    descartarEncNuevas();
    $("enc").hidden = true;
  }
  if (!$("rep").hidden && repFotos.length) limpiarRepFotos();
  $("fondo").hidden = true;
  $("panel").hidden = true;
  $("admin").hidden = true;
  $("inv").hidden = true;
  $("rep").hidden = true;
  $("caja").hidden = true;
  $("ent").hidden = true;
  $("voz").hidden = true;
  $("pos").hidden = true;
  cerrarGuia(true);
  editando = null;
}
const DATOS = [
  "f-tipo",
  "f-cliente",
  "f-tel",
  "f-cedula",
  "f-marca",
  "f-modelo",
  "f-imei",
  "f-clave",
  "f-falla",
  "f-recibe",
  "f-entrega",
  "f-garantia",
];
function bloquear(nuevo) {
  const datos = nuevo ? perm("recibir") : perm("editarDatos");
  DATOS.forEach((i) => {
    $(i).disabled = !datos;
  });
  patBloq = !datos;
  $("pat-borrar").hidden = !datos;
  const dg = perm("diagnostico") || (nuevo && perm("recibir"));
  $("f-diag").disabled = !dg;
  $("f-tecnico").disabled = !dg;
  $("f-estado").disabled = !perm("estados");
  $("f-repref").disabled = !perm("estados");
  $("f-precio").disabled = !perm("cobros");
  $("f-abono").disabled = !perm("cobros");
  $("guardar").hidden = rolActual() === "consulta";
}
$("nueva").onclick = () => abrir(null);
$("cerrar").onclick = cerrar;
$("fondo").onclick = cerrar;
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$("panel").hidden) cerrar();
});
function cuentas() {
  $("c-repref").hidden = !(db && $("f-estado").value === "repuesto");
  const p = +$("f-precio").value || 0,
    r = +$("f-repuesto").value || 0,
    a = +$("f-abono").value || 0;
  $("saldo").textContent = pesos(Math.max(0, p - a));
  $("ganancia").textContent = pesos(p - r);
  $("imprimir").hidden = !(editando && dl && window.jspdf);
  $("papel").hidden = $("imprimir").hidden;
  $("zona-wa").hidden = !editando || !perm("whatsapp");
  if (editando && perm("whatsapp")) {
    const href = linkWA({
      avisos: editando.avisos,
      listoEn: editando.listoEn,
      llegoRepuesto:
        editando.estado === "repuesto" && $("f-estado").value === "reparacion"
          ? 1
          : editando.llegoRepuesto,
      diag: $("f-diag").value,
      num: editando.num,
      ingreso: editando.ingreso,
      falla: $("f-falla").value,
      entrega: $("f-entrega").value,
      cliente: $("f-cliente").value,
      tel: $("f-tel").value,
      marca: $("f-marca").value,
      modelo: $("f-modelo").value,
      estado: $("f-estado").value,
      precio: p,
      abono: a,
      garantia: $("f-garantia").value,
    });
    $("imprimir").textContent =
      $("f-estado").value === "entregado" ? "Recibo de entrega PDF" : "Recibo PDF";
    $("wa").hidden = !href;
    $("sin-tel").hidden = !!href;
    if (href) $("wa").href = href;
    const es = $("f-estado").value;
    $("wa").textContent =
      es === "listo"
        ? "Avisar por WhatsApp que está listo"
        : es === "recibido"
          ? "Enviar recibo al cliente por WhatsApp"
          : es === "entregado"
            ? "Enviar agradecimiento y garantía por WhatsApp"
            : es === "sinreparacion"
              ? "Avisar que no tuvo reparación"
              : es === "repuesto"
                ? "Avisar que se encarga el repuesto"
                : es === "reparacion" && (editando.llegoRepuesto || editando.estado === "repuesto")
                  ? "Avisar que llegó el repuesto"
                  : es === "reparacion"
                    ? "Avisar que está en reparación"
                    : es === "diagnostico"
                      ? "Avisar que está en diagnóstico"
                      : "Avisar por WhatsApp";
  }
}
const DIAS_AVISO = 5;
const ESTADOS_AVISO = ["repuesto", "reparacion", "sinreparacion"];
function yaAvisadoEstado(o) {
  const a = o.avisoEstado;
  return !!(a && a.estado === o.estado && (!o.estadoDesde || a.fecha >= o.estadoDesde));
}
async function marcarAvisoEstado(o) {
  if (!db) return;
  try {
    const act = ordenes.find((x) => x.id === o.id) || o;
    await guardarOrden({
      ...act,
      avisoEstado: { estado: act.estado, fecha: new Date().toISOString() },
    });
  } catch (e) {}
}
async function marcarAviso(o) {
  if (!db) return;
  try {
    const act = ordenes.find((x) => x.id === o.id) || o;
    await guardarOrden({
      ...act,
      avisos: (Array.isArray(act.avisos) ? act.avisos : [])
        .concat([new Date().toISOString()])
        .slice(-20),
    });
  } catch (e) {}
}
$("wa").addEventListener("click", () => {
  if (
    editando &&
    ESTADOS_AVISO.includes(editando.estado) &&
    $("f-estado").value === editando.estado
  )
    marcarAvisoEstado(editando);
  if (editando && $("f-estado").value === "listo" && editando.estado === "listo")
    marcarAviso(editando).then(() => {
      const n = ordenes.find((x) => x.id === editando?.id);
      if (n) editando = { ...editando, avisos: n.avisos };
    });
});
const MSG_DEF = {
  saludo: "Hola {cliente}. Mi nombre es {asesor}, le comunico de {negocio}",
  recibido:
    "que recibimos su equipo para reparación.\n\n*RECIBO ORDEN #{orden}*\nFecha: {fecha}\nEquipo: {equipo}\nFalla: {falla}\nValor: {valor}\nAbono: {abono}\nSaldo: {saldo}\nFecha prometida: {prometida}\nGarantía: {garantia}\n\nConserve este mensaje: con el número de orden reclama su equipo.",
  diagnostico:
    "para informarle que su {equipo} (orden #{orden}) está en diagnóstico. Apenas sepamos qué tiene y cuánto cuesta le contamos.",
  repuesto:
    "para informarle que, para reparar su {equipo} (orden #{orden}), debemos encargar el repuesto.\n\nDiagnóstico: {diagnostico}\nValor de la reparación: {valor}\n\nApenas llegue el repuesto le avisamos.",
  repuesto_llego:
    "para informarle que ya llegó el repuesto de su {equipo} (orden #{orden}) y su equipo está en reparación. Le avisamos apenas esté listo.",
  reparacion:
    "para informarle que su {equipo} (orden #{orden}) ya está en reparación. Le avisamos apenas esté listo.",
  listo:
    "notificando que su equipo ya está listo.\n\nEquipo: {equipo}\nOrden: #{orden}\nValor: {valor}\nAbono: {abono}\nSaldo a pagar: {saldo}",
  listo_recordatorio:
    "le recordamos que su {equipo} (orden #{orden}) está listo desde el {listo_desde} y lo estamos guardando para usted. Puede pasar a recogerlo en nuestro horario.\n\nSaldo a pagar: {saldo}",
  sinreparacion:
    "para informarle que su {equipo} (orden #{orden}) no tuvo reparación.\n\nMotivo: {diagnostico}\nValor de la revisión: {saldo}\n\nPuede acercarse a recogerlo en nuestro horario de atención. Lo estamos guardando para usted.",
  entregado:
    "para agradecerle por confiar en nosotros.\n\n*RECIBO DE ENTREGA · ORDEN #{orden}*\nEquipo: {equipo}\nReparación: {diagnostico}\nValor: {valor}\n\n*Garantía: {garantia}* (hasta el {hasta}). Cubre solo la reparación realizada. No cubre pantallas quebradas, equipos mojados, golpes, equipos manipulados por terceros ni fallas distintas a la reparada.",
  entregado_sin:
    "para agradecerle por confiar en nosotros. Le entregamos su {equipo} (orden #{orden}) sin reparación. Quedamos atentos si necesita algo más.",
  encargo_cotizacion:
    "para informarle la cotización de su encargo (#{orden}): {descripcion}.\n\nCantidad: {cantidad}\nValor: {valor}\nAbono: {abono}\nSaldo: {saldo}\n\nCon el abono hacemos el pedido y le avisamos apenas llegue.",
  encargo_llego:
    "para informarle que ya llegó su encargo (#{orden}): {descripcion}.\n\nValor: {valor}\nAbono: {abono}\nSaldo a pagar: {saldo}\n\nPuede pasar a recogerlo en nuestro horario.",
  otro: "sobre su {equipo} (orden #{orden}). Estado actual: {estado}.\nValor de la reparación: {valor}",
};
const MSG_TIPOS = [
  ["recibido", "Equipo recibido (al registrarlo)"],
  ["repuesto", "Esperando repuesto"],
  ["repuesto_llego", "Llegó el repuesto"],
  ["reparacion", "En reparación"],
  ["listo", "Equipo listo"],
  ["listo_recordatorio", "Recordatorio (equipo listo hace días)"],
  ["sinreparacion", "No tuvo reparación"],
  ["entregado", "Entregado con garantía"],
  ["entregado_sin", "Entregado sin reparación"],
  ["encargo_cotizacion", "Encargo: cotización"],
  ["encargo_llego", "Encargo: ya llegó"],
  ["otro", "Otro estado"],
];
const msgTpl = (k) => (typeof MSG[k] === "string" && MSG[k].trim() ? MSG[k] : MSG_DEF[k]);
function varsWA(o, ex) {
  const p = +o.precio || 0,
    a = +o.abono || 0,
    eq = `${o.marca || ""} ${o.modelo || ""}`.trim(),
    dias = +o.garantia || garDef();
  const fe = new Date((o.entregaInfo && o.entregaInfo.fecha) || o.entregado || Date.now());
  const dm = (d) => new Date(d).toLocaleDateString("es-CO", { day: "numeric", month: "long" });
  return {
    cliente: o.cliente || "",
    asesor: String(MSG.asesor || "Jonier"),
    negocio: IMP.nombre,
    orden: o.num,
    equipo: eq,
    falla: o.falla || "",
    diagnostico: o.diag || "",
    valor: p ? pesos(p) : o.estado === "recibido" ? "Por definir" : "",
    abono: a ? pesos(a) : "",
    saldo: p ? pesos(Math.max(0, p - a)) : "",
    fecha: new Date(o.ingreso || Date.now()).toLocaleDateString("es-CO", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    prometida: o.entrega ? fecha(o.entrega) : "",
    garantia: dias + " días",
    listo_desde: dm(o.listoEn || (o.avisos && o.avisos[0]) || Date.now()),
    hasta: new Date(fe.getTime() + dias * 864e5).toLocaleDateString("es-CO", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    estado: (est(o.estado) || {}).n || "",
    ...(ex || {}),
  };
}
function llenarWA(tpl, v) {
  return String(tpl)
    .split("\n")
    .map((l) => {
      let vacio = false;
      const r = l.replace(/\{(\w+)\}/g, (m, k) => {
        if (!(k in v)) return m;
        const x = v[k];
        if (x === "" || x == null) {
          vacio = true;
          return "";
        }
        return x;
      });
      return vacio ? null : r;
    })
    .filter((l) => l !== null)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
function tipoWA(o) {
  if (o.estado === "listo")
    return Array.isArray(o.avisos) && o.avisos.length ? "listo_recordatorio" : "listo";
  if (o.estado === "reparacion" && o.llegoRepuesto) return "repuesto_llego";
  if (o.estado === "entregado")
    return o.entregaInfo && o.entregaInfo.sinReparacion ? "entregado_sin" : "entregado";
  return MSG_DEF[o.estado] ? o.estado : "otro";
}
function textoWA(o, tipo, ex) {
  const v = varsWA(o, ex);
  return (
    llenarWA(ex && ex.__saludo != null ? ex.__saludo : msgTpl("saludo"), v) +
    " " +
    llenarWA(ex && ex.__cuerpo != null ? ex.__cuerpo : msgTpl(tipo || tipoWA(o)), v)
  );
}
function linkWA(o) {
  const tel = String(o.tel || "").replace(/\D/g, "");
  if (tel.length < 7) return null;
  return `https://wa.me/${tel.length === 10 ? "57" + tel : tel}?text=${encodeURIComponent(textoWA(o))}`;
}
$("panel").addEventListener("input", (ev) => {
  if (ev.target.classList && ev.target.value) ev.target.classList.remove("pedir");
  cuentas();
});
async function encargoDeOrden(o) {
  if (!db || o.estado !== "repuesto" || !o.repref) return;
  const ex = o.encargoId ? encargos.find((x) => x.id === o.encargoId) : null;
  if (ex) {
    if (String(ex.descripcion || "") === o.repref) return;
    await db
      .doc("encargos/" + ex.id)
      .update({ descripcion: o.repref, actualizado: new Date().toISOString() });
    logAccion(
      "Encargo modificado",
      `#${ex.num} ${o.repref.slice(0, 50)} · desde la orden #${o.num}`,
    );
    return;
  }
  if (
    o.encargoId &&
    encargos.length &&
    !encargos.some((x) => x.id === o.encargoId) &&
    o.repref === (editando && editando.repref) &&
    editando.encargoId
  )
    return;
  const id = o.encargoId || "e" + Date.now().toString(36),
    num = String(encargos.reduce((t, x) => Math.max(t, +x.num || 0), 0) + 1);
  const doc = {
    tipo: "Repuesto",
    cant: 1,
    descripcion: o.repref,
    cliente: o.cliente || "",
    tel: o.tel || "",
    proveedor: "",
    precio: 0,
    estado: "porpedir",
    ordenId: o.id,
    equipo: [o.marca, o.modelo].filter(Boolean).join(" "),
    num,
    fecha: new Date().toISOString(),
    creadoPor: (sesion && sesion.nombre) || "",
    fotos: [],
    pagos: [],
    actualizado: new Date().toISOString(),
  };
  await db.doc("encargos/" + id).set(doc);
  if (!o.encargoId) {
    o.encargoId = id;
    await guardarOrden(o);
  }
  logAccion("Encargo creado", `#${num} ${o.repref.slice(0, 50)} · desde la orden #${o.num}`);
}
$("panel").onsubmit = async (ev) => {
  ev.preventDefault();
  const o = editando
    ? { ...editando }
    : {
        id: "o" + Date.now().toString(36),
        ingreso: new Date().toISOString(),
        recibidoPor: sesion ? sesion.nombre : "",
        num: String(ordenes.reduce((m, x) => Math.max(m, +x.num || 0), 1000) + 1),
      };
  for (const [k, id] of Object.entries(CAMPOS)) {
    const v = $(id).value.trim();
    o[k] = NUM.includes(k) ? (v === "" ? 0 : +v) : v;
  }
  if (!editando && (!o.marca || !o.modelo)) {
    $("msg").textContent =
      "Falta la marca o la referencia del equipo. Escríbalas antes de registrar.";
    const c = !o.marca ? $("f-marca") : $("f-modelo");
    c.classList.add("pedir");
    c.scrollIntoView({ block: "center" });
    c.focus();
    return;
  }
  if (!editando && fotosEdit.length < 2) {
    $("msg").textContent = !puedeFotos()
      ? "Para registrar hay que subir mínimo 2 fotos del equipo, y esta cuenta no puede subir fotos. Pídale al administrador que haga la recepción."
      : `Faltan fotos del equipo: tome mínimo 2 (lleva ${fotosEdit.length}). Enfoque las fallas o detalles importantes.`;
    $("g-fotos").hidden = false;
    $("g-fotos").classList.add("guiando");
    $("g-fotos").scrollIntoView({ block: "center", behavior: "smooth" });
    setTimeout(() => $("g-fotos").classList.remove("guiando"), 2500);
    return;
  }
  o.fotos = fotosEdit.slice();
  o.patron = patSeq.join("-");
  o.repref = $("f-repref").value.trim();
  o.pieza = $("f-pieza").value;
  const piezaAntes = editando ? editando.pieza || "" : "";
  if (
    editando &&
    !perm("bajar") &&
    ((+o.precio || 0) < (+editando.precio || 0) || (+o.abono || 0) < (+editando.abono || 0))
  ) {
    $("msg").textContent =
      "No tiene permiso para bajar o borrar valores ya registrados (valor o abono). Pídaselo al administrador.";
    return;
  }
  const ahora = new Date().toISOString(),
    abAntes = editando ? +editando.abono || 0 : 0;
  let cobroAuto = 0;
  if (o.estado === "entregado" && !o.entregado) o.entregado = ahora;
  if (o.estado === "listo" && !o.listoEn) o.listoEn = ahora;
  if (!editando || editando.estado !== o.estado) {
    o.estadoDesde = ahora;
    if (editando && editando.estado === "repuesto" && o.estado !== "repuesto")
      o.llegoRepuesto = ahora;
  }
  if (
    o.estado === "entregado" &&
    (!editando || editando.estado !== "entregado") &&
    (+o.precio || 0) > (+o.abono || 0)
  ) {
    cobroAuto = +o.precio - (+o.abono || 0);
    o.abono = +o.precio;
  }
  if ((+o.abono || 0) !== abAntes)
    o.pagos = pagosDe(editando || {}).concat([
      { fecha: ahora, monto: (+o.abono || 0) - abAntes, quien: sesion ? sesion.nombre : "" },
    ]);
  $("guardar").disabled = true;
  $("msg").textContent = "Guardando…";
  try {
    await guardarOrden(o);
    try {
      await encargoDeOrden(o);
    } catch (e) {}
    if (invCol && o.pieza !== piezaAntes) {
      try {
        if (piezaAntes) await moverInv(piezaAntes, 1, "devuelto, orden #" + o.num);
        if (o.pieza) await moverInv(o.pieza, -1, "instalado, orden #" + o.num);
      } catch (e) {}
    }
    if (!editando) {
      editando = o;
      $("ptit").textContent = `Orden #${o.num}`;
      $("borrar").hidden = false;
      $("guardar").textContent = "Guardar cambios";
      $("msg").textContent = porFoto
        ? `Orden #${o.num} creada desde la foto.`
        : `Equipo registrado con la orden #${o.num}.`;
      porFoto = false;
      cuentas();
      if (perm("whatsapp") && !$("wa").hidden) {
        $("msg").textContent +=
          " Toque el botón verde para enviarle el recibo al cliente por WhatsApp. Si quiere mandarle también el PDF, toque Recibo PDF y adjúntelo en ese chat.";
        $("zona-wa").scrollIntoView({ block: "center" });
      } else $("msg").textContent += " Toque Recibo PDF para imprimirlo.";
    } else {
      editando = o;
      $("msg").textContent =
        "Cambios guardados." +
        (cobroAuto ? ` Se registró en la caja el pago del saldo (${pesos(cobroAuto)}).` : "");
      $("f-abono").value = o.abono || "";
      cuentas();
    }
  } catch (e) {
    $("msg").textContent =
      e && e.code === "invalid_argument"
        ? "No tiene permiso para guardar en esta app."
        : "No se pudo guardar. Revise la conexión e intente otra vez.";
  }
  $("guardar").disabled = false;
};
$("borrar").onclick = () => {
  $("borrar").hidden = true;
  $("borrar2").hidden = false;
};
$("borrar2").onclick = async () => {
  try {
    const copia = JSON.parse(JSON.stringify(editando)),
      fs = fotosEdit.concat(Array.isArray(editando.fotosSolucion) ? editando.fotosSolucion : []),
      pz = editando.pieza,
      nm = editando.num,
      cr = costos[editando.id];
    await borrarOrden(editando.id);
    logAccion(
      "Orden eliminada",
      `#${nm} ${[copia.marca, copia.modelo].filter(Boolean).join(" ")} · ${copia.cliente || ""}`,
    );
    if (pz && invCol) {
      moverInv(pz, 1, "orden #" + nm + " eliminada").catch(() => {});
    }
    cerrar();
    ofrecerDeshacer(
      "Orden #" + nm + " eliminada",
      async () => {
        await guardarOrden(esAdmin && cr !== undefined ? { ...copia, repuesto: cr } : copia);
        if (pz && invCol) await moverInv(pz, -1, "orden #" + nm + " restaurada");
      },
      () => {
        fs.forEach((f) => borrarFoto(f));
      },
    );
  } catch (e) {
    $("msg").textContent = "No se pudo eliminar.";
  }
};
