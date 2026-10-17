// ---- recibir por voz (dictado con el teclado) ----
$("g-todo").onclick = () => {
  cerrar();
  $("voz-txt").value = "";
  $("voz-msg").textContent = "";
  $("fondo").hidden = false;
  $("voz").hidden = false;
  setTimeout(() => $("voz-txt").focus(), 50);
};
$("btn-voz").onclick = () => $("g-todo").onclick();
const _vozViejo = () => {
  cerrar();
  $("voz-txt").value = "";
  $("voz-msg").textContent = "";
  $("fondo").hidden = false;
  $("voz").hidden = false;
  setTimeout(() => $("voz-txt").focus(), 50);
};
$("voz-cerrar").onclick = cerrar;
$("voz-ok").onclick = async () => {
  const txt = $("voz-txt").value.trim();
  if (!txt) {
    $("voz-msg").textContent = "Primero dicte o escriba los datos del equipo.";
    return;
  }
  if (!sample) {
    $("voz-msg").textContent = "Esta función no está disponible en esta cuenta.";
    return;
  }
  const b = $("voz-ok");
  b.disabled = true;
  $("voz-msg").textContent = "Entendiendo lo que dijo…";
  const hoy = new Date(),
    hoyTxt = hoy.toLocaleDateString("es-CO", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  try {
    const d = await sample.json(
      `Eres el asistente de recepción de un taller de reparación de celulares en Colombia. Una persona dictó por voz (con el teclado del celular, puede tener errores de dictado y sin puntuación) los datos de un equipo que llega a reparar. Hoy es ${hoyTxt} (${diaDe(hoy.toISOString())}).
Texto dictado: """${txt}"""
Responde SOLO con un objeto JSON con estas claves (usa "" o 0 si no se dice; no inventes nada):
- cliente: nombre del cliente con mayúsculas iniciales
- telefono: solo dígitos (celular colombiano de 10 dígitos; "trescientos uno..." conviértelo a números)
- cedula: solo dígitos
- marca: marca del celular (Samsung, Xiaomi, Motorola, iPhone, Huawei, Oppo, Realme, Tecno, Honor, ZTE u otra)
- modelo: modelo o referencia (ej. A54, Redmi Note 12, G32, 11 Pro)
- imei: solo dígitos
- clave: código, PIN, contraseña o patrón de bloqueo tal como lo dijo; si dice un patrón con números del 1 al 9 escríbelo como 1-4-7-8-9
- falla: lo que dice el cliente que le pasa al equipo, frase corta y clara
- recibe: cómo llega el equipo (accesorios, golpes, rayones, sin forro, sin SIM, etc.)
- valor: valor de la reparación en pesos, número entero ("280 mil" = 280000)
- abono: abono que deja en pesos, número entero
- entrega: fecha prometida de entrega en formato AAAA-MM-DD si la menciona ("el viernes", "mañana", "en 3 días" calcúlala desde hoy); "" si no
- tecnico: nombre del técnico si lo menciona
- garantia: días de garantía si los menciona, si no 0`,
      { modelTier: "default" },
    );
    cerrar();
    abrir(null);
    const pon = (id, v) => {
      if (v !== undefined && v !== null && v !== "" && v !== 0) $(id).value = v;
    };
    pon("f-cliente", d.cliente);
    pon("f-tel", String(d.telefono || "").replace(/\D/g, ""));
    pon("f-cedula", String(d.cedula || "").replace(/\D/g, ""));
    pon("f-marca", d.marca);
    pon("f-modelo", d.modelo);
    pon("f-imei", String(d.imei || "").replace(/\D/g, ""));
    pon("f-clave", d.clave);
    pon("f-falla", d.falla);
    pon("f-recibe", d.recibe);
    pon("f-precio", +d.valor || "");
    pon("f-abono", +d.abono || "");
    if (/^\d{4}-\d{2}-\d{2}$/.test(d.entrega || "")) $("f-entrega").value = d.entrega;
    pon("f-tecnico", d.tecnico);
    if (+d.garantia) $("f-garantia").value = +d.garantia;
    {
      const m = String(d.clave || "").match(/[1-9](?:\s*-\s*[1-9]){2,}/);
      if (m) {
        patSeq = m[0].split("-").map((x) => +x.trim());
        pintarPat();
      }
    }
    cuentas();
    const faltan = [
      ["f-cliente", "nombre"],
      ["f-marca", "marca"],
      ["f-modelo", "referencia"],
      ["f-falla", "falla"],
    ].filter(([id]) => !$(id).value.trim());
    faltan.forEach(([id]) => $(id).classList.add("pedir"));
    $("msg").textContent = faltan.length
      ? `Llené lo que entendí. Falta: ${faltan.map((x) => x[1]).join(", ")}. Complételo, revise todo y toque Registrar equipo.`
      : "Llené el formulario con lo que dictó. Tome mínimo 2 fotos del equipo, revise que todo esté bien (sobre todo el teléfono, la marca y la referencia) y toque Registrar equipo.";
    setTimeout(() => {
      $("msg").scrollIntoView({ block: "center" });
    }, 50);
  } catch (e) {
    $("voz-msg").textContent =
      e && e.code === "not_granted"
        ? "Debe permitir que la app use a Claude para entender lo que dictó."
        : e && e.code === "rate_limited"
          ? "Demasiadas solicitudes seguidas. Espere un momento e intente otra vez."
          : "No se pudo entender el texto. Intente otra vez.";
  }
  b.disabled = false;
};
