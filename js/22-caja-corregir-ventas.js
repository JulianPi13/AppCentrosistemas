// ---- caja: corregir o eliminar ventas de mostrador (solo administrador) ----
let vEd = null;
async function devolverStock(dif) {
  for (const [pid, n] of Object.entries(dif)) {
    if (!n) continue;
    try {
      const pr = db.doc("productos/" + pid),
        ps = await pr.get();
      if (ps.exists) await pr.update({ stock: Math.max(0, (+ps.data().stock || 0) + n) });
    } catch (e) {}
  }
}
async function eliminarVenta(dia, v, msgId) {
  const m = $(msgId || "caja-msg");
  if (!esAdmin) return;
  m.textContent = "Eliminando la venta…";
  try {
    await cambiarDia(
      db.doc("ventas/" + dia),
      (items) => items.filter((x) => x.id !== v.id),
      (items) => !items.some((x) => x.id === v.id),
    );
    const dif = {};
    (v.lineas || []).forEach((l) => {
      if (l.pid) dif[l.pid] = (dif[l.pid] || 0) + (+l.cant || 0);
    });
    await devolverStock(dif);
    m.textContent =
      "Venta eliminada. Los productos volvieron al inventario." +
      (cajaDocs[dia] && cajaDocs[dia].cierre
        ? " Esa caja ya estaba cerrada: el reporte cambia."
        : "");
    const copia = JSON.parse(JSON.stringify(v));
    logAccion("Venta eliminada", pesos(v.total) + " · " + resumenVenta(v));
    ofrecerDeshacer("Venta de " + pesos(v.total) + " eliminada", async () => {
      await cambiarDia(
        db.doc("ventas/" + dia),
        (items) =>
          items.some((x) => x.id === copia.id)
            ? items
            : items.concat([copia]).sort((p, q) => String(p.hora).localeCompare(String(q.hora))),
        (items) => items.some((x) => x.id === copia.id),
      );
      const d2 = {};
      (copia.lineas || []).forEach((l) => {
        if (l.pid) d2[l.pid] = (d2[l.pid] || 0) - (+l.cant || 0);
      });
      await devolverStock(d2);
    });
  } catch (e) {
    m.textContent = "No se pudo eliminar la venta.";
  }
}
function totEdVenta() {
  $("c-vedit-tot").textContent = pesos(
    vEd.lineas.reduce((t, l) => t + (+l.cant || 0) * (+l.precio || 0), 0),
  );
}
function pintarEdVenta() {
  const z = $("c-vedit-lin");
  z.innerHTML = "";
  vEd.lineas.forEach((l, i) => {
    const d = document.createElement("div");
    d.style.cssText =
      "display:grid;grid-template-columns:1fr 64px 96px auto;gap:6px;align-items:center";
    d.innerHTML =
      '<span style="min-width:0;overflow-wrap:anywhere"></span><input type="number" min="1" step="1" inputmode="numeric" aria-label="Cantidad"><input type="number" min="0" step="500" inputmode="numeric" aria-label="Precio de cada uno"><button type="button">Quitar</button>';
    d.querySelector("span").textContent = l.nombre;
    const [ic, ip] = d.querySelectorAll("input");
    ic.value = l.cant;
    ip.value = l.precio;
    ic.oninput = () => {
      l.cant = Math.max(1, Math.round(+ic.value || 1));
      totEdVenta();
    };
    ip.oninput = () => {
      l.precio = Math.max(0, Math.round(+ip.value || 0));
      totEdVenta();
    };
    d.querySelector("button").onclick = () => {
      vEd.lineas.splice(i, 1);
      pintarEdVenta();
    };
    z.appendChild(d);
  });
  totEdVenta();
}
function abrirEdVenta(dia, v) {
  vEd = {
    dia,
    v,
    orig: (v.lineas || []).map((l) => ({ ...l })),
    lineas: (v.lineas || []).map((l) => ({ ...l })),
  };
  const ms = METODOS.includes(v.metodo) || !v.metodo ? METODOS : [...METODOS, v.metodo];
  $("c-vedit-met").innerHTML = ms
    .map((x) => `<option${x === (v.metodo || "Efectivo") ? " selected" : ""}>${esc(x)}</option>`)
    .join("");
  $("c-vedit").hidden = false;
  pintarEdVenta();
  $("c-vedit").scrollIntoView({ block: "center", behavior: "smooth" });
}
$("c-vedit-no").onclick = () => {
  vEd = null;
  $("c-vedit").hidden = true;
};
$("c-vedit-ok").onclick = async () => {
  if (!vEd || !esAdmin) return;
  const m = $("caja-msg");
  if (!vEd.lineas.length) {
    m.textContent = "Debe quedar al menos un producto. Para borrar toda la venta use Eliminar.";
    return;
  }
  const total = vEd.lineas.reduce((t, l) => t + (+l.cant || 0) * (+l.precio || 0), 0),
    metodo = $("c-vedit-met").value,
    ahora = new Date().toISOString();
  const nuevo = {
    ...vEd.v,
    lineas: vEd.lineas,
    total,
    metodo,
    editadaPor: sesion ? sesion.nombre : "",
    editadaEn: ahora,
  };
  if (metodo === "Efectivo" && nuevo.recibe && nuevo.recibe >= total)
    nuevo.cambio = nuevo.recibe - total;
  else {
    delete nuevo.recibe;
    delete nuevo.cambio;
  }
  m.textContent = "Guardando…";
  const dia = vEd.dia,
    orig = vEd.orig,
    lin = vEd.lineas;
  try {
    await cambiarDia(
      db.doc("ventas/" + dia),
      (items) => items.map((x) => (x.id === nuevo.id ? nuevo : x)),
      (items) => items.some((x) => x.id === nuevo.id && x.editadaEn === ahora),
    );
    const dif = {};
    orig.forEach((l) => {
      if (l.pid) dif[l.pid] = (dif[l.pid] || 0) + (+l.cant || 0);
    });
    lin.forEach((l) => {
      if (l.pid) dif[l.pid] = (dif[l.pid] || 0) - (+l.cant || 0);
    });
    await devolverStock(dif);
    logAccion(
      "Venta corregida",
      `${pesos(vEd.v.total)} → ${pesos(total)} · ${metodo} · ${resumenVenta(nuevo)}`,
    );
    vEd = null;
    $("c-vedit").hidden = true;
    m.textContent =
      "Venta corregida." +
      (cajaDocs[dia] && cajaDocs[dia].cierre
        ? " Esa caja ya estaba cerrada: el reporte cambia."
        : "");
  } catch (e) {
    m.textContent = "No se pudo guardar la corrección.";
  }
};
