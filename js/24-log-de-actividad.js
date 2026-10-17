// ---- log: quién hizo qué y cuándo ----
const ROLES_TXT = {
  admin: "Administrador",
  asesor: "Asesor de ventas",
  tecnico: "Técnico",
  consulta: "Solo consulta",
};
function logAccion(accion, detalle) {
  try {
    if (!db) return;
    const id = "l" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    db.collection("log")
      .doc(id)
      .set({
        t: new Date().toISOString(),
        quien: sesion ? sesion.nombre : "",
        rol: rolActual(),
        accion: String(accion).slice(0, 80),
        detalle: String(detalle || "").slice(0, 300),
      })
      .catch(() => {});
  } catch (e) {}
}
function logOrden(o) {
  try {
    const p = ordenes.find((x) => x.id === o.id),
      n = `#${o.num} ${[o.marca, o.modelo].filter(Boolean).join(" ")} · ${o.cliente || ""}`.trim();
    if (!p) {
      logAccion("Equipo recibido", n + (o.falla ? " · " + o.falla : ""));
      return;
    }
    const c = [];
    if (p.estado !== o.estado) c.push(`estado ${est(p.estado).n} → ${est(o.estado).n}`);
    if ((+p.precio || 0) !== (+o.precio || 0))
      c.push(`valor ${pesos(p.precio || 0)} → ${pesos(o.precio || 0)}`);
    const pn = pagosDe(o),
      pp = pagosDe(p);
    if (pn.length > pp.length)
      c.push(
        "pago " +
          pn
            .slice(pp.length)
            .map((x) => pesos(x.monto) + (x.metodo ? " " + x.metodo : ""))
            .join(", "),
      );
    else if (pn.length < pp.length) c.push("pago quitado");
    else if ((+p.abono || 0) !== (+o.abono || 0))
      c.push(`abono ${pesos(p.abono || 0)} → ${pesos(o.abono || 0)}`);
    [
      ["cliente", "cliente"],
      ["tel", "teléfono"],
      ["marca", "marca"],
      ["modelo", "modelo"],
      ["falla", "falla"],
      ["diag", "diagnóstico"],
      ["tecnico", "técnico"],
      ["clave", "clave"],
      ["imei", "IMEI"],
      ["cedula", "cédula"],
    ].forEach(([k, t]) => {
      if (String(p[k] || "") !== String(o[k] || "")) c.push(t + " cambiado");
    });
    if ((o.fotos || []).length !== (p.fotos || []).length) c.push("fotos cambiadas");
    if (!c.length) return;
    logAccion("Orden modificada", n + " · " + c.join("; "));
  } catch (e) {}
}
function logPermisos(c) {
  try {
    ["asesor", "tecnico"].forEach((r) => {
      if (c[r])
        Object.keys(c[r])
          .filter((k) => !!c[r][k] !== !!P[r][k])
          .forEach((k) => {
            const n = (PERMS.find((x) => x[0] === k) || [k, k])[1];
            logAccion(
              "Permiso cambiado",
              `${r === "asesor" ? "Asesor" : "Técnico"}: ${n} → ${c[r][k] ? "activado" : "desactivado"}`,
            );
          });
    });
    if (c.usuarios) {
      const a = usuarios,
        b = c.usuarios;
      b.filter((u) => !a.some((x) => x.id === u.id)).forEach((u) =>
        logAccion("Usuario creado", `${u.nombre} (${u.usuario}) · ${ROLES_TXT[u.rol] || u.rol}`),
      );
      a.filter((u) => !b.some((x) => x.id === u.id)).forEach((u) =>
        logAccion("Usuario eliminado", `${u.nombre} (${u.usuario})`),
      );
      b.forEach((u) => {
        const o = a.find((x) => x.id === u.id);
        if (!o) return;
        if (o.rol !== u.rol)
          logAccion(
            "Rol cambiado",
            `${u.nombre}: ${ROLES_TXT[o.rol] || o.rol} → ${ROLES_TXT[u.rol] || u.rol}`,
          );
        if (o.usuario !== u.usuario) logAccion("Usuario de ingreso cambiado", u.nombre);
        if (o.hash !== u.hash) logAccion("Contraseña cambiada", u.nombre);
      });
    }
    if (c.impresora) logAccion("Formato de impresora modificado", "");
    if (c.mensajes) logAccion("Mensajes de WhatsApp modificados", "");
    if ("waAdmin" in c) logAccion("Número de WhatsApp del administrador cambiado", "");
  } catch (e) {}
}
let logDatos = [],
  logMax = 100;
async function cargarLog() {
  const r = $("lg-res");
  if (!esAdmin || !db) {
    r.textContent = "Solo el administrador puede ver el log.";
    return;
  }
  r.textContent = "Cargando…";
  try {
    const sn = await db.collection("log").get();
    logDatos = sn.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => String(b.t).localeCompare(String(a.t)));
    const sel = $("lg-staff"),
      v = sel.value;
    sel.innerHTML =
      '<option value="">Todos</option>' +
      [...new Set(logDatos.map((x) => x.quien).filter(Boolean))]
        .sort()
        .map((n) => `<option value="${esc(n)}">${esc(n)}</option>`)
        .join("");
    sel.value = v;
    logMax = 100;
    pintarLog();
  } catch (e) {
    r.textContent = "No se pudo leer el log. Revise la conexión.";
  }
}
function pintarLog() {
  const dia = $("lg-dia").value,
    st = $("lg-staff").value,
    q = normN($("lg-buscar").value);
  const f = logDatos.filter(
    (x) =>
      (!dia || diaDe(x.t) === dia) &&
      (!st || x.quien === st) &&
      (!q || normN([x.accion, x.detalle, x.quien].join(" ")).includes(q)),
  );
  const z = $("lg-lista");
  z.innerHTML = "";
  $("lg-res").textContent = logDatos.length
    ? `${f.length} de ${logDatos.length} registros`
    : "Todavía no hay registros. Aparecerán a medida que se trabaje en la app.";
  f.slice(0, logMax).forEach((x) => {
    const d = document.createElement("div");
    d.className = "mov";
    d.innerHTML = "<span></span><b></b><small></small>";
    d.querySelector("span").textContent = x.accion + (x.detalle ? ": " + x.detalle : "");
    d.querySelector("b").textContent = new Date(x.t).toLocaleTimeString("es-CO", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    });
    d.querySelector("small").textContent = [
      new Date(x.t).toLocaleDateString("es-CO", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
      x.quien || "—",
      (ROLES_TXT[x.rol] || x.rol) !== x.quien ? ROLES_TXT[x.rol] || x.rol : "",
    ]
      .filter(Boolean)
      .join(" · ");
    z.appendChild(d);
  });
  $("lg-mas").hidden = f.length <= logMax;
}
$("lg-act").onclick = cargarLog;
$("lg-dia").onchange = () => {
  logMax = 100;
  pintarLog();
};
$("lg-staff").onchange = () => {
  logMax = 100;
  pintarLog();
};
$("lg-buscar").oninput = () => {
  logMax = 100;
  pintarLog();
};
$("lg-limpiar").onclick = () => {
  $("lg-dia").value = "";
  $("lg-staff").value = "";
  $("lg-buscar").value = "";
  logMax = 100;
  pintarLog();
};
$("lg-mas").onclick = () => {
  logMax += 100;
  pintarLog();
};
