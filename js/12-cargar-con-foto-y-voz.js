// ---- cargar con foto y voz ----
let fvFoto = null,
  fvBlob = null;
function fvModo() {
  const p = $("fv-dest").value === "productos";
  document.querySelectorAll(".fvp").forEach((x) => (x.hidden = !p));
  document.querySelectorAll(".fvr").forEach((x) => (x.hidden = p));
}
$("inv-fv").onclick = () => {
  $("fv").hidden = false;
  $("xl").hidden = true;
  $("inv-form").hidden = true;
  fvFoto = null;
  fvBlob = null;
  $("fv-prev").hidden = true;
  $("fv-nota").value = "";
  $("fv-campos").hidden = true;
  $("fv-msg").textContent = "";
  $("fv-cat").innerHTML = CATS.map((c) => `<option>${c}</option>`).join("");
  $("fv-tipo").innerHTML = TIPOS.map((t) => `<option>${t}</option>`).join("");
  fvModo();
  $("fv").scrollIntoView({ block: "start", behavior: "smooth" });
};
$("fv-dest").onchange = fvModo;
$("fv-foto").onchange = async (ev) => {
  const f = ev.target.files && ev.target.files[0];
  ev.target.value = "";
  if (!f) return;
  try {
    fvBlob = await achicar(f);
    $("fv-prev").src = URL.createObjectURL(fvBlob);
    $("fv-prev").hidden = false;
  } catch (e) {
    $("fv-msg").textContent = "No se pudo abrir la foto.";
  }
};
$("fv-cancelar").onclick = () => {
  $("fv").hidden = true;
};
$("fv-leer").onclick = async () => {
  const nota = $("fv-nota").value.trim(),
    d = $("fv-dest").value;
  if (!nota && !fvBlob) {
    $("fv-msg").textContent = "Tome la foto o dicte los datos del producto.";
    return;
  }
  const b = $("fv-leer");
  b.disabled = true;
  $("fv-msg").textContent = "Leyendo la foto y lo que dictó…";
  const pide =
    d === "productos"
      ? `Responde SOLO con JSON: nombre (nombre comercial claro del producto incluyendo la marca y la característica principal, ej. "Cargador tipo C 20W Samsung"), marca, categoria (exactamente una de: ${CATS.join(", ")}), cantidad (entero), costo (lo que le costó o "me salió a", pesos enteros; "18 mil"=18000), precio (precio de venta, pesos enteros), duda (frase corta si algo no está claro, o "").`
      : `Responde SOLO con JSON: tipo (exactamente uno de: ${TIPOS.join(", ")}; un display o módulo es Pantalla), marca (marca del celular compatible), modelo (modelo del celular compatible), calidad (Original, OLED, Incell, TFT, Genérico o ""), cantidad (entero), costo (lo que le costó por unidad, pesos enteros), duda (frase corta si algo no está claro, o "").`;
  try {
    const r = await sample.json(
      `Eres el asistente de inventario de una tienda y taller de celulares en Colombia. El dueño está registrando ${d === "productos" ? "un producto para la venta" : "un repuesto para reparación"}. ${fvBlob ? "Te envío una foto del producto o de su caja/etiqueta: úsala para el nombre, la marca y el modelo. " : ""}${nota ? `Lo que dictó por voz (puede tener errores de dictado): """${nota}""". Lo dictado manda sobre la foto en cantidad, costo y precio. ` : ""}No inventes valores: si no dice cantidad, costo o precio, pon 0. ${pide}`,
      fvBlob ? { images: [fvBlob], modelTier: "default" } : { modelTier: "default" },
    );
    $("fv-campos").hidden = false;
    if (d === "productos") {
      $("fv-nombre").value = r.nombre || "";
      $("fv-cat").value = CATS.includes(r.categoria)
        ? r.categoria
        : catXL(r.categoria || r.nombre || "");
      $("fv-precio").value = +r.precio || "";
    } else {
      $("fv-tipo").value = TIPOS.includes(r.tipo) ? r.tipo : "Otro";
      $("fv-marca").value = r.marca || "";
      $("fv-modelo").value = r.modelo || "";
      $("fv-calidad").value = r.calidad || "";
    }
    $("fv-cant").value = +r.cantidad || "";
    $("fv-costo").value = +r.costo || "";
    const x = fvDatos(),
      ex = existeXL(x, d);
    $("fv-exp").textContent = [
      ex
        ? `Ya existe en el inventario (quedan ${d === "productos" ? +ex.stock || 0 : +ex.cantidad || 0}): la cantidad se sumará.`
        : "Es un producto nuevo.",
      r.duda || "",
    ]
      .filter(Boolean)
      .join(" ");
    $("fv-exp").style.color = r.duda ? "var(--s-rep)" : "var(--muted)";
    $("fv-msg").textContent = "Revise los datos y toque Guardar en el inventario.";
  } catch (e) {
    $("fv-msg").textContent =
      e && e.code === "not_granted"
        ? "Debe permitir que la app use a Claude para leer la foto y la voz."
        : "No se pudo entender. Intente otra vez o escriba los datos.";
    $("fv-campos").hidden = false;
  }
  b.disabled = false;
};
function fvDatos() {
  return $("fv-dest").value === "productos"
    ? {
        nombre: $("fv-nombre").value.trim(),
        cat: $("fv-cat").value,
        precio: Math.round(+$("fv-precio").value || 0),
        cant: Math.round(+$("fv-cant").value || 0),
        costo: Math.round(+$("fv-costo").value || 0),
      }
    : {
        tipo: $("fv-tipo").value,
        marca: $("fv-marca").value.trim(),
        modelo: $("fv-modelo").value.trim(),
        calidad: $("fv-calidad").value.trim(),
        cant: Math.round(+$("fv-cant").value || 0),
        costo: Math.round(+$("fv-costo").value || 0),
      };
}
$("fv").onsubmit = async (ev) => {
  ev.preventDefault();
  const d = $("fv-dest").value,
    x = fvDatos();
  if (d === "productos" && (!x.nombre || !x.precio)) {
    $("fv-msg").textContent = "Falta el nombre o el precio de venta.";
    return;
  }
  if (d === "repuestos" && !x.modelo) {
    $("fv-msg").textContent = "Falta el modelo del celular.";
    return;
  }
  $("fv-msg").textContent = "Guardando…";
  const ahora = new Date().toISOString();
  try {
    let foto = null;
    if (fvBlob && d === "productos") {
      try {
        foto = await subirBlobFoto(new File([fvBlob], "p.jpg", { type: "image/jpeg" }));
      } catch (e) {}
    }
    const ex = existeXL(x, d);
    if (d === "productos") {
      const id = ex ? ex.id : "p" + Date.now().toString(36);
      const doc = {
        nombre: x.nombre,
        cat: x.cat,
        precio: x.precio,
        stock: (ex ? +ex.stock || 0 : 0) + x.cant,
        actualizado: ahora,
      };
      if (foto) doc.foto = foto;
      else if (ex && ex.foto) doc.foto = ex.foto;
      await db.doc("productos/" + id).set(doc);
      if (x.costo) await db.doc("costos/prod-" + id).set({ repuesto: x.costo });
    } else {
      const id = ex ? ex.id : "r" + Date.now().toString(36),
        cant = (ex ? +ex.cantidad || 0 : 0) + x.cant;
      await db
        .doc("inventario/" + id)
        .set({
          tipo: x.tipo,
          marca: x.marca,
          modelo: x.modelo,
          calidad: x.calidad,
          cantidad: cant,
          historial: [{ fecha: ahora, cant: x.cant, nota: "entrada con foto y voz" }]
            .concat((ex && ex.historial) || [])
            .slice(0, 40),
          actualizado: ahora,
        });
      if (x.costo) await db.doc("costos/inv-" + id).set({ repuesto: x.costo });
    }
    logAccion(
      "Carga con foto y voz",
      d === "productos" ? `${x.cant} × ${x.nombre}` : `${x.cant} × ${nomItem(x)}`,
    );
    $("fv-campos").hidden = true;
    $("fv-nota").value = "";
    fvBlob = null;
    $("fv-prev").hidden = true;
    $("fv-msg").textContent =
      `Guardado: ${x.cant} × ${d === "productos" ? x.nombre : nomItem(x)}. Puede cargar el siguiente.`;
  } catch (e) {
    $("fv-msg").textContent = "No se pudo guardar. Revise la conexión e intente otra vez.";
  }
};
