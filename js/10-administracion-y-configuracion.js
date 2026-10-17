// ---- menú de administración ----
const PERMS = [
  ["vender", "Vender productos en el mostrador"],
  ["encargos", "Hacer y ver encargos de repuestos y accesorios"],
  ["recibir", "Recibir equipos nuevos (a mano o con foto)"],
  ["entregar", "Entregar equipos y cerrar órdenes"],
  ["diagnostico", "Escribir el diagnóstico, el trabajo hecho y el técnico"],
  ["editarDatos", "Corregir datos del cliente y del equipo"],
  ["fotos", "Tomar y quitar fotos del equipo"],
  ["estados", "Cambiar el estado de la reparación"],
  ["cobros", "Poner el valor y registrar abonos"],
  ["bajar", "Bajar o borrar valores ya registrados"],
  ["whatsapp", "Avisar al cliente por WhatsApp"],
  ["inventario", "Registrar entradas de repuestos al inventario"],
  ["reportar", "Reportar reparación (con foto o nota)"],
  ["caja", "Ver la caja diaria (solo ventas; sin gastos ni utilidad)"],
  ["eliminar", "Eliminar órdenes"],
];
$("btn-admin").onclick = () => {
  $("fondo").hidden = false;
  $("admin").hidden = false;
  $("a-usuario").value = adminUsuario;
  $("a-wa").value = waAdmin;
  $("admin-msg").textContent = "";
  pestana("staff");
  cargarConf();
  pintarAdmin();
};
$("admin-cerrar").onclick = cerrar;
// ---- configuración: formato de impresora y mensajes de WhatsApp ----
function pestana(x) {
  $("ad-staff").hidden = x !== "staff";
  $("ad-conf").hidden = x !== "conf";
  $("ad-log").hidden = x !== "log";
  $("tab-staff").className = x === "staff" ? "btn-main" : "";
  $("tab-conf").className = x === "conf" ? "btn-main" : "";
  $("tab-log").className = x === "log" ? "btn-main" : "";
  if (x === "log") cargarLog();
}
$("tab-staff").onclick = () => pestana("staff");
$("tab-conf").onclick = () => pestana("conf");
$("tab-log").onclick = () => pestana("log");
let mBor = {};
function cargarConf() {
  $("i-papel").value = String(IMP.papel) === "80" ? "80" : "58";
  $("i-gar").value = garDef();
  $("i-nombre").value = IMP.nombre || "";
  $("i-sub").value = IMP.sub || "";
  $("i-pie1").value = IMP.pieIngreso || "";
  $("i-pie2").value = IMP.pieEntrega || "";
  $("i-nocubre").value = listaNoCubre().join("\n");
  $("i-logo").checked = !!IMP.logo;
  $("i-firma").checked = !!IMP.firma;
  $("m-asesor").value = String(MSG.asesor || "Jonier");
  mBor = { saludo: msgTpl("saludo") };
  MSG_TIPOS.forEach(([k]) => {
    mBor[k] = msgTpl(k);
  });
  $("m-saludo").value = mBor.saludo;
  const sel = $("m-tipo");
  if (!sel.options.length)
    MSG_TIPOS.forEach(([k, n]) => {
      const o = document.createElement("option");
      o.value = k;
      o.textContent = n;
      sel.appendChild(o);
    });
  $("m-texto").value = mBor[sel.value];
  prevMsg();
}
function leerImp() {
  const g = +$("i-gar").value;
  return {
    papel: $("i-papel").value,
    nombre: $("i-nombre").value.trim() || IMP_DEF.nombre,
    sub: $("i-sub").value.trim(),
    pieIngreso: $("i-pie1").value.trim(),
    pieEntrega: $("i-pie2").value.trim(),
    nocubre: $("i-nocubre").value,
    garantia: g >= 0 && g <= 365 ? Math.round(g) : 15,
    logo: $("i-logo").checked,
    firma: $("i-firma").checked,
  };
}
$("i-guardar").onclick = async () => {
  IMP = { ...IMP, ...leerImp() };
  papelCfg = IMP.papel;
  $("papel").value = IMP.papel;
  await guardarPermisos({ impresora: IMP });
};
$("i-prueba").onclick = async () => {
  if (!dl) {
    $("admin-msg").textContent = "Aquí no se puede guardar el recibo de ejemplo.";
    return;
  }
  const ant = IMP;
  IMP = { ...IMP, ...leerImp() };
  let b1, b2;
  const ancho = +IMP.papel || 58;
  const ej = {
    num: "1001",
    cliente: "María Pérez",
    tel: "3001234567",
    marca: "Samsung",
    modelo: "Galaxy A10",
    falla: "No carga",
    diag: "Cambio del pin de carga",
    precio: 80000,
    abono: 30000,
    ingreso: new Date().toISOString(),
    entrega: new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10),
    garantia: +IMP.garantia || 15,
  };
  try {
    b1 = reciboPDF(ej, ancho);
  } catch (e) {
    b1 = null;
  } finally {
    IMP = ant;
  }
  if (!b1) {
    $("admin-msg").textContent = "No se pudo preparar el recibo de ejemplo.";
    return;
  }
  try {
    await dl.save({ filename: "recibo-ejemplo.pdf", data: b1 });
    $("admin-msg").textContent = "Recibo de ejemplo guardado. Ábralo para ver cómo queda.";
  } catch (e) {
    $("admin-msg").textContent =
      e && e.code === "declined"
        ? "No se guardó el recibo de ejemplo."
        : "No se pudo guardar el recibo de ejemplo.";
  }
};
function prevMsg() {
  const k = $("m-tipo").value;
  const ej = {
    num: "1001",
    cliente: "María Pérez",
    marca: "Samsung",
    modelo: "Galaxy A10",
    falla: "No carga",
    diag: "Cambio del pin de carga",
    precio: 80000,
    abono: 30000,
    ingreso: new Date().toISOString(),
    entrega: new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10),
    listoEn: new Date(Date.now() - 3 * 864e5).toISOString(),
    estado:
      k === "listo_recordatorio"
        ? "listo"
        : k === "repuesto_llego"
          ? "reparacion"
          : k === "entregado_sin"
            ? "entregado"
            : k === "otro"
              ? "recibido"
              : k,
  };
  try {
    $("m-prev").textContent = textoWA(ej, k, {
      asesor: $("m-asesor").value.trim() || "Jonier",
      descripcion: "Pantalla original Samsung A10",
      cantidad: "1",
      proveedor: "Tienda de ejemplo",
      __saludo: $("m-saludo").value,
      __cuerpo: $("m-texto").value,
    });
  } catch (e) {
    $("m-prev").textContent = "";
  }
}
$("m-tipo").onchange = () => {
  $("m-texto").value = mBor[$("m-tipo").value];
  prevMsg();
};
$("m-texto").oninput = () => {
  mBor[$("m-tipo").value] = $("m-texto").value;
  prevMsg();
};
$("m-saludo").oninput = prevMsg;
$("m-asesor").oninput = prevMsg;
$("m-orig").onclick = () => {
  const k = $("m-tipo").value;
  mBor[k] = MSG_DEF[k];
  $("m-texto").value = MSG_DEF[k];
  prevMsg();
  $("admin-msg").textContent = "Texto original puesto. Toque Guardar mensajes para dejarlo así.";
};
$("m-guardar").onclick = async () => {
  const nuevo = {};
  const asesor = $("m-asesor").value.trim();
  if (asesor && asesor !== "Jonier") nuevo.asesor = asesor;
  mBor.saludo = $("m-saludo").value;
  ["saludo", ...MSG_TIPOS.map((x) => x[0])].forEach((k) => {
    const t = String(mBor[k] || "").trim();
    if (t && t !== MSG_DEF[k]) nuevo[k] = t;
  });
  MSG = nuevo;
  await guardarPermisos({ mensajes: MSG });
};

async function pintarAdmin() {
  [
    ["asesor", "perms"],
    ["tecnico", "perms-tec"],
  ].forEach(([rol, cont]) => {
    $(cont).innerHTML = "";
    PERMS.forEach(([k, n]) => {
      const l = document.createElement("label");
      l.className = "toggle";
      const c = document.createElement("input");
      c.type = "checkbox";
      c.id = "p-" + rol + "-" + k;
      c.checked = !!P[rol][k];
      c.onchange = () => guardarPermisos({ [rol]: { ...P[rol], [k]: c.checked } });
      const s = document.createElement("span");
      s.textContent = n;
      l.append(c, s);
      $(cont).appendChild(l);
    });
  });
  const lista = $("usuarios-lista");
  if (!usuarios.length) {
    lista.innerHTML =
      '<p class="aviso" style="margin:0">Todavía no hay usuarios. Cree el del asesor aquí abajo.</p>';
    return;
  }
  lista.innerHTML = "";
  usuarios.forEach((us) => {
    const f = document.createElement("div");
    f.className = "u-fila";
    const n = document.createElement("span");
    n.textContent = us.nombre + (us.usuario ? "  ·  usuario: " + us.usuario : "");
    const sel = document.createElement("select");
    sel.id = "urol-" + us.id;
    sel.setAttribute("aria-label", "Rol de " + us.nombre);
    sel.innerHTML =
      '<option value="asesor">Asesor de ventas</option><option value="tecnico">Técnico</option><option value="consulta">Solo consulta</option>';
    sel.value = us.rol || "asesor";
    sel.onchange = () =>
      guardarPermisos({
        usuarios: usuarios.map((x) => (x.id === us.id ? { ...x, rol: sel.value } : x)),
      });
    const us2 = document.createElement("input");
    us2.placeholder = "Usuario";
    us2.value = us.usuario || "";
    us2.id = "uusr-" + us.id;
    us2.autocapitalize = "none";
    us2.spellcheck = false;
    us2.setAttribute("aria-label", "Usuario de " + us.nombre);
    const pin = document.createElement("input");
    pin.type = "password";
    pin.placeholder = "Contraseña nueva";
    pin.id = "upin-" + us.id;
    pin.autocomplete = "new-password";
    pin.setAttribute("aria-label", "Contraseña nueva para " + us.nombre);
    const cp = document.createElement("button");
    cp.type = "button";
    cp.textContent = "Guardar acceso";
    cp.onclick = async () => {
      const u = normUsr(us2.value),
        v = pin.value;
      const e1 = errUsr(u, us.id);
      if (e1) {
        $("admin-msg").textContent = e1;
        return;
      }
      if (!v && us.v === 2) {
        guardarPermisos({
          usuarios: usuarios.map((x) => (x.id === us.id ? { ...x, usuario: u } : x)),
        });
        return;
      }
      const e2 = errClave(v);
      if (e2) {
        $("admin-msg").textContent = e2;
        return;
      }
      const h = await hashClave(us.id, v);
      guardarPermisos({
        usuarios: usuarios.map((x) => (x.id === us.id ? { ...x, usuario: u, hash: h, v: 2 } : x)),
      });
      pin.value = "";
    };
    const del = document.createElement("button");
    del.type = "button";
    del.className = "btn-danger";
    del.textContent = "Eliminar";
    del.onclick = () => {
      if (del.dataset.ok) {
        const u0 = { ...us };
        guardarPermisos({ usuarios: usuarios.filter((x) => x.id !== us.id) });
        ofrecerDeshacer("Usuario " + (u0.nombre || "") + " eliminado", () =>
          guardarPermisos({ usuarios: [...usuarios.filter((x) => x.id !== u0.id), u0] }),
        );
      } else {
        del.dataset.ok = "1";
        del.textContent = "¿Seguro? Eliminar";
      }
    };
    f.append(n, sel, us2, pin, cp, del);
    if (us.v !== 2) {
      const w = document.createElement("span");
      w.className = "falta";
      w.style.flexBasis = "100%";
      w.textContent =
        "Este usuario tenía PIN. Póngale usuario y contraseña nueva para que pueda entrar.";
      f.appendChild(w);
    }
    lista.appendChild(f);
  });
}
const normUsr = (v) =>
  String(v || "")
    .trim()
    .toLowerCase();
function errUsr(u, id) {
  if (!/^[a-z0-9._-]{3,20}$/.test(u))
    return "El usuario debe tener de 3 a 20 letras o números, sin espacios.";
  if (u === adminUsuario || usuarios.some((x) => x.id !== id && x.usuario === u))
    return "Ese usuario ya existe. Escoja otro.";
  return "";
}
function errClave(v) {
  if (!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(v || ""))
    return "La contraseña debe tener mínimo 8 caracteres, con letras y números.";
  return "";
}
$("u-crear").onclick = async () => {
  const nombre = $("u-nombre").value.trim(),
    u = normUsr($("u-usuario").value),
    v = $("u-pin").value;
  if (!nombre) {
    $("admin-msg").textContent = "Escriba el nombre de la persona.";
    return;
  }
  const e1 = errUsr(u, null);
  if (e1) {
    $("admin-msg").textContent = e1;
    return;
  }
  const e2 = errClave(v);
  if (e2) {
    $("admin-msg").textContent = e2;
    return;
  }
  const id = "u" + Date.now().toString(36);
  const h = await hashClave(id, v);
  await guardarPermisos({
    usuarios: usuarios.concat([{ id, nombre, usuario: u, rol: $("u-rol").value, hash: h, v: 2 }]),
  });
  $("u-nombre").value = "";
  $("u-usuario").value = "";
  $("u-pin").value = "";
};
$("a-cambiar").onclick = async () => {
  const u = normUsr($("a-usuario").value),
    v = $("a-pin").value;
  if (!/^[a-z0-9._-]{3,20}$/.test(u)) {
    $("admin-msg").textContent = "Su usuario debe tener de 3 a 20 letras o números, sin espacios.";
    return;
  }
  if (usuarios.some((x) => x.usuario === u)) {
    $("admin-msg").textContent = "Ese usuario ya lo tiene otra persona.";
    return;
  }
  const e2 = errClave(v);
  if (e2) {
    $("admin-msg").textContent = e2;
    return;
  }
  try {
    await db.doc("privado/admin").set({ usuario: u, hash: await hashClave("admin", v), v: 2 });
    $("a-pin").value = "";
    $("admin-msg").textContent = "Su acceso de administrador quedó guardado.";
  } catch (e) {
    $("admin-msg").textContent = "No se pudo guardar su acceso.";
  }
};
async function guardarPermisos(cambio) {
  $("admin-msg").textContent = "Guardando…";
  logPermisos(cambio);
  try {
    await db
      .doc("config/permisos")
      .set({
        asesor: P.asesor,
        tecnico: P.tecnico,
        waAdmin,
        usuarios,
        impresora: IMP,
        mensajes: MSG,
        ...cambio,
      });
    $("admin-msg").textContent = "Guardado. Se aplica de inmediato.";
  } catch (e) {
    $("admin-msg").textContent = "No se pudo guardar. Revise la conexión e intente otra vez.";
  }
}
