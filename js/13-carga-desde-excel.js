// ---- carga desde Excel ----
let xlFilas = [];
const XL_COLS = {
  productos: ["Nombre", "Categoría", "Precio", "Cantidad", "Costo"],
  repuestos: ["Tipo", "Marca", "Modelo", "Calidad", "Cantidad", "Costo"],
};
const XL_SIN = {
  nombre: ["nombre", "producto", "descripcion", "articulo", "item"],
  categoria: ["categoria", "tipo de producto", "linea", "grupo"],
  precio: ["precio", "precio venta", "precio de venta", "valor", "pvp", "venta"],
  cantidad: ["cantidad", "stock", "existencia", "existencias", "unidades", "cant"],
  costo: ["costo", "precio compra", "precio de compra", "compra", "costo unitario"],
  tipo: ["tipo", "tipo de repuesto", "repuesto"],
  marca: ["marca"],
  modelo: ["modelo", "referencia", "ref"],
  calidad: ["calidad"],
};
const normH = (v) =>
  String(v || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
const numXL = (v) => {
  if (typeof v === "number") return v;
  const t = String(v || "")
    .replace(/[$\s]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const n = parseFloat(t);
  return isNaN(n) ? 0 : n;
};
function abrirXL(dest) {
  $("xl").hidden = false;
  $("xl-dest").value = dest || $("xl-dest").value;
  xlFilas = [];
  $("xl-prev").innerHTML = "";
  $("xl-ok").hidden = true;
  $("xl-msg").textContent = "";
  colsXL();
  $("xl").scrollIntoView({ block: "start", behavior: "smooth" });
}
function colsXL() {
  $("xl-cols").innerHTML =
    "Columnas que lee: <b>" +
    XL_COLS[$("xl-dest").value].join(", ") +
    "</b>. La primera fila deben ser los títulos. Costo es opcional.";
  xlFilas = [];
  $("xl-prev").innerHTML = "";
  $("xl-ok").hidden = true;
}
$("inv-excel").onclick = () => abrirXL();
$("pos-excel").onclick = () => {
  $("btn-inv").onclick();
  abrirXL("productos");
};
$("xl-dest").onchange = colsXL;
$("xl-plantilla").onclick = async () => {
  if (!window.XLSX || !dl) {
    $("xl-msg").textContent = "No se pudo preparar la plantilla en este equipo.";
    return;
  }
  const d = $("xl-dest").value,
    ej =
      d === "productos"
        ? [
            ["Cargador tipo C 20W", "Cargadores", 35000, 10, 18000],
            ["Cable lightning 1m", "Cables", 15000, 20, 6000],
            ["Memoria micro SD 64GB", "Memorias", 30000, 8, 17000],
            ["Manos libres bluetooth", "Manos libres", 45000, 5, 25000],
          ]
        : [
            ["Pantalla", "Samsung", "A54", "OLED", 3, 170000],
            ["Batería", "Xiaomi", "Redmi Note 12", "", 5, 45000],
            ["Pin de carga", "Motorola", "G32", "", 10, 8000],
          ];
  const ws = XLSX.utils.aoa_to_sheet([XL_COLS[d], ...ej]);
  ws["!cols"] = XL_COLS[d].map((_, i) => ({ wch: i === 0 ? 28 : 14 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Inventario");
  try {
    await dl.save({
      filename: `plantilla-${d}.xlsx`,
      data: new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" })),
    });
    $("xl-msg").textContent =
      "Plantilla guardada. Llénela en Excel (borre los ejemplos) y luego escójala aquí.";
  } catch (e) {}
};
$("xl-file").onchange = async (ev) => {
  const f = ev.target.files && ev.target.files[0];
  ev.target.value = "";
  if (!f) return;
  if (!window.XLSX) {
    $("xl-msg").textContent =
      "No se pudo abrir el lector de Excel. Recargue la página e intente otra vez.";
    return;
  }
  try {
    const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const filas = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", blankrows: false });
    if (filas.length < 2) {
      $("xl-msg").textContent = "El archivo no tiene filas con productos.";
      return;
    }
    let hi = filas.findIndex((r) => r.some((c) => Object.values(XL_SIN).flat().includes(normH(c))));
    if (hi < 0) hi = 0;
    const head = filas[hi].map(normH),
      col = (k) => head.findIndex((h) => XL_SIN[k].includes(h));
    const d = $("xl-dest").value,
      ci = {};
    [
      "nombre",
      "categoria",
      "precio",
      "cantidad",
      "costo",
      "tipo",
      "marca",
      "modelo",
      "calidad",
    ].forEach((k) => (ci[k] = col(k)));
    if (d === "productos" && ci.nombre < 0) {
      $("xl-msg").textContent = "No encontré la columna Nombre. Use la plantilla.";
      return;
    }
    if (d === "repuestos" && ci.modelo < 0) {
      $("xl-msg").textContent = "No encontré la columna Modelo. Use la plantilla.";
      return;
    }
    const g = (r, k) => (ci[k] >= 0 ? r[ci[k]] : "");
    xlFilas = filas
      .slice(hi + 1)
      .map((r) => {
        if (d === "productos") {
          const nombre = String(g(r, "nombre")).trim(),
            cat = catXL(g(r, "categoria") || nombre),
            precio = Math.round(numXL(g(r, "precio"))),
            cant = Math.round(numXL(g(r, "cantidad"))),
            costo = Math.round(numXL(g(r, "costo")));
          return {
            nombre,
            cat,
            precio,
            cant,
            costo,
            err: !nombre ? "Sin nombre" : !precio ? "Sin precio" : "",
          };
        }
        const tipoTxt = String(g(r, "tipo")).trim(),
          tipo =
            TIPOS.find((t) => normH(t) === normH(tipoTxt)) ||
            TIPOS.find((t) => normH(tipoTxt).startsWith(normH(t).slice(0, 4))) ||
            (tipoTxt ? "Otro" : "Pantalla");
        const marca = String(g(r, "marca")).trim(),
          modelo = String(g(r, "modelo")).trim();
        return {
          tipo,
          marca,
          modelo,
          calidad: String(g(r, "calidad")).trim(),
          cant: Math.round(numXL(g(r, "cantidad"))),
          costo: Math.round(numXL(g(r, "costo"))),
          err: !modelo ? "Sin modelo" : "",
        };
      })
      .filter((x) => (d === "productos" ? x.nombre || x.precio : x.modelo || x.marca));
    previewXL();
  } catch (e) {
    $("xl-msg").textContent =
      "No se pudo leer el archivo. Verifique que sea un Excel (.xlsx) o CSV.";
  }
};
function catXL(v) {
  const t = normH(v);
  return (
    CATS.find((c) => normH(c) === t) ||
    CATS.find((c) => t.includes(normH(c).slice(0, 5))) ||
    "Otros"
  );
}
function existeXL(x, d) {
  return d === "productos"
    ? productos.find((p) => normH(p.nombre) === normH(x.nombre))
    : inv.find((it) => claveItem(it) === claveItem(x));
}
function previewXL() {
  const d = $("xl-dest").value,
    ok = xlFilas.filter((x) => !x.err),
    nuevos = ok.filter((x) => !existeXL(x, d)).length;
  const th =
    d === "productos"
      ? ["Nombre", "Categoría", "Precio", "Cantidad", "Costo", ""]
      : ["Tipo", "Marca", "Modelo", "Calidad", "Cantidad", "Costo", ""];
  const filas = xlFilas
    .slice(0, 300)
    .map((x) => {
      const est = x.err || (existeXL(x, d) ? "Actualiza" : "Nuevo");
      const c =
        d === "productos"
          ? [x.nombre, x.cat, pesos(x.precio), x.cant, x.costo ? pesos(x.costo) : "", est]
          : [x.tipo, x.marca, x.modelo, x.calidad, x.cant, x.costo ? pesos(x.costo) : "", est];
      return `<tr class="${x.err ? "mal" : ""}">${c.map((v) => `<td>${esc(v)}</td>`).join("")}</tr>`;
    })
    .join("");
  $("xl-prev").innerHTML =
    `<p style="margin:0 0 6px"><b>${ok.length}</b> filas listas (${nuevos} nuevos, ${ok.length - nuevos} para actualizar)${xlFilas.length - ok.length ? ` · <span class="falta">${xlFilas.length - ok.length} con error no se cargan</span>` : ""}.</p><div class="xl-tabla"><table><thead><tr>${th.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${filas}</tbody></table></div>`;
  $("xl-ok").hidden = !ok.length;
  $("xl-ok").textContent = `Cargar ${ok.length} ${d === "productos" ? "productos" : "repuestos"}`;
  $("xl-msg").textContent = "";
}
$("xl-modo").onchange = () => {
  if (xlFilas.length) previewXL();
};
$("xl-ok").onclick = async () => {
  const d = $("xl-dest").value,
    modo = $("xl-modo").value,
    ok = xlFilas.filter((x) => !x.err),
    b = $("xl-ok");
  if (!ok.length) return;
  b.disabled = true;
  let n = 0,
    fallas = 0;
  const ahora = new Date().toISOString();
  for (const x of ok) {
    try {
      const ex = existeXL(x, d);
      if (d === "productos") {
        const id = ex
          ? ex.id
          : "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
        await db
          .doc("productos/" + id)
          .set({
            nombre: x.nombre,
            cat: x.cat,
            precio: x.precio,
            stock: ex && modo === "sumar" ? (+ex.stock || 0) + x.cant : x.cant,
            actualizado: ahora,
          });
        if (x.costo) await db.doc("costos/prod-" + id).set({ repuesto: x.costo });
      } else {
        const id = ex
          ? ex.id
          : "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
        const cant = ex && modo === "sumar" ? (+ex.cantidad || 0) + x.cant : x.cant,
          hist = [
            {
              fecha: ahora,
              cant: ex ? cant - (+ex.cantidad || 0) : x.cant,
              nota: "carga desde Excel",
            },
          ]
            .concat((ex && ex.historial) || [])
            .slice(0, 40);
        await db
          .doc("inventario/" + id)
          .set({
            tipo: x.tipo,
            marca: x.marca,
            modelo: x.modelo,
            calidad: x.calidad,
            cantidad: cant,
            historial: hist,
            actualizado: ahora,
          });
        if (x.costo) await db.doc("costos/inv-" + id).set({ repuesto: x.costo });
      }
      n++;
    } catch (e) {
      fallas++;
    }
    $("xl-msg").textContent = `Cargando… ${n} de ${ok.length}`;
  }
  logAccion(
    "Carga desde Excel",
    `${n} ${d === "productos" ? "productos" : "repuestos"} cargados` +
      (fallas ? `, ${fallas} fallaron` : ""),
  );
  b.disabled = false;
  xlFilas = [];
  $("xl-ok").hidden = true;
  $("xl-prev").innerHTML = "";
  $("xl-msg").textContent =
    `Listo: se cargaron ${n} ${d === "productos" ? "productos" : "repuestos"}.` +
    (fallas ? ` ${fallas} no se pudieron guardar.` : "");
};
$("inv-cerrar").onclick = cerrar;
function abrirInvForm(d) {
  $("inv-form").hidden = false;
  $("i-tipo").value = TIPOS.includes(d.tipo) ? d.tipo : "Pantalla";
  $("i-marca").value = d.marca || "";
  $("i-modelo").value = d.modelo || "";
  $("i-calidad").value = d.calidad || "";
  $("i-cant").value = d.cantidad || 1;
  $("i-costo").value = "";
  $("c-icosto").hidden = !esAdmin;
  $("i-marca").focus();
}
$("inv-nuevo").onclick = () => abrirInvForm({});
$("inv-cancelar").onclick = () => {
  $("inv-form").hidden = true;
};
$("inv-form").onsubmit = async (ev) => {
  ev.preventDefault();
  const d = {
      tipo: $("i-tipo").value,
      marca: $("i-marca").value.trim(),
      modelo: $("i-modelo").value.trim(),
      calidad: $("i-calidad").value.trim(),
    },
    c = Math.max(1, Math.round(+$("i-cant").value || 1));
  $("inv-msg").textContent = "Guardando…";
  try {
    await entradaInv(d, c, +$("i-costo").value || 0);
    $("inv-msg").textContent = `Entrada guardada: ${c} × ${nomItem(d)}.`;
    $("inv-form").hidden = true;
  } catch (e) {
    $("inv-msg").textContent = "No se pudo guardar. Revise la conexión e intente otra vez.";
  }
};
$("inv-buscar").oninput = pintarInv;
$("inv-foto").onchange = async (ev) => {
  const f = ev.target.files && ev.target.files[0];
  ev.target.value = "";
  if (!f || !sample) return;
  $("prev").src = URL.createObjectURL(f);
  $("prev").classList.remove("grande");
  $("leyendo-txt").textContent = "Leyendo el repuesto…";
  $("leyendo-ok").hidden = true;
  $("leyendo").hidden = false;
  try {
    const foto = await achicar(f);
    const d = await sample.json(
      "Esta es la foto de un repuesto de celular que acaba de llegar a un taller en Colombia: un display o módulo de pantalla, batería, pin de carga, tapa, cámara, flex u otro, o la etiqueta o caja del repuesto. Lee la etiqueta, la caja o lo impreso en la pieza y responde SOLO con un objeto JSON con estas claves: tipo (exactamente uno de: Pantalla, Batería, Pin de carga, Tapa, Cámara, Flex, Otro; un display o módulo es Pantalla), marca (marca del celular para el que sirve, como Samsung, Xiaomi, Motorola, iPhone; no la marca del fabricante del repuesto), modelo (modelo del celular compatible, por ejemplo A54, Redmi Note 12, G32, 11 Pro; si hay varios compatibles ponlos separados por /), calidad (Original, OLED, Incell, TFT o Genérico si se ve indicado; vacío si no), cantidad (número de unidades que se ven en la foto, 1 si no se sabe), legible (false si no logras saber para qué celular es). No inventes el modelo: si no aparece, déjalo vacío y pon legible false.",
      { images: [foto], modelTier: "default" },
    );
    if (!d || d.legible === false || !String(d.modelo || "").trim()) {
      $("leyendo-txt").textContent =
        "No se pudo saber para qué celular es el repuesto. Tómele la foto a la etiqueta o a la caja, donde sale el modelo, o regístrelo a mano.";
      $("leyendo-ok").hidden = false;
      return;
    }
    const datos = {
        tipo: TIPOS.includes(d.tipo) ? d.tipo : "Otro",
        marca: String(d.marca || "").trim(),
        modelo: String(d.modelo || "").trim(),
        calidad: String(d.calidad || "").trim(),
      },
      c = Math.max(1, Math.round(+d.cantidad || 1));
    const id = await entradaInv(datos, c, 0);
    $("leyendo").hidden = true;
    const m = $("inv-msg");
    m.textContent = `Entrada registrada: ${c} × ${nomItem(datos)}.`;
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = "Deshacer";
    b.onclick = async () => {
      b.disabled = true;
      try {
        await moverInv(id, -c, "deshacer");
        m.textContent = "Entrada deshecha.";
      } catch (e) {
        m.textContent = "No se pudo deshacer.";
      }
    };
    m.appendChild(b);
  } catch (e) {
    $("leyendo-txt").textContent =
      e && e.code === "not_granted"
        ? "Debe permitir que la app use a Claude para leer fotos."
        : e && e.code === "rate_limited"
          ? "Demasiadas fotos seguidas. Espere un momento e intente otra vez."
          : "No se pudo registrar el repuesto. Intente otra vez.";
    $("leyendo-ok").hidden = false;
  }
};
