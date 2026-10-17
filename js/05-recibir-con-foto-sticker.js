// ---- recibir con foto del sticker ----
let sample = null;
(async () => {
  try {
    sample = window.claude ? await window.claude.use("sample") : null;
    const l = sample ? await sample.limits().catch(() => null) : null;
    if (sample) {
      vozOk = true;
    }
    if (l && l.images) {
      fotoOk = true;
    }
    aplicarRol();
  } catch (e) {
    sample = null;
  }
})();
async function achicar(file) {
  const M = 1280;
  let c = null;
  const aBlob = (cv) =>
    new Promise((ok, mal) =>
      cv.toBlob(
        (b) => {
          cv.width = cv.height = 0;
          b ? ok(b) : mal(new Error("blob"));
        },
        "image/jpeg",
        0.8,
      ),
    );
  // 1) camino liviano: el navegador decodifica la foto ya reducida (gasta mucha menos memoria)
  try {
    if (window.createImageBitmap) {
      let bm = await createImageBitmap(file);
      const k = Math.min(1, M / Math.max(bm.width, bm.height));
      if (k < 1) {
        const w = Math.round(bm.width * k),
          h = Math.round(bm.height * k);
        bm.close();
        bm = await createImageBitmap(file, {
          resizeWidth: w,
          resizeHeight: h,
          resizeQuality: "medium",
        });
      }
      c = document.createElement("canvas");
      c.width = bm.width;
      c.height = bm.height;
      c.getContext("2d").drawImage(bm, 0, 0);
      bm.close();
      return await aBlob(c);
    }
  } catch (e) {
    if (c) {
      c.width = c.height = 0;
    }
  }
  // 2) respaldo: método clásico
  return await new Promise((ok, mal) => {
    const img = new Image(),
      u = URL.createObjectURL(file);
    img.onload = () => {
      try {
        const k = Math.min(1, M / Math.max(img.width, img.height));
        const cv = document.createElement("canvas");
        cv.width = Math.round(img.width * k);
        cv.height = Math.round(img.height * k);
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(u);
        img.src = "";
        aBlob(cv).then(ok, mal);
      } catch (e) {
        URL.revokeObjectURL(u);
        mal(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(u);
      mal(new Error("img"));
    };
    img.src = u;
  });
}
$("foto").onchange = async (ev) => {
  const f = ev.target.files && ev.target.files[0];
  ev.target.value = "";
  if (!f || !sample) return;
  $("prev").src = URL.createObjectURL(f);
  $("leyendo-txt").textContent = "Leyendo el sticker…";
  $("leyendo-ok").hidden = true;
  $("leyendo").hidden = false;
  try {
    const foto = await achicar(f);
    const d = await sample.json(
      "Esta es la foto de un sticker pegado atrás de un celular que llegó a reparar a un taller en Colombia. Está escrito a mano y normalmente tiene: nombre del cliente, número de teléfono, la falla del equipo y el valor de la reparación. A veces también la marca/modelo o un abono. Lee lo escrito y responde SOLO con un objeto JSON con estas claves: cliente (texto), telefono (solo dígitos, celular colombiano de 10 dígitos si se puede), falla (texto corto), valor (número entero en pesos colombianos: '80 mil', '80.000' o '80' en contexto de reparación = 80000), abono (número entero en pesos o 0), marca (texto o vacío: solo si está escrita o impresa en el sticker o en una etiqueta visible, por ejemplo 'Samsung', 'Motorola', 'Xiaomi'), modelo (texto o vacío: solo si aparece escrito o impreso, por ejemplo 'A54', 'G04', 'Redmi Note 12'; NO lo adivines por la forma o el aspecto del equipo; si no estás seguro déjalo vacío), tipo (uno de: Celular, Computador, Tablet u Otro; Celular si no se sabe), clave (el código de bloqueo, PIN, contraseña o patrón tal como está escrito, por ejemplo '1234', 'patrón L' o '1-2-3-6-9'; si hay un dibujo de patrón en una cuadrícula de 3x3 puntos, descríbelo como la secuencia de puntos numerados 1 a 9 de izquierda a derecha y de arriba abajo; vacío si no aparece), legible (true si pudiste leer el sticker, false si la foto no muestra un sticker con datos). Si un dato no aparece usa \"\" o 0. No inventes datos.",
      { images: [foto], modelTier: "default" },
    );
    if (!d || d.legible === false) {
      $("leyendo-txt").textContent =
        "No se pudo leer el sticker. Tome la foto más de cerca, con buena luz y sin reflejos.";
      $("leyendo-ok").hidden = false;
      return;
    }
    $("leyendo").hidden = true;
    abrir(null);
    $("f-cliente").value = d.cliente || "";
    $("f-tel").value = String(d.telefono || "").replace(/\D/g, "") || $("f-tel").value;
    $("f-falla").value = d.falla || "";
    {
      const mr = capi(String(d.marca || "")),
        md = String(d.modelo || "").trim();
      $("f-marca").value = mr;
      $("f-modelo").value = md;
      $("f-marca").placeholder = "Escríbala usted";
      $("f-modelo").placeholder = "Escríbalo usted";
      if (["Celular", "Computador", "Tablet", "Otro"].includes(d.tipo)) $("f-tipo").value = d.tipo;
    }
    $("f-clave").value = d.clave || "";
    {
      const m = String(d.clave || "").match(/[1-9](?:\s*-\s*[1-9]){2,}/);
      if (m) {
        patSeq = m[0].split("-").map((s) => +s.trim());
        pintarPat();
      }
    }
    $("f-precio").value = +d.valor || "";
    $("f-abono").value = +d.abono || "";
    cuentas();
    porFoto = true;
    {
      const fm = !$("f-marca").value,
        fd = !$("f-modelo").value;
      $("msg").textContent =
        (!fm && !fd
          ? "Ya leí el sticker y anoté la marca y la referencia: revíselas por si me equivoqué. "
          : "Ya leí el sticker, pero no pude reconocer " +
            (fm && fd ? "la marca ni la referencia" : fm ? "la marca" : "la referencia") +
            " del equipo: escríbala usted. ") +
        "Tome mínimo 2 fotos del equipo, revise los demás datos y toque Registrar equipo.";
      if (fm) $("f-marca").classList.add("pedir");
      if (fd) $("f-modelo").classList.add("pedir");
      setTimeout(() => {
        const t = fm ? $("f-marca") : fd ? $("f-modelo") : $("g-fotos");
        t.scrollIntoView({ block: "center" });
        if (fm || fd) t.focus();
      }, 50);
    }
  } catch (e) {
    $("leyendo-txt").textContent =
      e && e.code === "not_granted"
        ? "Debe permitir que la app use a Claude para leer fotos."
        : e && e.code === "rate_limited"
          ? "Demasiadas fotos seguidas. Espere un momento e intente otra vez."
          : "No se pudo leer la foto. Intente otra vez.";
    $("leyendo-ok").hidden = false;
  }
};
$("leyendo-ok").onclick = () => {
  $("leyendo").hidden = true;
};
let porFoto = false,
  vozOk = false;
