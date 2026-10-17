// ---- ventas de mostrador ----
const CATS = [
  "Cargadores",
  "Cables",
  "Memorias",
  "Manos libres",
  "Parlantes",
  "Forros",
  "Vidrios",
  "Baterías",
  "Accesorios",
  "Otros",
];
let productos = [],
  ventasDia = {},
  carrito = [],
  posCat = "",
  posEditar = false,
  pfId = null,
  ultimaVenta = null;
$("pf-cat").innerHTML = CATS.map((c) => `<option>${c}</option>`).join("");
const resumenVenta = (v) =>
  (v.lineas || []).map((x) => (x.cant > 1 ? x.cant + " × " : "") + x.nombre).join(", ");
function abrirPos() {
  cerrar();
  $("fondo").hidden = false;
  $("pos").hidden = false;
  $("pos-form").hidden = true;
  $("pos-libre-f").hidden = true;
  $("pos-msg").textContent = "";
  $("pos-nuevo").hidden = !esAdmin;
  $("pos-modo").hidden = !esAdmin;
  $("pos-libre").hidden = !esAdmin;
  $("pos-excel").hidden = !esAdmin;
  if (!esAdmin && posEditar) {
    posEditar = false;
  }
  pintarPos();
  pintarCarrito();
  pintarVentasHoy();
}
$("btn-pos").onclick = abrirPos;
$("pos-cerrar").onclick = cerrar;
function pintarPos() {
  const c = $("pos-cats");
  c.innerHTML = "";
  ["", ...CATS].forEach((k) => {
    if (k && !productos.some((p) => p.cat === k)) return;
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = k || "Todo";
    b.setAttribute("aria-pressed", String(posCat === k));
    b.onclick = () => {
      posCat = k;
      pintarPos();
    };
    c.appendChild(b);
  });
  const q = $("pos-buscar").value.trim().toLowerCase(),
    g = $("pos-prods");
  g.innerHTML = "";
  const v = productos
    .filter(
      (p) =>
        (!posCat || p.cat === posCat) && (!q || (p.nombre + " " + p.cat).toLowerCase().includes(q)),
    )
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
  if (!productos.length) {
    g.innerHTML =
      '<p class="aviso" style="margin:0;grid-column:1/-1">Todavía no hay productos. ' +
      (esAdmin
        ? "Toque <b>+ Producto nuevo</b> o <b>Cargar productos desde Excel</b>."
        : "El administrador debe registrar los productos.") +
      "</p>";
    return;
  }
  if (!v.length) {
    g.innerHTML =
      '<p class="aviso" style="margin:0;grid-column:1/-1">No hay productos que coincidan.</p>';
    return;
  }
  v.forEach((p) => {
    const st = +p.stock || 0,
      enCar = (carrito.find((x) => x.pid === p.id) || {}).cant || 0;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "prod" + (st - enCar <= 0 ? " agotado" : "") + (posEditar ? " editar" : "");
    b.innerHTML = '<span class="pn"></span><span class="pp"></span><small></small>';
    if (p.foto) {
      const im = document.createElement("img");
      im.className = "pimg";
      im.alt = "";
      ponerSrc(im, p.foto);
      b.prepend(im);
    }
    b.querySelector(".pn").textContent = p.nombre;
    b.querySelector(".pp").textContent = pesos(p.precio);
    b.querySelector("small").textContent =
      (posEditar ? "Toque para editar · " : "") +
      (st <= 0 ? "Agotado" : `Quedan ${st}`) +
      (esAdmin && costos["prod-" + p.id] ? ` · costo ${pesos(costos["prod-" + p.id])}` : "");
    b.onclick = () => (posEditar ? editarProd(p) : agregar(p));
    g.appendChild(b);
  });
}
$("pos-buscar").oninput = pintarPos;
function agregar(p) {
  const l = carrito.find((x) => x.pid === p.id),
    st = +p.stock || 0,
    ya = l ? l.cant : 0;
  if (ya >= st) {
    $("pos-msg").textContent =
      `No hay más "${p.nombre}" en existencia.` +
      (esAdmin ? " Actualice la cantidad en Editar productos." : " Avísele al administrador.");
    return;
  }
  if (l) l.cant++;
  else carrito.push({ pid: p.id, nombre: p.nombre, precio: +p.precio || 0, cant: 1 });
  $("pos-msg").textContent = "";
  pintarCarrito();
  pintarPos();
}
function pintarCarrito() {
  const c = $("car-lineas");
  c.innerHTML = "";
  if (!carrito.length)
    c.innerHTML =
      '<p class="aviso" style="margin:0">Toque un producto para agregarlo a la venta.</p>';
  carrito.forEach((l, i) => {
    const d = document.createElement("div");
    d.className = "car-l";
    d.innerHTML =
      '<span></span><div class="cant"><button type="button" aria-label="Quitar uno">−</button><output></output><button type="button" aria-label="Agregar uno">+</button></div><b></b>';
    d.querySelector("span").textContent = l.nombre + " · " + pesos(l.precio);
    d.querySelector("output").textContent = l.cant;
    d.querySelector("b").textContent = pesos(l.cant * l.precio);
    const [menos, mas] = d.querySelectorAll(".cant button");
    menos.onclick = () => {
      l.cant--;
      if (l.cant <= 0) carrito.splice(i, 1);
      pintarCarrito();
      pintarPos();
    };
    mas.onclick = () => {
      if (l.pid) {
        const p = productos.find((x) => x.id === l.pid);
        if (p && l.cant >= (+p.stock || 0)) {
          $("pos-msg").textContent = `No hay más "${l.nombre}" en existencia.`;
          return;
        }
      }
      l.cant++;
      pintarCarrito();
      pintarPos();
    };
    c.appendChild(d);
  });
  const tot = carrito.reduce((s, l) => s + l.cant * l.precio, 0),
    n = carrito.reduce((s, l) => s + l.cant, 0);
  $("car-total").textContent = pesos(tot);
  $("car-n").textContent = n ? n + (n === 1 ? " producto" : " productos") : "";
  $("car-vender").disabled = !carrito.length;
  $("car-vender").textContent = carrito.length ? "Vender " + pesos(tot) : "Vender";
  if (!carrito.length) cerrarPago();
  else calcCambio();
}
const METODOS = ["Efectivo", "Transferencia", "Nequi", "Daviplata", "Tarjeta"];
function cerrarPago() {
  $("car-conf").hidden = true;
  $("car-vender").hidden = false;
}
function pintarMetodos() {
  const c = $("car-metodos");
  c.innerHTML = "";
  METODOS.forEach((m) => {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", String($("car-metodo").value === m));
    b.textContent = m;
    b.onclick = () => {
      $("car-metodo").value = m;
      pintarMetodos();
      $("car-efe").hidden = m !== "Efectivo";
      $("car-cobrar").disabled = false;
      $("car-cobrar").textContent = `Confirmar venta en ${m.toLowerCase()}`;
      if (m === "Efectivo") $("car-recibe").focus();
    };
    c.appendChild(b);
  });
}
function calcCambio() {
  const tot = carrito.reduce((s, l) => s + l.cant * l.precio, 0),
    r = +$("car-recibe").value || 0,
    c = $("car-cambio");
  if (!r) {
    c.textContent = "";
    return;
  }
  c.textContent = r >= tot ? `Cambio: ${pesos(r - tot)}` : `Faltan ${pesos(tot - r)}`;
  c.style.color = r >= tot ? "var(--s-listo)" : "#c0392b";
}
$("car-recibe").oninput = calcCambio;
$("car-vender").onclick = () => {
  if (!carrito.length) return;
  if (!cajaAbiertaHoy()) {
    $("pos-msg").textContent = cajaDocs[hoyStr()]
      ? "La caja de hoy está cerrada. Reábrala en Caja diaria para poder vender."
      : "La caja de hoy no se ha abierto. Ábrala en Caja diaria para poder vender.";
    return;
  }
  $("car-metodo").value = "";
  $("car-recibe").value = "";
  $("car-cambio").textContent = "";
  $("car-efe").hidden = true;
  $("car-cobrar").disabled = true;
  $("car-cobrar").textContent = "Escoja la forma de pago";
  pintarMetodos();
  $("car-conf").hidden = false;
  $("car-vender").hidden = true;
  $("pos-msg").textContent = "";
};
$("car-volver").onclick = cerrarPago;
// guarda sin esperar candados: lee, escribe y verifica (reintenta si otra venta se cruzó)
async function conLease(ref, fn) {
  return await fn();
}
async function cambiarDia(ref, cambio, esta) {
  for (let i = 0; i < 4; i++) {
    const s = await ref.get();
    const items = s.exists && Array.isArray(s.data().items) ? s.data().items : [];
    await ref.set({ items: cambio(items) });
    const v = await ref.get();
    const it = v.exists && Array.isArray(v.data().items) ? v.data().items : [];
    if (esta(it)) return;
    await new Promise((ok) => setTimeout(ok, 200 + Math.random() * 300));
  }
  throw { code: "unavailable" };
}
$("car-cobrar").onclick = async () => {
  if (!carrito.length) return;
  if (!$("car-metodo").value) {
    $("pos-msg").textContent = "Escoja cómo paga el cliente.";
    return;
  }
  {
    const tot = carrito.reduce((s, l) => s + l.cant * l.precio, 0),
      r = +$("car-recibe").value || 0;
    if ($("car-metodo").value === "Efectivo" && r && r < tot) {
      $("pos-msg").textContent = `El efectivo recibido no alcanza: faltan ${pesos(tot - r)}.`;
      return;
    }
  }
  if (!cajaAbiertaHoy()) {
    $("pos-msg").textContent = cajaDocs[hoyStr()]
      ? "La caja de hoy está cerrada. Reábrala en Caja diaria para poder vender."
      : "La caja de hoy no se ha abierto. Ábrala en Caja diaria para poder vender.";
    return;
  }
  const b = $("car-cobrar");
  b.disabled = true;
  b.textContent = "Registrando…";
  $("pos-msg").textContent = "Registrando la venta…";
  const ahora = new Date().toISOString(),
    dia = hoyStr(),
    venta = {
      id: "v" + Date.now().toString(36),
      hora: ahora,
      lineas: carrito.map((l) => ({ ...l })),
      total: carrito.reduce((s, l) => s + l.cant * l.precio, 0),
      metodo: $("car-metodo").value,
      quien: sesion ? sesion.nombre : "",
    };
  if (venta.metodo === "Efectivo" && +$("car-recibe").value) {
    venta.recibe = +$("car-recibe").value;
    venta.cambio = Math.max(0, venta.recibe - venta.total);
  }
  try {
    const ref = db.doc("ventas/" + dia);
    await cambiarDia(
      ref,
      (items) => items.filter((x) => x.id !== venta.id).concat([venta]),
      (items) => items.some((x) => x.id === venta.id),
    );
    Promise.all(
      venta.lineas
        .filter((l) => l.pid)
        .map(async (l) => {
          try {
            const pr = db.doc("productos/" + l.pid),
              ps = await pr.get();
            if (ps.exists) await pr.update({ stock: (+ps.data().stock || 0) - l.cant });
          } catch (e) {}
        }),
    );
    logAccion(
      "Venta de mostrador",
      `${pesos(venta.total)} · ${venta.metodo} · ${resumenVenta(venta)}`,
    );
    ultimaVenta = venta;
    carrito = [];
    pintarCarrito();
    pintarPos();
    $("pos-msg").innerHTML = "";
    $("pos-msg").append(
      `Venta registrada: ${pesos(venta.total)} (${venta.metodo}). Ya está sumada en la caja diaria. `,
    );
    if (venta.cambio) $("pos-msg").append(`Cambio: ${pesos(venta.cambio)}. `);
    cerrarPago();
    if (dl && window.jspdf) {
      const r = document.createElement("button");
      r.type = "button";
      r.textContent = "Volver a sacar el recibo";
      r.style.cssText = "padding:3px 10px;margin-left:4px";
      r.onclick = () => reciboVenta(venta);
      $("pos-msg").appendChild(r);
      reciboVenta(venta);
    }
  } catch (e) {
    $("pos-msg").textContent =
      e && e.code === "invalid_argument"
        ? "Esta cuenta no tiene permiso para registrar ventas."
        : "No se pudo registrar la venta. Revise la conexión e intente otra vez.";
  }
  b.disabled = false;
  if ($("car-metodo").value)
    b.textContent = `Confirmar venta en ${$("car-metodo").value.toLowerCase()}`;
  pintarCarrito();
};
function pintarVentasHoy() {
  const dia = hoyStr(),
    l = (ventasDia[dia] || []).slice().reverse(),
    c = $("pos-hoy");
  c.innerHTML = "";
  const tot = l.filter((v) => !v.anulada).reduce((s, v) => s + (+v.total || 0), 0);
  $("pos-hoy-t").textContent = `Ventas de hoy · ${pesos(tot)}`;
  if (!l.length) {
    c.innerHTML = '<p class="aviso" style="margin:0">Todavía no hay ventas hoy.</p>';
    return;
  }
  l.forEach((v) => {
    const d = document.createElement("div");
    d.className = "mov";
    d.innerHTML = "<span></span><b></b><small></small>";
    d.querySelector("span").textContent = resumenVenta(v);
    d.querySelector("b").textContent = v.anulada ? "Anulada" : pesos(v.total);
    if (v.anulada) d.querySelector("b").className = "neg";
    const sm = d.querySelector("small");
    sm.textContent = [hora(v.hora), v.metodo, v.quien].filter(Boolean).join(" · ") + " ";
    if (dl && window.jspdf && !v.anulada) {
      const r = document.createElement("button");
      r.type = "button";
      r.textContent = "Recibo";
      r.style.cssText = "padding:2px 8px;font-size:.78rem";
      r.onclick = () => reciboVenta(v);
      sm.appendChild(r);
    }
    if (esAdmin && !v.anulada) {
      const e1 = document.createElement("button");
      e1.type = "button";
      e1.textContent = "Editar";
      e1.style.cssText = "padding:2px 8px;font-size:.78rem;margin-left:4px";
      e1.onclick = () => {
        cerrar();
        $("fondo").hidden = false;
        $("caja").hidden = false;
        $("c-fecha").value = dia;
        $("caja-msg").textContent = "";
        pintarCaja();
        abrirEdVenta(dia, v);
      };
      sm.appendChild(e1);
      const e2 = document.createElement("button");
      e2.type = "button";
      e2.className = "btn-danger";
      e2.textContent = "Eliminar";
      e2.style.cssText = "padding:2px 8px;font-size:.78rem;margin-left:4px";
      e2.onclick = async () => {
        if (!e2.dataset.ok) {
          e2.dataset.ok = "1";
          e2.textContent = "¿Seguro? Eliminar";
          return;
        }
        eliminarVenta(dia, v, "pos-msg");
      };
      sm.appendChild(e2);
    }
    if (esAdmin && !v.anulada) {
      const a = document.createElement("button");
      a.type = "button";
      a.className = "btn-danger";
      a.textContent = "Anular";
      a.style.cssText = "padding:2px 8px;font-size:.78rem;margin-left:4px";
      a.onclick = async () => {
        if (!a.dataset.ok) {
          a.dataset.ok = "1";
          a.textContent = "¿Seguro? Anular";
          return;
        }
        try {
          const ref = db.doc("ventas/" + dia);
          await cambiarDia(
            ref,
            (items) =>
              items.map((x) =>
                x.id === v.id
                  ? { ...x, anulada: true, anuladaPor: sesion ? sesion.nombre : "" }
                  : x,
              ),
            (items) => items.some((x) => x.id === v.id && x.anulada),
          );
          for (const x of v.lineas || []) {
            if (!x.pid) continue;
            try {
              const pr = db.doc("productos/" + x.pid),
                ps = await pr.get();
              if (ps.exists) await pr.update({ stock: (+ps.data().stock || 0) + x.cant });
            } catch (e) {}
          }
          {
            const orig = JSON.parse(JSON.stringify(v));
            logAccion("Venta anulada", pesos(v.total) + " · " + resumenVenta(v));
            ofrecerDeshacer("Venta de " + pesos(v.total) + " anulada", async () => {
              await cambiarDia(
                db.doc("ventas/" + dia),
                (items) => items.map((x) => (x.id === orig.id ? orig : x)),
                (items) => items.some((x) => x.id === orig.id && !x.anulada),
              );
              const d2 = {};
              (orig.lineas || []).forEach((l) => {
                if (l.pid) d2[l.pid] = (d2[l.pid] || 0) - (+l.cant || 0);
              });
              await devolverStock(d2);
            });
          }
        } catch (e) {
          $("pos-msg").textContent = "No se pudo anular la venta.";
        }
      };
      sm.appendChild(a);
    }
    c.appendChild(d);
  });
}
function reciboVenta(v) {
  const ancho = +$("papel").value || 58,
    L = [],
    sep = () => L.push({ sep: 1 }),
    t = (x, s, o = {}) => L.push({ txt: String(x), size: s, ...o });
  if (logoRecibo && IMP.logo) L.push({ img: 1 });
  else t(IMP.nombre, 14, { b: 1, c: 1 });
  sep();
  t("RECIBO DE VENTA", ancho > 60 ? 13 : 11.5, { b: 1, c: 1 });
  t(
    new Date(v.hora).toLocaleString("es-CO", {
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
  (v.lineas || []).forEach((x) => {
    t(x.nombre, 8.5);
    t(`  ${x.cant} × ${pesos(x.precio)} = ${pesos(x.cant * x.precio)}`, 8.3);
  });
  sep();
  t("TOTAL: " + pesos(v.total), 11, { b: 1 });
  t("Forma de pago: " + (v.metodo || "Efectivo"), 8.3);
  if (v.recibe) {
    t("Recibido: " + pesos(v.recibe), 8.3);
    t("Cambio: " + pesos(v.cambio || 0), 8.3);
  }
  if (v.quien) t("Atendió: " + v.quien, 8.3);
  sep();
  t(
    "Los accesorios tienen garantía por defecto de fábrica. Presente este recibo para cualquier reclamo.",
    7.3,
    { c: 1 },
  );
  L.push({ gap: 2 });
  t("¡Gracias por su compra!", 8.5, { b: 1, c: 1 });
  dl.save({ filename: `recibo-venta-${v.id}.pdf`, data: pintarRecibo(L, ancho) }).catch(() => {});
}
// productos (crear / editar)
$("pos-modo").onclick = () => {
  posEditar = !posEditar;
  $("pos-modo").setAttribute("aria-pressed", String(posEditar));
  $("pos-modo").textContent = posEditar ? "Terminar de editar" : "Editar productos";
  pintarPos();
};
function editarProd(p) {
  pfId = p ? p.id : null;
  $("pos-form").hidden = false;
  $("pos-libre-f").hidden = true;
  $("pf-tit").textContent = p ? "Editar producto" : "Producto nuevo";
  $("pf-nombre").value = p ? p.nombre : "";
  $("pf-cat").value = p ? p.cat : posCat || "Cargadores";
  $("pf-precio").value = p ? p.precio || "" : "";
  $("pf-stock").value = p ? +p.stock || 0 : "";
  $("pf-stock-l").textContent = p
    ? "Cantidad en existencia (corríjala si llegó más)"
    : "Cantidad en existencia";
  $("pf-costo-c").hidden = !esAdmin;
  $("pf-costo").value = p && esAdmin ? costos["prod-" + p.id] || "" : "";
  $("pf-borrar").hidden = !(p && esAdmin);
  delete $("pf-borrar").dataset.ok;
  $("pf-borrar").textContent = "Quitar producto";
  $("pos-form").scrollIntoView({ block: "center", behavior: "smooth" });
  $("pf-nombre").focus();
}
$("pos-nuevo").onclick = () => editarProd(null);
$("pf-cancelar").onclick = () => {
  $("pos-form").hidden = true;
};
$("pos-form").onsubmit = async (ev) => {
  ev.preventDefault();
  const nombre = $("pf-nombre").value.trim(),
    precio = Math.round(+$("pf-precio").value || 0),
    stock = Math.round(+$("pf-stock").value || 0);
  if (!nombre) {
    $("pos-msg").textContent = "Escriba el nombre del producto.";
    return;
  }
  if (!precio) {
    $("pos-msg").textContent = "Escriba el precio de venta.";
    return;
  }
  const id = pfId || "p" + Date.now().toString(36);
  try {
    await db.doc("productos/" + id).set({
      ...(() => {
        const e = productos.find((x) => x.id === id),
          b = { ...(e || {}) };
        delete b.id;
        return b;
      })(),
      nombre,
      cat: $("pf-cat").value,
      precio,
      stock,
      actualizado: new Date().toISOString(),
    });
    if (esAdmin && $("pf-costo").value !== "")
      await db.doc("costos/prod-" + id).set({ repuesto: Math.round(+$("pf-costo").value || 0) });
    logAccion(
      pfId ? "Producto editado" : "Producto creado",
      `${nombre} · ${pesos(precio)} · cantidad ${stock}`,
    );
    $("pos-form").hidden = true;
    $("pos-msg").textContent = `Producto guardado: ${nombre}.`;
  } catch (e) {
    $("pos-msg").textContent =
      e && e.code === "invalid_argument"
        ? "Esta cuenta no tiene permiso para editar productos."
        : "No se pudo guardar el producto.";
  }
};
$("pf-borrar").onclick = async () => {
  const b = $("pf-borrar");
  if (!b.dataset.ok) {
    b.dataset.ok = "1";
    b.textContent = "¿Seguro? Quitar";
    return;
  }
  try {
    const p0 = productos.find((x) => x.id === pfId);
    await borrarConDeshacer("productos", pfId, p0 || {}, "Producto " + ((p0 && p0.nombre) || ""));
    $("pos-form").hidden = true;
  } catch (e) {
    $("pos-msg").textContent = "No se pudo quitar.";
  }
};
// venta rápida
$("pos-libre").onclick = () => {
  $("pos-libre-f").hidden = false;
  $("pos-form").hidden = true;
  $("pl-nombre").value = "";
  $("pl-precio").value = "";
  $("pl-cant").value = 1;
  $("pos-libre-f").scrollIntoView({ block: "center", behavior: "smooth" });
  $("pl-nombre").focus();
};
$("pl-cancelar").onclick = () => {
  $("pos-libre-f").hidden = true;
};
$("pos-libre-f").onsubmit = (ev) => {
  ev.preventDefault();
  const n = $("pl-nombre").value.trim(),
    p = Math.round(+$("pl-precio").value || 0),
    c = Math.max(1, Math.round(+$("pl-cant").value || 1));
  if (!n || !p) {
    $("pos-msg").textContent = "Escriba qué vende y el precio.";
    return;
  }
  carrito.push({ pid: "", nombre: n, precio: p, cant: c });
  $("pos-libre-f").hidden = true;
  pintarCarrito();
  $("carrito").scrollIntoView({ block: "start", behavior: "smooth" });
};
