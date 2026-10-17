// ---- caja diaria ----
let gastos = {};
const pad = (n) => String(n).padStart(2, "0");
const diaDe = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
};
const hoyStr = () => diaDe(new Date().toISOString());
const hora = (iso) =>
  new Date(iso).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });
function pagosDe(o) {
  if (Array.isArray(o.pagos)) return o.pagos.slice();
  return (+o.abono || 0) > 0 ? [{ fecha: o.ingreso, monto: +o.abono, quien: "" }] : [];
}
function tile(t, v, cl) {
  return `<div class="tile ${cl || ""}"><small>${t}</small><b>${v}</b></div>`;
}
function resumen(pref) {
  const pg = [];
  ordenes.forEach((o) =>
    pagosDe(o).forEach((p) => {
      if (diaDe(p.fecha).startsWith(pref)) pg.push({ ...p, o });
    }),
  );
  let vtot = 0,
    ganV = 0,
    vn = 0;
  Object.entries(ventasDia).forEach(([d, l]) => {
    if (!d.startsWith(pref)) return;
    l.forEach((v) => {
      if (v.anulada) return;
      vn++;
      vtot += +v.total || 0;
      ganV += (v.lineas || []).reduce(
        (s, x) =>
          s + (+x.cant || 0) * ((+x.precio || 0) - (x.pid ? costos["prod-" + x.pid] || 0 : 0)),
        0,
      );
      pg.push({
        fecha: v.hora,
        monto: +v.total || 0,
        metodo: v.metodo,
        quien: v.quien,
        venta: v,
        dia: d,
        o: { num: "", cliente: "" },
      });
    });
  });
  encargos.forEach((e) =>
    (Array.isArray(e.pagos) ? e.pagos : []).forEach((p) => {
      if (diaDe(p.fecha).startsWith(pref)) pg.push({ ...p, enc: e, o: { num: "", cliente: "" } });
    }),
  );
  const ganE = Math.round(
    pg.reduce((s, p) => {
      const e = p.enc;
      if (!e || !(+e.precio > 0)) return s;
      const cs = costos["enc-" + e.id];
      if (cs === undefined) return s;
      return s + (+p.monto || 0) * ((+e.precio - cs) / +e.precio);
    }, 0),
  );
  const ing = pg.reduce((s, p) => s + (+p.monto || 0), 0);
  const ent = ordenes.filter((o) => diaDe(o.entregado).startsWith(pref));
  const gan = ent.reduce((s, o) => s + (+o.precio || 0) - (costos[o.id] || 0), 0);
  let gs = [];
  Object.entries(gastos).forEach(([d, l]) => {
    if (d.startsWith(pref)) gs = gs.concat(l.map((g) => ({ ...g, dia: d })));
  });
  const gas = gs.reduce((s, g) => s + (+g.valor || 0), 0);
  let sal = [];
  Object.entries(salidasDia).forEach(([d, l]) => {
    if (d.startsWith(pref)) sal = sal.concat(l.map((x) => ({ ...x, dia: d })));
  });
  const salTot = sal.reduce((s, x) => s + (+x.valor || 0), 0);
  return {
    pg,
    ing,
    ent,
    gan,
    ganE,
    gs,
    gas,
    vtot,
    ganV,
    vn,
    sal,
    salTot,
    rec: ordenes.filter((o) => diaDe(o.ingreso).startsWith(pref)),
    lis: ordenes.filter((o) => diaDe(o.listoEn).startsWith(pref)),
  };
}
function pintarCaja() {
  if (!$("c-fecha").value) $("c-fecha").value = hoyStr();
  const dia = $("c-fecha").value,
    r = resumen(dia);
  pintarTurno(dia, r);
  pintarSalidas(dia, r);
  const ventas = r.ent.reduce((s, o) => s + (+o.precio || 0), 0);
  let t =
    tile("Entró hoy", pesos(r.ing)) +
    tile("Reparaciones entregadas", pesos(ventas)) +
    tile("Ventas mostrador", pesos(r.vtot));
  if (esAdmin) {
    const ut = r.gan + r.ganV + r.ganE,
      utn = ut - r.gas - r.salTot;
    t =
      tile("Utilidad del día", pesos(ut), "neto" + (ut < 0 ? " neg" : "")) +
      tile("Utilidad menos gastos", pesos(utn), "neto" + (utn < 0 ? " neg" : "")) +
      t;
    t += tile("Gastos", pesos(r.gas + r.salTot));
    t += tile(
      "Queda",
      pesos(r.ing - r.gas - r.salTot),
      "neto" + (r.ing - r.gas - r.salTot < 0 ? " neg" : ""),
    );
    t +=
      tile("Utilidad reparaciones", pesos(r.gan)) +
      tile("Utilidad ventas", pesos(r.ganV)) +
      tile("Utilidad encargos", pesos(r.ganE));
  }
  t +=
    tile("Recibidos", r.rec.length) +
    tile("Reparados", r.lis.length) +
    tile("Entregados", r.ent.length);
  $("c-tiles").innerHTML = t;
  const cp = $("c-pagos");
  cp.innerHTML = "";
  if (!r.pg.length) cp.innerHTML = '<p class="aviso" style="margin:0">No entró plata este día.</p>';
  r.pg
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .forEach((p) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "mov";
      b.innerHTML = "<span></span><b></b><small></small>";
      if (p.enc) {
        b.querySelector("span").textContent =
          "Encargo #" + p.enc.num + ": " + String(p.enc.descripcion || "").slice(0, 50);
        b.querySelector("b").textContent = pesos(p.monto);
        b.querySelector("small").textContent = [hora(p.fecha), p.metodo, "encargo", p.quien]
          .filter(Boolean)
          .join(" · ");
        b.onclick = () => {
          cerrar();
          $("fondo").hidden = false;
          $("enc").hidden = false;
          abrirEnc(p.enc.id);
        };
        cp.appendChild(b);
        return;
      }
      if (p.venta) {
        const d = document.createElement("div");
        d.className = "mov";
        d.innerHTML = "<span></span><b></b><small></small>";
        d.querySelector("span").textContent = "Venta: " + resumenVenta(p.venta);
        d.querySelector("b").textContent = pesos(p.monto);
        const sm = d.querySelector("small");
        sm.textContent =
          [hora(p.fecha), p.metodo, p.quien, p.venta.editadaPor ? "corregida" : ""]
            .filter(Boolean)
            .join(" · ") + " ";
        if (esAdmin) {
          const e1 = document.createElement("button");
          e1.type = "button";
          e1.textContent = "Editar";
          e1.style.cssText = "padding:2px 8px;font-size:.78rem;margin-left:4px";
          e1.onclick = () => abrirEdVenta(p.dia, p.venta);
          sm.appendChild(e1);
          const e2 = document.createElement("button");
          e2.type = "button";
          e2.className = "btn-danger";
          e2.textContent = "Eliminar";
          e2.style.cssText = "padding:2px 8px;font-size:.78rem;margin-left:4px";
          e2.onclick = () => {
            if (!e2.dataset.ok) {
              e2.dataset.ok = "1";
              e2.textContent = "¿Seguro? Eliminar";
              return;
            }
            eliminarVenta(p.dia, p.venta);
          };
          sm.appendChild(e2);
        }
        cp.appendChild(d);
        return;
      }
      b.querySelector("span").textContent =
        `#${p.o.num} · ${p.o.cliente || ""} · ${[p.o.marca, p.o.modelo].filter(Boolean).join(" ")}`;
      b.querySelector("b").textContent = pesos(p.monto);
      if (p.monto < 0) b.querySelector("b").className = "neg";
      b.querySelector("small").textContent = [
        hora(p.fecha),
        p.metodo,
        p.monto < 0
          ? "devolución"
          : (+p.o.abono || 0) >= (+p.o.precio || 0) && p === pagosDe(p.o).slice(-1)[0]
            ? "pago final"
            : "abono",
        p.quien,
      ]
        .filter(Boolean)
        .join(" · ");
      b.onclick = () => {
        cerrar();
        abrir(p.o);
      };
      cp.appendChild(b);
    });
  $("c-gastos-g").hidden = !esAdmin;
  if (esAdmin) {
    const cg = $("c-gastos");
    cg.innerHTML = "";
    const l = gastos[dia] || [];
    if (!l.length)
      cg.innerHTML = '<p class="aviso" style="margin:0">Sin gastos registrados este día.</p>';
    l.forEach((g) => {
      const d = document.createElement("div");
      d.className = "mov";
      d.innerHTML = '<span></span><b class="neg"></b><small></small>';
      d.querySelector("span").textContent = g.concepto;
      d.querySelector("b").textContent = "− " + pesos(g.valor);
      const q = document.createElement("button");
      q.type = "button";
      q.textContent = "Quitar";
      q.style.cssText = "padding:2px 8px;font-size:.78rem;justify-self:start";
      q.onclick = () => {
        if (q.dataset.ok) {
          const antes = l.slice();
          guardarGastos(
            dia,
            l.filter((x) => x.id !== g.id),
          ).then(() => {
            logAccion("Gasto quitado", g.concepto + " · " + pesos(g.valor));
            ofrecerDeshacer("Gasto de " + pesos(g.valor) + " quitado", () =>
              guardarGastos(dia, antes),
            );
          });
        } else {
          q.dataset.ok = "1";
          q.textContent = "¿Seguro? Quitar";
        }
      };
      const sm = d.querySelector("small");
      sm.textContent = g.hora ? hora(g.hora) + " · " : "";
      sm.appendChild(q);
      cg.appendChild(d);
    });
  }
  const cr = $("c-rep");
  cr.innerHTML = "";
  const movs = [
    ...r.rec.map((o) => ({ o, t: "Recibido", f: o.ingreso })),
    ...r.lis.map((o) => ({ o, t: "Reparado", f: o.listoEn })),
    ...r.ent.map((o) => ({ o, t: "Entregado", f: o.entregado })),
  ].sort((a, b) => a.f.localeCompare(b.f));
  if (!movs.length)
    cr.innerHTML = '<p class="aviso" style="margin:0">No hubo movimiento de equipos este día.</p>';
  movs.forEach((m) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "mov";
    b.innerHTML = "<span></span><b></b><small></small>";
    b.querySelector("span").textContent =
      `#${m.o.num} · ${[m.o.marca, m.o.modelo].filter(Boolean).join(" ")} · ${m.o.cliente || ""}`;
    b.querySelector("b").textContent = m.t;
    b.querySelector("small").textContent =
      hora(m.f) + (+m.o.precio ? " · Valor " + pesos(m.o.precio) : "");
    b.onclick = () => {
      cerrar();
      abrir(m.o);
    };
    cr.appendChild(b);
  });
  const mes = dia.slice(0, 7),
    rm = resumen(mes);
  $("c-mes-t").textContent =
    "Resumen de " +
    new Date(dia + "T12:00").toLocaleDateString("es-CO", { month: "long", year: "numeric" });
  let tm =
    tile("Entró en el mes", pesos(rm.ing)) +
    tile("Reparaciones del mes", pesos(rm.ent.reduce((s, o) => s + (+o.precio || 0), 0))) +
    tile("Ventas mostrador", pesos(rm.vtot));
  if (esAdmin)
    tm +=
      tile("Gastos del mes", pesos(rm.gas + rm.salTot)) +
      tile(
        "Queda del mes",
        pesos(rm.ing - rm.gas - rm.salTot),
        "neto" + (rm.ing - rm.gas - rm.salTot < 0 ? " neg" : ""),
      ) +
      tile("Utilidad reparaciones", pesos(rm.gan)) +
      tile("Utilidad ventas", pesos(rm.ganV)) +
      tile("Utilidad encargos", pesos(rm.ganE));
  tm += tile("Entregados", rm.ent.length);
  $("c-mes").innerHTML = tm;
}
async function guardarGastos(dia, items) {
  $("caja-msg").textContent = "Guardando…";
  try {
    await db.doc("privado/g-" + dia).set({ items });
    $("caja-msg").textContent = "";
  } catch (e) {
    $("caja-msg").textContent = "No se pudo guardar el gasto. Revise la conexión.";
  }
}
$("g-agregar").onclick = async () => {
  const c = $("g-concepto").value.trim(),
    v = +$("g-valor").value || 0;
  if (!c || v <= 0) {
    $("caja-msg").textContent = "Escriba el concepto y el valor del gasto.";
    return;
  }
  const dia = $("c-fecha").value;
  await guardarGastos(
    dia,
    (gastos[dia] || []).concat([
      {
        id: "g" + Date.now().toString(36),
        concepto: c,
        valor: v,
        hora: new Date().toISOString(),
        quien: sesion ? sesion.nombre : "",
      },
    ]),
  );
  logAccion("Gasto registrado", `${c} · ${pesos(v)} (${dia})`);
  $("g-concepto").value = "";
  $("g-valor").value = "";
};
const moverDia = (n) => {
  const d = new Date(($("c-fecha").value || hoyStr()) + "T12:00");
  d.setDate(d.getDate() + n);
  $("c-fecha").value = diaDe(d.toISOString());
  pintarCaja();
};
$("c-ant").onclick = () => moverDia(-1);
$("c-sig").onclick = () => moverDia(1);
$("c-hoy").onclick = () => {
  $("c-fecha").value = hoyStr();
  pintarCaja();
};
$("c-fecha").onchange = pintarCaja;
$("btn-caja").onclick = () => {
  $("c-vedit").hidden = true;
  vEd = null;
  $("fondo").hidden = false;
  $("caja").hidden = false;
  $("c-fecha").value = hoyStr();
  $("caja-msg").textContent = "";
  pintarCaja();
};
$("caja-cerrar").onclick = cerrar;
