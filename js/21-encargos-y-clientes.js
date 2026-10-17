// ---- encargos (repuestos, partes y accesorios que se piden) ----
// ---- base de datos de clientes (se arma sola con las órdenes y los encargos) ----
const normN = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
const ckey = (nombre, tel) => {
  const t = String(tel || "")
    .replace(/\D/g, "")
    .slice(-10);
  return t.length >= 7 ? "t" + t : "n" + normN(nombre);
};
function directorio() {
  const m = new Map();
  const add = (nombre, tel, ced, fecha, eq) => {
    nombre = String(nombre || "").trim();
    const t = String(tel || "")
      .replace(/\D/g, "")
      .slice(-10);
    if (!nombre && !t) return;
    const k = ckey(nombre, t);
    let c = m.get(k);
    if (!c) {
      c = { k, nombre, tel: t, cedula: "", equipos: [], ult: "" };
      m.set(k, c);
    }
    if (String(fecha) >= c.ult) {
      c.ult = String(fecha);
      if (nombre) c.nombre = nombre;
      if (t) c.tel = t;
    }
    if (ced && !c.cedula) c.cedula = String(ced);
    if (eq) c.equipos.push(eq);
  };
  [...ordenes]
    .filter((o) => !o.ejemplo)
    .sort((a, b) => String(b.ingreso).localeCompare(String(a.ingreso)))
    .forEach((o) =>
      add(o.cliente, o.tel, o.cedula, o.ingreso || "", {
        id: o.id,
        num: o.num,
        txt: [o.marca, o.modelo].filter(Boolean).join(" ") || "Equipo",
      }),
    );
  encargos.forEach((e) => add(e.cliente, e.tel, "", e.fecha || "", null));
  return [...m.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
}
function buscarCliente(nombre, tel) {
  const k = ckey(nombre, tel),
    d = directorio();
  return d.find((c) => c.k === k) || d.find((c) => normN(c.nombre) === normN(nombre)) || null;
}
function pintarClientesDL() {
  $("dl-clientes").innerHTML = directorio()
    .map((c) => `<option value="${esc(c.nombre)}" label="${esc(c.tel)}">`)
    .join("");
}
$("f-cliente").addEventListener("focus", pintarClientesDL);
$("f-cliente").addEventListener("change", () => {
  const c = buscarCliente($("f-cliente").value, "");
  if (!c) return;
  if (!$("f-tel").value && c.tel) $("f-tel").value = c.tel;
  if (!$("f-cedula").value && c.cedula) $("f-cedula").value = c.cedula;
});

let encargos = [],
  encSel = null,
  encFotos = [],
  encNuevas = [],
  encBorrar = [],
  encPagos = [],
  encFiltro = "";
const ENC_EST = [
  ["porpedir", "Por pedir", "--s-rep"],
  ["pedido", "Pedido", "--s-diag"],
  ["llego", "Llegó", "--s-listo"],
  ["entregado", "Entregado", "--s-ent"],
  ["cancelado", "Cancelado", "--s-sin"],
];
const encPagado = (e) =>
  (Array.isArray(e.pagos) ? e.pagos : []).reduce((t, p) => t + (+p.monto || 0), 0);
function encPagoTxt(e) {
  const p = +e.precio || 0,
    g = encPagado(e);
  if (g <= 0) return { t: p ? "Sin pago · Debe " + pesos(p) : "Sin pago", c: "pg-deb" };
  if (p && g >= p) return { t: "Pagado completo", c: "pg-ok" };
  return { t: "Abonó " + pesos(g) + (p ? " · Saldo " + pesos(p - g) : ""), c: "pg-deb" };
}
let encFCli = "",
  encFEq = "";
function pintarEnc() {
  const ch = $("enc-chips");
  ch.innerHTML = "";
  [["", "Todos"], ...ENC_EST.map((x) => [x[0], x[1]])].forEach(([k, n]) => {
    const c = encargos.filter((e) => !k || (e.estado || "porpedir") === k).length;
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = `${n} (${c})`;
    b.setAttribute("aria-pressed", String(encFiltro === k));
    b.onclick = () => {
      encFiltro = k;
      pintarEnc();
    };
    ch.appendChild(b);
  });
  const cl = new Map();
  encargos.forEach((e) => {
    if (e.cliente || e.tel) {
      const k = ckey(e.cliente, e.tel);
      if (!cl.has(k)) cl.set(k, e.cliente || e.tel);
    }
  });
  const eqs = [...new Set(encargos.map((e) => e.equipo).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
  if (encFCli && !cl.has(encFCli)) encFCli = "";
  if (encFEq && !eqs.includes(encFEq)) encFEq = "";
  $("enc-f-cli").innerHTML =
    '<option value="">Todos los clientes</option>' +
    [...cl.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([k, n]) => `<option value="${esc(k)}">${esc(n)}</option>`)
      .join("");
  $("enc-f-cli").value = encFCli;
  $("enc-f-eq").innerHTML =
    '<option value="">Todos los equipos</option>' +
    eqs.map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join("");
  $("enc-f-eq").value = encFEq;
  const q = $("enc-buscar").value.trim().toLowerCase(),
    l = $("enc-lista");
  l.innerHTML = "";
  const v = encargos
    .filter(
      (e) =>
        (!encFiltro || (e.estado || "porpedir") === encFiltro) &&
        (!encFCli || ckey(e.cliente, e.tel) === encFCli) &&
        (!encFEq || e.equipo === encFEq) &&
        (!q ||
          [e.num, e.descripcion, e.cliente, e.proveedor, e.tipo, e.equipo]
            .join(" ")
            .toLowerCase()
            .includes(q)),
    )
    .sort((a, b) => (+b.num || 0) - (+a.num || 0));
  if (!encargos.length) {
    l.innerHTML = '<div class="vacio">Todavía no hay encargos. Toque <b>+ Nuevo encargo</b>.</div>';
    return;
  }
  if (!v.length) {
    l.innerHTML = '<div class="vacio">No hay encargos con ese filtro.</div>';
    return;
  }
  v.forEach((e) => {
    const est2 = ENC_EST.find((x) => x[0] === (e.estado || "porpedir")) || ENC_EST[0],
      pg = encPagoTxt(e);
    const b = document.createElement("button");
    b.type = "button";
    b.className = "enc-card";
    b.innerHTML =
      '<span class="enc-th"></span><span class="enc-tx"><b></b><small class="s1"></small><small class="s2"></small></span><span class="enc-r"><span class="chip" style="--c:var(' +
      est2[2] +
      ')"></span><b class="pr"></b></span>';
    const th = b.querySelector(".enc-th");
    const f = Array.isArray(e.fotos) && e.fotos[0];
    if (f) {
      const im = document.createElement("img");
      im.alt = "";
      ponerSrc(im, f);
      th.appendChild(im);
    } else th.textContent = "Sin foto";
    b.querySelector(".enc-tx b").textContent = `#${e.num} · ${e.descripcion || ""}`;
    b.querySelector(".s1").textContent = [
      e.tipo,
      +e.cant > 1 ? e.cant + " unidades" : "",
      e.cliente,
      e.equipo ? "Equipo: " + e.equipo : "",
      e.proveedor ? "Cotizado con " + e.proveedor : "",
    ]
      .filter(Boolean)
      .join(" · ");
    const s2 = b.querySelector(".s2");
    s2.textContent = pg.t;
    s2.className = "s2 " + pg.c;
    b.querySelector(".chip").textContent = est2[1];
    b.querySelector(".pr").textContent = +e.precio ? pesos(e.precio) : "Sin precio";
    b.onclick = () => abrirEnc(e.id);
    l.appendChild(b);
  });
}
$("enc-f-cli").onchange = () => {
  encFCli = $("enc-f-cli").value;
  pintarEnc();
};
$("enc-f-eq").onchange = () => {
  encFEq = $("enc-f-eq").value;
  pintarEnc();
};
function llenarEquiposEnc(sel) {
  const c = buscarCliente($("enc-cliente").value, $("enc-tel").value),
    z = $("enc-equipo"),
    vistos = new Set();
  let h = '<option value="">Ninguno / otro equipo</option>';
  (c ? c.equipos : []).forEach((q) => {
    if (vistos.has(q.id)) return;
    vistos.add(q.id);
    h += `<option value="${esc(q.id)}" data-txt="${esc(q.txt)}">${esc(q.txt)} · orden #${esc(q.num)}</option>`;
  });
  if (sel && sel.ordenId && !vistos.has(sel.ordenId))
    h += `<option value="${esc(sel.ordenId)}" data-txt="${esc(sel.equipo || "")}">${esc(sel.equipo || "Equipo")} (orden vinculada)</option>`;
  z.innerHTML = h;
  z.value = sel && sel.ordenId ? sel.ordenId : "";
}
$("enc-cliente").addEventListener("focus", pintarClientesDL);
$("enc-cliente").addEventListener("change", () => {
  const c = buscarCliente($("enc-cliente").value, "");
  if (c && !$("enc-tel").value && c.tel) $("enc-tel").value = c.tel;
  llenarEquiposEnc(null);
  actualizarWAEnc();
});
$("enc-tel").addEventListener("change", () => llenarEquiposEnc(null));
function encVista(form) {
  $("enc-vista-lista").hidden = form;
  $("enc-f").hidden = !form;
}
function descartarEncNuevas() {
  encNuevas.forEach((f) => borrarFoto(f));
  encNuevas = [];
  encBorrar = [];
}
function encFormDatos() {
  const pr = Math.round(+$("enc-precio").value || 0);
  return {
    tipo: $("enc-tipo").value,
    cant: Math.max(1, Math.round(+$("enc-cant").value || 1)),
    descripcion: $("enc-desc").value.trim(),
    cliente: $("enc-cliente").value.trim(),
    tel: $("enc-tel").value.trim(),
    proveedor: $("enc-prov").value.trim(),
    precio: pr,
    estado: $("enc-estado").value,
    ...(() => {
      const z = $("enc-equipo"),
        o = z.selectedOptions && z.selectedOptions[0];
      return { ordenId: z.value || "", equipo: z.value && o ? o.dataset.txt || "" : "" };
    })(),
  };
}
function encSaldo() {
  const pr = Math.round(+$("enc-precio").value || 0);
  return Math.max(0, pr - encPagos.reduce((t, p) => t + (+p.monto || 0), 0));
}
function pintarEncPagos() {
  const z = $("enc-pagos");
  z.innerHTML = "";
  if (!encPagos.length) z.innerHTML = '<p class="aviso" style="margin:0">Todavía no hay pagos.</p>';
  encPagos.forEach((p, i) => {
    const d = document.createElement("div");
    d.className = "mov";
    d.innerHTML = "<span></span><b></b><small></small>";
    d.querySelector("span").textContent =
      (i === 0 ? "Primer pago" : "Pago " + (i + 1)) + " · " + (p.metodo || "Efectivo");
    d.querySelector("b").textContent = pesos(p.monto);
    const sm = d.querySelector("small");
    sm.textContent =
      [
        new Date(p.fecha).toLocaleString("es-CO", {
          day: "numeric",
          month: "short",
          hour: "numeric",
          minute: "2-digit",
        }),
        p.quien,
      ]
        .filter(Boolean)
        .join(" · ") + " ";
    if (perm("bajar")) {
      const q = document.createElement("button");
      q.type = "button";
      q.textContent = "Quitar";
      q.style.cssText = "padding:2px 8px;font-size:.78rem";
      q.onclick = async () => {
        if (!q.dataset.ok) {
          q.dataset.ok = "1";
          q.textContent = "¿Seguro? Quitar";
          return;
        }
        const pq = { ...encPagos[i] },
          idE = encSel,
          pos0 = i;
        encPagos.splice(i, 1);
        if (await guardarEnc(false)) {
          ofrecerDeshacer("Pago de " + pesos(pq.monto) + " quitado", async () => {
            const r = db.doc("encargos/" + idE),
              sn = await r.get();
            if (!sn.exists) return;
            const ps = (sn.data().pagos || []).slice();
            ps.splice(Math.min(pos0, ps.length), 0, pq);
            await r.update({ pagos: ps });
            if (encSel === idE) {
              encPagos = ps.slice();
              pintarEncPagos();
            }
          });
        }
        pintarEncPagos();
      };
      sm.appendChild(q);
    }
    z.appendChild(d);
  });
  const sal = encSaldo();
  $("enc-saldo").textContent = pesos(sal);
  $("enc-pmonto").value = "";
  actualizarWAEnc();
}
function linkEnc(e) {
  const tel = String(e.tel || "").replace(/\D/g, "");
  if (tel.length < 7) return null;
  const o = {
    num: e.num,
    cliente: e.cliente,
    marca: "",
    modelo: "",
    precio: e.precio,
    abono: encPagos.reduce((t, p) => t + (+p.monto || 0), 0),
    estado: "x",
  };
  const tipo = e.estado === "llego" ? "encargo_llego" : "encargo_cotizacion";
  return `https://wa.me/${tel.length === 10 ? "57" + tel : tel}?text=${encodeURIComponent(textoWA(o, tipo, { descripcion: e.descripcion, cantidad: String(e.cant || 1), proveedor: e.proveedor || "" }))}`;
}
function actualizarWAEnc() {
  const d = encFormDatos(),
    prev = encSel && encargos.find((x) => x.id === encSel);
  const h = linkEnc({ ...d, num: prev ? prev.num : "—" });
  $("enc-zona-wa").hidden = !h || !perm("whatsapp");
  if (h) $("enc-wa").href = h;
  $("enc-wa").textContent =
    d.estado === "llego" ? "Avisar por WhatsApp que ya llegó" : "Enviar cotización por WhatsApp";
}
function pintarEncFotos() {
  const z = $("enc-fotos");
  z.innerHTML = "";
  encFotos.forEach((f, i) => {
    const s = document.createElement("div");
    s.className = "slot llena";
    const im = document.createElement("img");
    ponerSrc(im, f);
    im.alt = "Foto " + (i + 1) + " del encargo";
    im.onclick = () => verFoto(f);
    const q = document.createElement("button");
    q.type = "button";
    q.className = "quitar";
    q.textContent = "Quitar";
    q.onclick = () => {
      encFotos.splice(i, 1);
      const k = encNuevas.indexOf(f);
      if (k >= 0) {
        encNuevas.splice(k, 1);
        borrarFoto(f);
      } else encBorrar.push(f);
      pintarEncFotos();
    };
    s.append(im, q);
    z.appendChild(s);
  });
  if (!puedeFotos()) {
    if (!encFotos.length)
      z.innerHTML =
        '<p class="falta" style="margin:0;grid-column:1/-1">Esta cuenta no puede guardar fotos. Puede guardar el encargo sin foto.</p>';
    return;
  }
  if (encFotos.length < 3) {
    const s = document.createElement("label");
    s.className = "slot";
    s.textContent = "+ Foto";
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "image/*";
    inp.setAttribute("capture", "environment");
    inp.onchange = async () => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      $("enc-msg").textContent = "Subiendo foto…";
      try {
        const r = await subirBlobFoto(f);
        encFotos.push(r);
        encNuevas.push(r);
        $("enc-msg").textContent = "";
      } catch (e) {
        $("enc-msg").textContent = errFoto(e);
      }
      pintarEncFotos();
    };
    s.appendChild(inp);
    z.appendChild(s);
  }
}
function abrirEnc(id) {
  $("enc-tipo").value = "Repuesto";
  $("enc-estado").innerHTML = ENC_EST.map((x) => `<option value="${x[0]}">${x[1]}</option>`).join(
    "",
  );
  $("enc-pmetodo").innerHTML = METODOS.map((m) => `<option>${m}</option>`).join("");
  $("enc-provs").innerHTML = [...new Set(encargos.map((e) => e.proveedor).filter(Boolean))]
    .map((p) => `<option value="${esc(p)}">`)
    .join("");
  const e = id ? encargos.find((x) => x.id === id) : null;
  encSel = e ? e.id : null;
  encNuevas = [];
  encBorrar = [];
  $("enc-tit").textContent = e ? `Encargo #${e.num}` : "Nuevo encargo";
  $("enc-tipo").value = e ? e.tipo || "Repuesto" : "Repuesto";
  $("enc-cant").value = e ? e.cant || 1 : 1;
  $("enc-desc").value = e ? e.descripcion || "" : "";
  $("enc-cliente").value = e ? e.cliente || "" : "";
  $("enc-tel").value = e ? e.tel || "" : "";
  $("enc-prov").value = e ? e.proveedor || "" : "";
  $("enc-precio").value = e && e.precio ? e.precio : "";
  $("enc-estado").value = e ? e.estado || "porpedir" : "porpedir";
  $("enc-costo-c").hidden = !esAdmin;
  $("enc-costo").value = e && esAdmin ? costos["enc-" + e.id] || "" : "";
  llenarEquiposEnc(e ? { ordenId: e.ordenId, equipo: e.equipo } : null);
  encFotos = e && Array.isArray(e.fotos) ? e.fotos.slice() : [];
  encPagos = e && Array.isArray(e.pagos) ? e.pagos.slice() : [];
  $("enc-borrar").hidden = !(e && perm("eliminar"));
  delete $("enc-borrar").dataset.ok;
  $("enc-borrar").textContent = "Eliminar";
  $("enc-msg").textContent = "";
  encVista(true);
  pintarEncFotos();
  pintarEncPagos();
  $("enc").scrollTop = 0;
}
async function guardarEnc(cerrarForm) {
  const d = encFormDatos(),
    m = $("enc-msg");
  if (!d.descripcion) {
    m.textContent = "Escriba la descripción detallada de lo que se pide.";
    $("enc-desc").focus();
    return false;
  }
  const prev = encSel ? encargos.find((x) => x.id === encSel) : null;
  if (prev && d.precio < (+prev.precio || 0) && !perm("bajar")) {
    m.textContent = `El precio nuevo es menor al que ya tenía el encargo (${pesos(prev.precio)}). No tiene permiso para bajarlo; pídaselo al administrador.`;
    return false;
  }
  const id = encSel || "e" + Date.now().toString(36),
    num = prev ? prev.num : String(encargos.reduce((t, x) => Math.max(t, +x.num || 0), 0) + 1);
  const doc = {
    ...(prev || {}),
    ...d,
    num,
    fecha: prev ? prev.fecha : new Date().toISOString(),
    creadoPor: prev ? prev.creadoPor : (sesion && sesion.nombre) || "",
    fotos: encFotos,
    pagos: encPagos,
    actualizado: new Date().toISOString(),
  };
  delete doc.id;
  m.textContent = "Guardando…";
  try {
    await db.doc("encargos/" + id).set(doc);
    {
      const n2 = `#${num} ${String(doc.descripcion).slice(0, 50)}${doc.cliente ? " · " + doc.cliente : ""}`,
        et = (k) => (ENC_EST.find((x) => x[0] === (k || "porpedir")) || ENC_EST[0])[1];
      if (!prev) logAccion("Encargo creado", n2 + (doc.precio ? " · " + pesos(doc.precio) : ""));
      else {
        const c = [];
        if ((prev.estado || "porpedir") !== doc.estado)
          c.push(`estado ${et(prev.estado)} → ${et(doc.estado)}`);
        if ((+prev.precio || 0) !== (+doc.precio || 0))
          c.push(`precio ${pesos(prev.precio || 0)} → ${pesos(doc.precio)}`);
        const pp = (prev.pagos || []).length,
          np = (doc.pagos || []).length;
        if (np > pp)
          c.push(
            "pago " +
              doc.pagos
                .slice(pp)
                .map((x) => pesos(x.monto) + " " + (x.metodo || ""))
                .join(", "),
          );
        else if (np < pp) c.push("pago quitado");
        if (
          ["descripcion", "cliente", "proveedor"].some(
            (k) => String(prev[k] || "") !== String(doc[k] || ""),
          )
        )
          c.push("datos editados");
        if (c.length) logAccion("Encargo modificado", n2 + " · " + c.join("; "));
      }
    }
    if (esAdmin && $("enc-costo").value !== "")
      await db
        .collection("costos")
        .doc("enc-" + id)
        .set({ repuesto: Math.round(+$("enc-costo").value || 0) });
    encSel = id;
    encNuevas = [];
    encBorrar.forEach((f) => borrarFoto(f));
    encBorrar = [];
    m.textContent = `Encargo #${num} guardado.`;
    $("enc-tit").textContent = `Encargo #${num}`;
    if (cerrarForm) encVista(false);
    return true;
  } catch (e) {
    m.textContent = "No se pudo guardar. Revise la conexión e intente otra vez.";
    return false;
  }
}
$("btn-enc").onclick = () => {
  $("fondo").hidden = false;
  $("enc").hidden = false;
  encVista(false);
  pintarEnc();
};
$("enc-cerrar").onclick = cerrar;
$("enc-nuevo").onclick = () => abrirEnc(null);
$("enc-buscar").oninput = pintarEnc;
$("enc-volver").onclick = () => {
  descartarEncNuevas();
  encVista(false);
  pintarEnc();
};
$("enc-f").onsubmit = (ev) => {
  ev.preventDefault();
  guardarEnc(true);
};
$("enc-f").addEventListener("input", (ev) => {
  if (ev.target.id === "enc-precio") $("enc-saldo").textContent = pesos(encSaldo());
  actualizarWAEnc();
});
$("enc-pagar-todo").onclick = () => {
  const s = encSaldo();
  if (s > 0) $("enc-pmonto").value = s;
  else $("enc-msg").textContent = "No hay saldo por cobrar. Revise que el precio esté escrito.";
};
$("enc-pagar").onclick = async () => {
  const m = $("enc-msg"),
    monto = Math.round(+$("enc-pmonto").value || 0),
    pr = Math.round(+$("enc-precio").value || 0);
  if (!pr) {
    m.textContent = "Escriba primero el precio del encargo.";
    $("enc-precio").focus();
    return;
  }
  if (monto <= 0) {
    m.textContent = "Escriba cuánto recibe.";
    $("enc-pmonto").focus();
    return;
  }
  if (monto > encSaldo()) {
    m.textContent = `El pago es mayor al saldo (${pesos(encSaldo())}).`;
    return;
  }
  encPagos.push({
    fecha: new Date().toISOString(),
    monto,
    metodo: $("enc-pmetodo").value || "Efectivo",
    quien: (sesion && sesion.nombre) || "",
  });
  if (await guardarEnc(false)) {
    m.textContent = `Pago de ${pesos(monto)} registrado. Quedó en la caja de hoy.`;
  } else encPagos.pop();
  pintarEncPagos();
};
$("enc-borrar").onclick = async () => {
  const b = $("enc-borrar");
  if (!b.dataset.ok) {
    b.dataset.ok = "1";
    b.textContent = "¿Seguro? Eliminar";
    return;
  }
  try {
    const e = encargos.find((x) => x.id === encSel),
      id = encSel,
      copia = JSON.parse(JSON.stringify(e || {})),
      cr = costos["enc-" + id];
    delete copia.id;
    await db.doc("encargos/" + id).delete();
    if (esAdmin)
      db.collection("costos")
        .doc("enc-" + id)
        .delete()
        .catch(() => {});
    logAccion(
      "Encargo eliminado",
      "#" + (e ? e.num + " " + String(e.descripcion || "").slice(0, 50) : ""),
    );
    ofrecerDeshacer(
      "Encargo #" + (e ? e.num : "") + " eliminado",
      async () => {
        await db.doc("encargos/" + id).set(copia);
        if (esAdmin && cr !== undefined)
          await db
            .collection("costos")
            .doc("enc-" + id)
            .set({ repuesto: cr });
      },
      () => {
        if (e && Array.isArray(e.fotos)) e.fotos.forEach((f) => borrarFoto(f));
      },
    );
    encSel = null;
    encVista(false);
    pintarEnc();
  } catch (e) {
    $("enc-msg").textContent = "No se pudo eliminar.";
  }
};
