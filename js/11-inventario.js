// ---- inventario de repuestos ----
const TIPOS = ["Pantalla", "Batería", "Pin de carga", "Tapa", "Cámara", "Flex", "Otro"];
let inv = [],
  invCol = null;
$("i-tipo").innerHTML = TIPOS.map((t) => `<option>${t}</option>`).join("");
const esc = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
const nomItem = (it) =>
  [it.tipo, [it.marca, it.modelo].filter(Boolean).join(" "), it.calidad]
    .filter(Boolean)
    .join(" · ");
const claveItem = (it) =>
  [it.tipo, it.marca, it.modelo, it.calidad]
    .map((s) =>
      String(s || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " "),
    )
    .join("|");
function piezasSelect() {
  const s = $("f-pieza"),
    actual = s.value,
    usado = editando && editando.pieza;
  const ops = inv
    .filter((it) => (+it.cantidad || 0) > 0 || it.id === usado || it.id === actual)
    .sort((a, b) => nomItem(a).localeCompare(nomItem(b)));
  s.innerHTML =
    '<option value="">Ninguno</option>' +
    ops
      .map(
        (it) =>
          `<option value="${esc(it.id)}">${esc(nomItem(it))} (quedan ${+it.cantidad || 0})</option>`,
      )
      .join("");
  s.value = ops.some((o) => o.id === actual) ? actual : "";
}
$("f-pieza").onchange = () => {
  const c = costos["inv-" + $("f-pieza").value];
  if (esAdmin && c && !+$("f-repuesto").value) {
    $("f-repuesto").value = c;
    cuentas();
  }
};
let invVista = "prod",
  ieId = null,
  ieKind = "prod";
function pintarInv() {
  const prod = invVista === "prod";
  $("inv-tab-prod").className = prod ? "btn-main" : "";
  $("inv-tab-rep").className = prod ? "" : "btn-main";
  $("inv-buscar").placeholder = prod
    ? "Buscar producto por nombre o categoría"
    : "Buscar repuesto por tipo, marca o modelo";
  const q = $("inv-buscar").value.trim().toLowerCase(),
    l = $("inv-lista");
  const lista = prod ? productos : inv,
    nom = prod ? (p) => p.nombre || "" : nomItem,
    cat = prod ? (p) => p.cat || "Otros" : (it) => it.tipo || "Otro",
    orden = prod ? CATS : TIPOS,
    num = prod ? (p) => +p.stock || 0 : (it) => +it.cantidad || 0;
  const v = lista.filter((it) => !q || (nom(it) + " " + cat(it)).toLowerCase().includes(q));
  l.innerHTML = "";
  if (!lista.length)
    l.innerHTML = prod
      ? '<div class="vacio">Todavía no hay productos de venta.' +
        (esAdmin ? " Toque <b>+ Producto de venta</b>, Excel o foto y voz." : "") +
        "</div>"
      : '<div class="vacio">Todavía no hay repuestos. Registre la primera entrada con foto o a mano.</div>';
  else if (!v.length) l.innerHTML = '<div class="vacio">No hay resultados.</div>';
  else {
    const cats = [...orden, ...[...new Set(v.map(cat))].filter((c) => !orden.includes(c))];
    cats.forEach((c) => {
      const g = v.filter((it) => cat(it) === c).sort((a, b) => nom(a).localeCompare(nom(b)));
      if (!g.length) return;
      const h = document.createElement("div");
      h.className = "inv-cat";
      const u = g.reduce((t, it) => t + num(it), 0);
      h.innerHTML = "<span></span><span></span>";
      h.children[0].textContent = c;
      h.children[1].textContent = `${g.length} ${prod ? "producto" : "repuesto"}${g.length === 1 ? "" : "s"} · ${u} en existencia`;
      l.appendChild(h);
      g.forEach((it) => {
        const n = num(it),
          d = document.createElement("div");
        d.className = "item" + (n <= 0 ? " cero" : n <= 1 ? " bajo" : "");
        d.innerHTML = '<span class="nom"></span><b class="cant"></b><small></small>';
        d.querySelector(".nom").textContent = nom(it);
        d.querySelector(".cant").textContent = n;
        let t;
        if (prod) {
          t = `Precio ${pesos(it.precio || 0)}`;
          if (esAdmin && costos["prod-" + it.id])
            t += ` · Costo ${pesos(costos["prod-" + it.id])} c/u`;
        } else {
          const hi = (it.historial || [])[0];
          t = hi
            ? `Último movimiento: ${hi.cant > 0 ? "+" : ""}${hi.cant} (${hi.nota || ""}) · ${fecha(hi.fecha)}`
            : "";
          if (esAdmin && costos["inv-" + it.id])
            t += ` · Costo ${pesos(costos["inv-" + it.id])} c/u`;
        }
        if (n <= 1) t = (n <= 0 ? "Agotado. " : "Queda poco. ") + t;
        d.querySelector("small").textContent = t;
        const m = document.createElement("div");
        m.className = "mini";
        const bt = (txt, fn, cls) => {
          const b = document.createElement("button");
          b.type = "button";
          b.textContent = txt;
          if (cls) b.className = cls;
          b.onclick = fn;
          m.appendChild(b);
          return b;
        };
        if (!prod && perm("inventario"))
          bt("+1 entrada", () => moverInv(it.id, 1, "entrada").catch(() => {}));
        if (esAdmin) {
          bt("Editar", () => abrirIe(prod ? "prod" : "rep", it));
          bt("+1", () =>
            (prod ? ajustarProd(it.id, 1) : moverInv(it.id, 1, "entrada")).catch(() => {}),
          );
          bt("−1", () =>
            (prod ? ajustarProd(it.id, -1) : moverInv(it.id, -1, "ajuste")).catch(() => {}),
          );
          const del = bt(
            "Eliminar",
            () => {
              if (del.dataset.ok)
                borrarConDeshacer(
                  prod ? "productos" : "inventario",
                  it.id,
                  it,
                  (prod ? "Producto " : "Repuesto ") + (prod ? it.nombre : nomItem(it)),
                ).catch(() => {});
              else {
                del.dataset.ok = "1";
                del.textContent = "¿Seguro? Eliminar";
              }
            },
            "btn-danger",
          );
        }
        if (m.children.length) d.appendChild(m);
        l.appendChild(d);
      });
    });
  }
  piezasSelect();
}
async function ajustarProd(id, n) {
  const p = productos.find((x) => x.id === id);
  if (!p) return;
  logAccion("Ajuste de inventario", `${p.nombre} ${n > 0 ? "+" : ""}${n}`);
  await db
    .doc("productos/" + id)
    .update({ stock: Math.max(0, (+p.stock || 0) + n), actualizado: new Date().toISOString() });
}
function abrirIe(kind, it) {
  $("ie-cat").innerHTML = CATS.map((c) => `<option>${c}</option>`).join("");
  $("ie-tipo").innerHTML = TIPOS.map((t) => `<option>${t}</option>`).join("");
  ieId = it ? it.id : null;
  ieKind = kind;
  $("ie").hidden = false;
  $("inv-form").hidden = true;
  $("fv").hidden = true;
  $("xl").hidden = true;
  $("ie-tit").textContent =
    (it ? "Editar " : "Nuevo ") + (kind === "prod" ? "producto de venta" : "repuesto");
  document.querySelectorAll(".iep").forEach((x) => (x.hidden = kind !== "prod"));
  document.querySelectorAll(".ier").forEach((x) => (x.hidden = kind === "prod"));
  if (kind === "prod") {
    $("ie-nombre").value = it ? it.nombre || "" : "";
    $("ie-cat").value =
      it && CATS.includes(it.cat) ? it.cat : CATS.includes(posCat) ? posCat : "Cargadores";
    $("ie-precio").value = it ? it.precio || "" : "";
    $("ie-cant").value = it ? +it.stock || 0 : "";
  } else {
    $("ie-tipo").value = it && TIPOS.includes(it.tipo) ? it.tipo : "Pantalla";
    $("ie-marca").value = it ? it.marca || "" : "";
    $("ie-modelo").value = it ? it.modelo || "" : "";
    $("ie-calidad").value = it ? it.calidad || "" : "";
    $("ie-cant").value = it ? +it.cantidad || 0 : "";
  }
  $("ie-costo-c").hidden = !esAdmin;
  $("ie-costo").value =
    it && esAdmin ? costos[(kind === "prod" ? "prod-" : "inv-") + it.id] || "" : "";
  const bo = $("ie-borrar");
  bo.hidden = !(it && esAdmin);
  delete bo.dataset.ok;
  bo.textContent = "Eliminar";
  $("ie").scrollIntoView({ block: "center", behavior: "smooth" });
}
$("ie-cancelar").onclick = () => {
  $("ie").hidden = true;
};
$("inv-pnuevo").onclick = () => {
  invVista = "prod";
  pintarInv();
  abrirIe("prod", null);
};
$("inv-tab-prod").onclick = () => {
  invVista = "prod";
  pintarInv();
};
$("inv-tab-rep").onclick = () => {
  invVista = "rep";
  pintarInv();
};
$("ie-borrar").onclick = async () => {
  const b = $("ie-borrar");
  if (!b.dataset.ok) {
    b.dataset.ok = "1";
    b.textContent = "¿Seguro? Eliminar";
    return;
  }
  try {
    const it0 = (ieKind === "prod" ? productos : inv).find((x) => x.id === ieId);
    await borrarConDeshacer(
      ieKind === "prod" ? "productos" : "inventario",
      ieId,
      it0 || {},
      ieKind === "prod"
        ? "Producto " + ((it0 && it0.nombre) || "")
        : "Repuesto " + (it0 ? nomItem(it0) : ""),
    );
    $("ie").hidden = true;
    $("inv-msg").textContent = "Eliminado.";
  } catch (e) {
    $("inv-msg").textContent = "No se pudo eliminar.";
  }
};
$("ie").onsubmit = async (ev) => {
  ev.preventDefault();
  const cant = Math.max(0, Math.round(+$("ie-cant").value || 0)),
    costo = $("ie-costo").value,
    ahora = new Date().toISOString(),
    msg = $("inv-msg");
  try {
    if (ieKind === "prod") {
      const nombre = $("ie-nombre").value.trim(),
        precio = Math.round(+$("ie-precio").value || 0);
      if (!nombre) {
        msg.textContent = "Escriba el nombre del producto.";
        return;
      }
      if (!precio) {
        msg.textContent = "Escriba el precio de venta.";
        return;
      }
      const id = ieId || "p" + Date.now().toString(36),
        ex = productos.find((x) => x.id === id),
        base = { ...(ex || {}) };
      delete base.id;
      await db
        .doc("productos/" + id)
        .set({ ...base, nombre, cat: $("ie-cat").value, precio, stock: cant, actualizado: ahora });
      if (esAdmin && costo !== "")
        await db
          .collection("costos")
          .doc("prod-" + id)
          .set({ repuesto: Math.round(+costo || 0) });
      logAccion(
        ieId ? "Producto editado" : "Producto creado",
        `${nombre} · ${pesos(precio)} · cantidad ${cant}`,
      );
      msg.textContent = `Producto guardado: ${nombre}.`;
    } else {
      const d = {
        tipo: $("ie-tipo").value,
        marca: $("ie-marca").value.trim(),
        modelo: $("ie-modelo").value.trim(),
        calidad: $("ie-calidad").value.trim(),
      };
      if (!d.marca || !d.modelo) {
        msg.textContent = "Escriba la marca y el modelo.";
        return;
      }
      const otro = inv.find((x) => x.id !== ieId && claveItem(x) === claveItem(d));
      if (otro) {
        msg.textContent = "Ya existe ese repuesto. Edítelo en la lista o súmele una entrada.";
        return;
      }
      const id = ieId || "r" + Date.now().toString(36),
        ex = inv.find((x) => x.id === id);
      if (ex) {
        const dif = cant - (+ex.cantidad || 0);
        await invCol
          .doc(id)
          .update({
            ...d,
            cantidad: cant,
            historial: dif
              ? [{ fecha: ahora, cant: dif, nota: "corrección" }]
                  .concat(ex.historial || [])
                  .slice(0, 40)
              : ex.historial || [],
            actualizado: ahora,
          });
      } else
        await invCol
          .doc(id)
          .set({
            ...d,
            cantidad: cant,
            historial: [{ fecha: ahora, cant, nota: "entrada" }],
            actualizado: ahora,
          });
      if (esAdmin && costo !== "")
        await db
          .collection("costos")
          .doc("inv-" + id)
          .set({ repuesto: Math.round(+costo || 0) });
      logAccion(ex ? "Repuesto editado" : "Repuesto creado", `${nomItem(d)} · cantidad ${cant}`);
      msg.textContent = `Repuesto guardado: ${nomItem(d)}.`;
    }
    $("ie").hidden = true;
  } catch (e) {
    msg.textContent = "No se pudo guardar. Revise la conexión e intente otra vez.";
  }
};
async function moverInv(id, cant, nota) {
  const r = invCol.doc(id),
    s = await r.get();
  if (!s.exists) return;
  const d = s.data();
  const hist = [{ fecha: new Date().toISOString(), cant, nota }]
    .concat(d.historial || [])
    .slice(0, 40);
  await r.update({
    cantidad: (+d.cantidad || 0) + cant,
    historial: hist,
    actualizado: new Date().toISOString(),
  });
  {
    const it = inv.find((x) => x.id === id);
    logAccion(
      nota === "entrada"
        ? "Entrada de repuesto"
        : nota === "ajuste"
          ? "Ajuste de inventario"
          : "Movimiento de inventario",
      `${it ? nomItem(it) : id} ${cant > 0 ? "+" : ""}${cant} (${nota})`,
    );
  }
}
async function entradaInv(datos, cant, costo) {
  let it = inv.find((x) => claveItem(x) === claveItem(datos)),
    id;
  if (it) {
    id = it.id;
    await moverInv(id, cant, "entrada");
  } else {
    id = "r" + Date.now().toString(36);
    const ahora = new Date().toISOString();
    await invCol
      .doc(id)
      .set({
        tipo: datos.tipo,
        marca: datos.marca,
        modelo: datos.modelo,
        calidad: datos.calidad,
        cantidad: cant,
        historial: [{ fecha: ahora, cant, nota: "entrada" }],
        actualizado: ahora,
      });
    logAccion("Repuesto nuevo", `${cant} × ${nomItem(datos)}`);
  }
  if (esAdmin && costo > 0)
    await db
      .collection("costos")
      .doc("inv-" + id)
      .set({ repuesto: costo });
  return id;
}
$("btn-inv").onclick = () => {
  $("fondo").hidden = false;
  $("inv").hidden = false;
  $("inv-form").hidden = true;
  $("xl").hidden = true;
  $("fv").hidden = true;
  $("ie").hidden = true;
  $("inv-pnuevo").hidden = !esAdmin;
  invVista = rolActual() === "tecnico" ? "rep" : "prod";
  $("inv-excel").hidden = !esAdmin;
  $("inv-fv").hidden = !(esAdmin && sample);
  pintarInv();
};
