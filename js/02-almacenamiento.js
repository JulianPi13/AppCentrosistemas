// ---- almacenamiento: base de datos compartida, o el navegador si no hay ----
const local = {
  get() {
    try {
      return JSON.parse(localStorage.getItem("taller_ordenes") || "[]");
    } catch (e) {
      return [];
    }
  },
  put(a) {
    try {
      localStorage.setItem("taller_ordenes", JSON.stringify(a));
    } catch (e) {}
  },
};

async function iniciar() {
  try {
    db = window.claude ? await window.claude.use("db") : null;
  } catch (e) {
    db = null;
  }
  let u = null;
  try {
    u = window.claude ? await window.claude.use("user") : null;
  } catch (e) {
    u = null;
  }
  try {
    esDueno = !db || (u ? !!(await u.isOwner()) : false);
  } catch (e) {
    esDueno = false;
  }
  if (!db) {
    esAdmin = true;
    sesion = { id: "admin", nombre: "Administrador" };
    $("login").hidden = true;
  }
  try {
    miId = u ? await u.id() : null;
  } catch (e) {
    miId = null;
  }
  try {
    if (db && u && !esDueno && (await u.can("data.write")) === false) {
      soloVer = true;
      $("aviso-cuenta").hidden = false;
    }
  } catch (e) {}
  aplicarRol();
  if (db) {
    db.doc("config/permisos").onSnapshot(
      (s) => {
        const d = s.exists ? s.data() : {};
        P = {
          asesor: { ...DEF, ...(d.asesor || {}) },
          tecnico: { ...DEF_TEC, ...(d.tecnico || {}) },
        };
        waAdmin = String(d.waAdmin || WA_ADMIN_DEF);
        IMP = {
          ...IMP_DEF,
          ...(d.impresora && typeof d.impresora === "object" ? d.impresora : {}),
        };
        MSG = d.mensajes && typeof d.mensajes === "object" ? d.mensajes : {};
        if (IMP.papel !== papelCfg) {
          papelCfg = IMP.papel;
          $("papel").value = String(IMP.papel) === "80" ? "80" : "58";
        }
        usuarios = Array.isArray(d.usuarios) ? d.usuarios : [];
        revisarSesion();
        aplicarRol();
        pintar();
        if (!$("admin").hidden) pintarAdmin();
      },
      () => {},
    );
  }
  if (db && esDueno) {
    db.collection("privado").onSnapshot(
      (s) => {
        gastos = {};
        s.docs.forEach((d) => {
          if (d.id.startsWith("g-")) gastos[d.id.slice(2)] = d.data().items || [];
        });
        if (!$("caja").hidden) pintarCaja();
      },
      () => {},
    );
  }
  if (db && esDueno) {
    db.doc("privado/admin").onSnapshot(
      (s) => {
        const d = s.exists ? s.data() : {};
        adminHash = d.v === 2 ? d.hash || null : null;
        adminUsuario = d.v === 2 ? d.usuario || "" : "";
        if (!$("admin").hidden) $("a-usuario").value = adminUsuario;
        adminCargado = true;
        if (!$("login").hidden) pintarLogin();
      },
      () => {
        adminCargado = true;
      },
    );
  }
  if (db) {
    db.collection("caja").onSnapshot(
      (s) => {
        cajaDocs = {};
        s.docs.forEach((d) => {
          cajaDocs[d.id] = d.data();
        });
        revisarAvisoCaja();
        try {
          pintarRCaja();
        } catch (e) {}
        if (!$("caja").hidden) pintarCaja();
      },
      () => {},
    );
  }
  if (db) {
    db.collection("productos").onSnapshot(
      (s) => {
        productos = s.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (!$("pos").hidden) pintarPos();
        if (!$("inv").hidden && invVista === "prod") pintarInv();
      },
      () => {},
    );
  }
  if (db) {
    db.collection("encargos").onSnapshot(
      (s) => {
        encargos = s.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (!$("enc").hidden) pintarEnc();
        if (!$("caja").hidden) pintarCaja();
      },
      () => {},
    );
  }
  if (db) {
    db.collection("salidas").onSnapshot(
      (s) => {
        salidasDia = {};
        s.docs.forEach((d) => {
          salidasDia[d.id] = Array.isArray(d.data().items) ? d.data().items : [];
        });
        if (!$("caja").hidden) pintarCaja();
      },
      () => {},
    );
  }
  if (db) {
    db.collection("ventas").onSnapshot(
      (s) => {
        ventasDia = {};
        s.docs.forEach((d) => {
          ventasDia[d.id] = Array.isArray(d.data().items) ? d.data().items : [];
        });
        if (!$("pos").hidden) pintarVentasHoy();
        if (!$("caja").hidden) pintarCaja();
      },
      () => {},
    );
  }
  if (db) {
    invCol = db.collection("inventario");
    invCol.onSnapshot(
      (s) => {
        inv = s.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (!$("inv").hidden) pintarInv();
        else piezasSelect();
      },
      () => {},
    );
  }
  if (db && esDueno) {
    db.collection("costos").onSnapshot(
      (s) => {
        costos = {};
        s.docs.forEach((d) => {
          costos[d.id] = +d.data().repuesto || 0;
        });
        pintar();
        if (!$("caja").hidden) pintarCaja();
      },
      () => {},
    );
  }
  if (db) {
    col = db.collection("ordenes");
    col.onSnapshot(
      (s) => {
        ordenes = s.docs.map((d) => {
          const x = { id: d.id, ...d.data() };
          if (x.estado === "diagnostico") x.estado = "recibido";
          return x;
        });
        pintar();
        if (!$("caja").hidden) pintarCaja();
      },
      (e) => {
        $("aviso").textContent = "Se perdió la conexión con los datos. Recargue la página.";
      },
    );
  } else {
    ordenes = local.get();
    pintar();
    $("aviso").textContent =
      "Modo sin conexión: los datos quedan guardados solo en este navegador.";
  }
}
async function guardarOrden(o) {
  logOrden(o);
  if (db) {
    const { id, repuesto, ...cuerpo } = o;
    await col.doc(id).set(cuerpo);
    if (esAdmin && "repuesto" in o)
      await db
        .collection("costos")
        .doc(id)
        .set({ repuesto: +repuesto || 0 });
  } else {
    const i = ordenes.findIndex((x) => x.id === o.id);
    if (i >= 0) ordenes[i] = o;
    else ordenes.push(o);
    local.put(ordenes);
    pintar();
  }
}
async function borrarOrden(id) {
  if (db) {
    await col.doc(id).delete();
    if (esAdmin) {
      try {
        await db.collection("costos").doc(id).delete();
      } catch (e) {}
    }
  } else {
    ordenes = ordenes.filter((x) => x.id !== id);
    local.put(ordenes);
    pintar();
  }
}
