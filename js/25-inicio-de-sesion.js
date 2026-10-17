// ---- inicio de sesión ----
const SKEY = "centro_sesion";
async function hashClave(id, clave) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(clave), "PBKDF2", false, [
    "deriveBits",
  ]);
  const b = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: new TextEncoder().encode("centrosistemas:" + id),
      iterations: 150000,
    },
    k,
    256,
  );
  return Array.from(new Uint8Array(b))
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
async function hashPin(id, pin) {
  const b = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode("centrosistemas:" + id + ":" + pin),
  );
  return Array.from(new Uint8Array(b))
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
function leerSesion() {
  try {
    return JSON.parse(localStorage.getItem(SKEY) || "null");
  } catch (e) {
    return null;
  }
}
function guardarSesion(s) {
  try {
    if (s) localStorage.setItem(SKEY, JSON.stringify(s));
    else localStorage.removeItem(SKEY);
  } catch (e) {}
}
const SES_MAX = 2 * 864e5;
const sesionVencida = (s) => !!(s && s.t && Date.now() - s.t > SES_MAX);
async function ipPublica() {
  for (const u of ["https://api.ipify.org?format=json", "https://api64.ipify.org?format=json"]) {
    try {
      const c = new AbortController(),
        tm = setTimeout(() => c.abort(), 4000);
      const r = await fetch(u, { signal: c.signal, cache: "no-store" });
      clearTimeout(tm);
      const j = await r.json();
      if (j && typeof j.ip === "string" && /^[0-9a-fA-F:.]{7,45}$/.test(j.ip)) return j.ip;
    } catch (e) {}
  }
  return null;
}
function avisoLogin(t) {
  const m = $("l-msg");
  if (m) m.textContent = t;
}
function sesionValida(s) {
  if (!s || !s.id || s.v !== 2 || sesionVencida(s)) return false;
  if (s.id === "admin") return esDueno;
  return usuarios.some((u) => u.id === s.id && u.v === 2);
}
function entrar(s0) {
  const s = { ...s0, t: s0.t || Date.now() };
  sesion = s;
  if (!s0.t) logAccion("Inició sesión", "");
  esAdmin = s.id === "admin" && esDueno;
  guardarSesion(s);
  ipPublica().then((ip) => {
    if (!ip || !sesion || sesion.id !== s.id) return;
    if (s.ip && s.ip !== ip) {
      salir();
      avisoLogin("Su conexión a internet cambió. Por seguridad, entre de nuevo.");
      return;
    }
    if (!sesion.ip) {
      sesion = { ...sesion, ip };
      guardarSesion(sesion);
    }
  });
  $("login").hidden = true;
  aplicarRol();
  pintar();
  revisarAvisoCaja();
  if (!$("inv").hidden) pintarInv();
}
function salir() {
  if (sesion) logAccion("Cerró sesión", "");
  descartarDeshacer();
  sesion = null;
  esAdmin = false;
  guardarSesion(null);
  cerrar();
  aplicarRol();
  revisarAvisoCaja();
  pintarLogin();
  $("login").hidden = false;
}
function revisarSesion() {
  configCargada = true;
  if (sesion) {
    if (!sesionValida(sesion)) salir();
    else {
      const u = usuarios.find((x) => x.id === sesion.id);
      if (u && u.nombre !== sesion.nombre) {
        sesion = { ...sesion, nombre: u.nombre };
        guardarSesion(sesion);
      }
    }
    return;
  }
  const s = leerSesion();
  if (sesionValida(s)) entrar(s);
  else {
    pintarLogin();
    if (s && sesionVencida(s)) {
      guardarSesion(null);
      avisoLogin("Pasaron más de 2 días. Por seguridad, entre de nuevo.");
    }
  }
}
$("salir").onclick = salir;
function pintarLogin() {
  const c = $("login-cuerpo");
  if (!configCargada || (esDueno && !adminCargado)) {
    c.innerHTML = '<p class="aviso" style="margin:0">Cargando…</p>';
    return;
  }
  if (esDueno && !adminHash) {
    c.innerHTML =
      '<p style="margin:0"><b>Configure su acceso de administrador.</b></p><p class="aviso" style="margin:0">Escoja un usuario y una contraseña de mínimo 8 caracteres, con letras y números.</p><form id="l-form" class="login-form" autocomplete="off"><label class="campo"><span class="lbl">Usuario</span><input id="l-usr" autocapitalize="none" spellcheck="false" autocomplete="username"></label><label class="campo"><span class="lbl">Contraseña</span><input id="l-pin" type="password" autocomplete="new-password"></label><label class="campo"><span class="lbl">Repita la contraseña</span><input id="l-pin2" type="password" autocomplete="new-password"></label><button class="btn-main" type="submit">Guardar y entrar</button><p class="aviso" id="l-msg" role="status" style="margin:0"></p></form>';
    $("l-form").onsubmit = async (ev) => {
      ev.preventDefault();
      const u = normUsr($("l-usr").value),
        v = $("l-pin").value;
      if (!/^[a-z0-9._-]{3,20}$/.test(u)) {
        $("l-msg").textContent = "El usuario debe tener de 3 a 20 letras o números, sin espacios.";
        return;
      }
      if (usuarios.some((x) => x.usuario === u)) {
        $("l-msg").textContent = "Ese usuario ya lo tiene otra persona.";
        return;
      }
      const e = errClave(v);
      if (e) {
        $("l-msg").textContent = e;
        return;
      }
      if (v !== $("l-pin2").value) {
        $("l-msg").textContent = "Las dos contraseñas no coinciden.";
        return;
      }
      try {
        await db.doc("privado/admin").set({ usuario: u, hash: await hashClave("admin", v), v: 2 });
        entrar({ id: "admin", nombre: "Administrador", v: 2 });
      } catch (e) {
        $("l-msg").textContent = "No se pudo guardar. Revise la conexión.";
      }
    };
    return;
  }
  c.innerHTML =
    '<form id="l-form" class="login-form" autocomplete="on"><label class="campo"><span class="lbl">Usuario</span><input id="l-usr" autocapitalize="none" spellcheck="false" autocomplete="username"></label><label class="campo"><span class="lbl">Contraseña</span><input id="l-pin" type="password" autocomplete="current-password"></label><button class="btn-main" type="submit" id="l-entrar">Entrar</button><p class="aviso" id="l-msg" role="status" style="margin:0"></p></form>';
  $("l-form").onsubmit = async (ev) => {
    ev.preventDefault();
    const espera = bloqueoRestante();
    if (espera) {
      $("l-msg").textContent = `Demasiados intentos. Espere ${espera} segundos.`;
      return;
    }
    const u = normUsr($("l-usr").value),
      v = $("l-pin").value;
    if (!u || !v) {
      $("l-msg").textContent = "Escriba su usuario y su contraseña.";
      return;
    }
    $("l-entrar").disabled = true;
    $("l-msg").textContent = "Verificando…";
    let ok = null;
    if (esDueno && u === adminUsuario && (await hashClave("admin", v)) === adminHash)
      ok = { id: "admin", nombre: "Administrador", v: 2 };
    else {
      const o = usuarios.find((x) => x.usuario === u && x.v === 2);
      if (o && (await hashClave(o.id, v)) === o.hash) ok = { id: o.id, nombre: o.nombre, v: 2 };
    }
    $("l-entrar").disabled = false;
    if (ok) {
      fallos = 0;
      guardarFallos();
      entrar(ok);
    } else {
      fallos++;
      if (fallos >= 5) {
        bloqueoHasta = Date.now() + 60000;
        fallos = 0;
      }
      guardarFallos();
      $("l-msg").textContent = bloqueoRestante()
        ? "Demasiados intentos. Espere 60 segundos."
        : "Usuario o contraseña incorrectos.";
      $("l-pin").value = "";
      $("l-pin").focus();
    }
  };
}
let fallos = 0,
  bloqueoHasta = 0;
try {
  const f = JSON.parse(localStorage.getItem("centro_fallos") || "{}");
  fallos = +f.n || 0;
  bloqueoHasta = +f.h || 0;
} catch (e) {}
function guardarFallos() {
  try {
    localStorage.setItem("centro_fallos", JSON.stringify({ n: fallos, h: bloqueoHasta }));
  } catch (e) {}
}
function bloqueoRestante() {
  return Math.max(0, Math.ceil((bloqueoHasta - Date.now()) / 1000));
}

iniciar();
