// ---- pantalla principal ----
const DIAS_ATRASO = 5;
function diasAtraso(o) {
  if (o.estado !== "recibido" || (o.diag || "").trim()) return 0;
  return Math.floor((Date.now() - new Date(o.estadoDesde || o.ingreso || Date.now())) / 864e5);
}
function revisarAtrasos() {
  const a = $("aviso-atraso");
  const lst = ordenes.filter((o) => diasAtraso(o) >= DIAS_ATRASO);
  if (!sesion || !lst.length || !(perm("reportar") || perm("estados") || perm("diagnostico"))) {
    a.hidden = true;
    return;
  }
  a.hidden = false;
  $("aviso-atraso-txt").textContent =
    `⚠️ ${lst.length === 1 ? "1 equipo lleva" : lst.length + " equipos llevan"} más de ${DIAS_ATRASO} días recibido${lst.length === 1 ? "" : "s"} sin diagnóstico: ` +
    lst
      .slice(0, 3)
      .map((o) => `#${o.num} ${[o.marca, o.modelo].filter(Boolean).join(" ")}`)
      .join(", ") +
    (lst.length > 3 ? "…" : "");
}
$("aviso-atraso-btn").onclick = () => {
  if (perm("reportar") && db) {
    abrirRep();
  } else {
    filtro = "atrasados";
    pintar();
    $("lista").scrollIntoView({ block: "start", behavior: "smooth" });
  }
};
setInterval(() => {
  if (sesion) revisarAtrasos();
}, 300000);
function pintar() {
  try {
    pintarRCaja();
  } catch (e) {}
  const cont = {};
  ESTADOS.forEach((e) => (cont[e.k] = 0));
  ordenes.forEach((o) => (cont[o.estado] = (cont[o.estado] || 0) + 1));
  const encPend = encargos.filter(
      (e) => !["entregado", "cancelado"].includes(e.estado || "porpedir"),
    ),
    encUn = encPend.reduce((t, e) => t + Math.max(1, Math.round(+e.cant || 1)), 0);
  $("estados").innerHTML =
    ESTADOS.map(
      (e) =>
        `<button class="est" style="--c:var(${e.c})" data-k="${e.k}" aria-pressed="${filtro === e.k}"><b>${cont[e.k]}</b><small>${e.n}</small></button>`,
    ).join("") +
    (db && perm("encargos")
      ? `<button class="est" style="--c:var(--s-diag)" data-k="encargos" aria-pressed="false"><b>${encUn}</b><small>Encargos pendientes${encUn === 1 ? " (1 unidad)" : " (unidades)"}</small></button>`
      : "");
  const enTaller = ordenes.filter((o) => o.estado !== "entregado").length;
  const porCobrar = ordenes
    .filter((o) => o.estado !== "entregado")
    .reduce((s, o) => s + Math.max(0, (o.precio || 0) - (o.abono || 0)), 0);
  $("sub").textContent = `${enTaller} equipos en el taller · ${pesos(porCobrar)} por cobrar`;
  const q = $("buscar").value.trim().toLowerCase();
  revisarAtrasos();
  let vista =
    filtro === "encargos"
      ? []
      : ordenes.filter(
          (o) =>
            (!filtro ||
              (filtro === "atrasados" ? diasAtraso(o) >= DIAS_ATRASO : o.estado === filtro)) &&
            (!q ||
              [o.num, o.cliente, o.tel, o.marca, o.modelo, o.imei]
                .join(" ")
                .toLowerCase()
                .includes(q)),
        );
  vista.sort((a, b) => (b.ingreso || "").localeCompare(a.ingreso || ""));
  const uni = [];
  if (false)
    encargos
      .filter((e) => !["entregado", "cancelado"].includes(e.estado || "porpedir"))
      .forEach((e) => {
        if (
          q &&
          ![e.num, e.descripcion, e.cliente, e.tel, e.tipo, e.equipo, e.proveedor]
            .join(" ")
            .toLowerCase()
            .includes(q)
        )
          return;
        const n = Math.max(1, Math.round(+e.cant || 1));
        for (let i = 1; i <= n; i++) uni.push({ e, i, n });
      });
  uni.sort((a, b) => (+b.e.num || 0) - (+a.e.num || 0) || a.i - b.i);
  if (!ordenes.length && !uni.length) {
    $("lista").innerHTML =
      `<div class="vacio">Todavía no hay equipos. Toque <b>+ Recibir equipo</b> para registrar el primero.</div>`;
    return;
  }
  if (!vista.length && !uni.length) {
    $("lista").innerHTML =
      `<div class="vacio">${filtro === "encargos" ? "No hay encargos pendientes." : "No hay órdenes que coincidan."}</div>`;
    return;
  }
  $("lista").innerHTML = "";
  vista.forEach((o) => {
    const e = est(o.estado);
    const b = document.createElement("div");
    b.className = "orden";
    b.dataset.st = e.k;
    b.style.setProperty("--c", `var(${e.c})`);
    b.tabIndex = 0;
    b.setAttribute("role", "button");
    const saldo = Math.max(0, (o.precio || 0) - (o.abono || 0));
    b.innerHTML = `<span class="num"></span><span class="tit"></span><span class="chip" style="--c:var(${e.c})">${e.n}</span><span class="det"></span>`;
    if (o.estado === "listo" && perm("whatsapp")) {
      const pie = document.createElement("div");
      pie.className = "pie";
      const href = linkWA(o);
      const av = Array.isArray(o.avisos) ? o.avisos : [],
        ult = av.length ? new Date(av[av.length - 1]) : null,
        dias = ult ? Math.floor((Date.now() - ult) / 864e5) : 0;
      if (href && ult && dias < DIAS_AVISO) {
        const c = document.createElement("span");
        c.className = "avisado";
        const prox = new Date(ult.getTime() + DIAS_AVISO * 864e5);
        c.textContent = `✓ Avisado ${dias === 0 ? "hoy" : dias === 1 ? "ayer" : "hace " + dias + " días"} · próximo recordatorio el ${prox.toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short" })}`;
        pie.appendChild(c);
      } else if (href) {
        const a = document.createElement("a");
        a.className = "wa" + (ult ? " wa-rec" : "");
        a.href = href;
        a.target = "_blank";
        a.rel = "noopener";
        const listoDias = o.listoEn ? Math.floor((Date.now() - new Date(o.listoEn)) / 864e5) : null;
        a.textContent = ult
          ? `Recordar al cliente por WhatsApp (${av.length} aviso${av.length > 1 ? "s" : ""}${listoDias != null ? ", lleva " + listoDias + " días listo" : ""})`
          : "Avisar por WhatsApp que está listo";
        a.onclick = (ev) => {
          ev.stopPropagation();
          marcarAviso(o);
        };
        pie.appendChild(a);
      } else
        pie.innerHTML =
          '<span class="falta">Falta el WhatsApp del cliente. Ábrala y escríbalo para poder avisarle.</span>';
      b.appendChild(pie);
    }
    if (false && ESTADOS_AVISO.includes(o.estado) && perm("whatsapp")) {
      // el aviso de WhatsApp en el Dashboard solo sale cuando está listo para entregar
      let pie = b.querySelector(".pie");
      if (!pie) {
        pie = document.createElement("div");
        pie.className = "pie";
        b.appendChild(pie);
      }
      const href = linkWA(o);
      if (!href)
        pie.insertAdjacentHTML(
          "beforeend",
          '<span class="falta">Falta el WhatsApp del cliente para avisarle.</span>',
        );
      else if (yaAvisadoEstado(o)) {
        const c = document.createElement("span");
        c.className = "avisado";
        const d = Math.floor((Date.now() - new Date(o.avisoEstado.fecha)) / 864e5);
        c.textContent = `✓ Cliente avisado ${d === 0 ? "hoy" : d === 1 ? "ayer" : "hace " + d + " días"}: ${o.estado === "reparacion" && o.llegoRepuesto ? "llegó el repuesto" : est(o.estado).n.toLowerCase()}`;
        pie.appendChild(c);
      } else {
        const a = document.createElement("a");
        a.className = "wa";
        a.href = href;
        a.target = "_blank";
        a.rel = "noopener";
        a.textContent =
          o.estado === "sinreparacion"
            ? "Avisar que no tuvo reparación"
            : o.estado === "repuesto"
              ? "Avisar que se encarga el repuesto"
              : o.estado === "reparacion" && o.llegoRepuesto
                ? "Avisar que llegó el repuesto"
                : o.estado === "reparacion"
                  ? "Avisar que está en reparación"
                  : "Avisar que está en diagnóstico";
        a.onclick = (ev) => {
          ev.stopPropagation();
          marcarAvisoEstado(o);
        };
        pie.appendChild(a);
      }
    }
    if ((o.estado === "listo" || o.estado === "sinreparacion") && perm("entregar") && db) {
      let pie = b.querySelector(".pie");
      if (!pie) {
        pie = document.createElement("div");
        pie.className = "pie";
        b.appendChild(pie);
      }
      const e = document.createElement("button");
      e.type = "button";
      e.className = "btn-entregar";
      e.textContent = "Entregar";
      e.onclick = (ev) => {
        ev.stopPropagation();
        abrirEntrega(o.id);
      };
      pie.appendChild(e);
    }
    b.onkeydown = (ev) => {
      if (ev.key === "Enter" && ev.target === b) abrir(o);
    };
    b.querySelector(".num").textContent = "#" + (o.num || "—");
    b.querySelector(".tit").textContent =
      `${o.tipo && o.tipo !== "Celular" ? o.tipo + " · " : ""}${o.marca || ""} ${o.modelo || ""} · ${o.cliente || ""}`;
    if (o.ingreso) {
      const f = new Date(o.ingreso);
      if (!isNaN(f)) {
        const sp = document.createElement("span");
        sp.className = "ing";
        sp.textContent =
          "Ingresó " + cuandoTxt(f) + (o.recibidoPor ? " · Recibió: " + o.recibidoPor : "");
        b.querySelector(".tit").appendChild(sp);
      }
    }
    {
      const da = diasAtraso(o);
      if (da >= DIAS_ATRASO) {
        b.classList.add("atrasado");
        b.querySelector(".tit").insertAdjacentHTML(
          "beforeend",
          `<span class="atraso">${da} días sin revisar</span>`,
        );
      }
    }
    if (o.ejemplo)
      b.querySelector(".tit").insertAdjacentHTML("beforeend", '<span class="ej">ejemplo</span>');
    const nf = Array.isArray(o.fotos) ? o.fotos.length : 0;
    b.querySelector(".det").textContent =
      `${o.falla || ""} — Entró ${diaRel(o.ingreso)}${nf ? " · " + nf + (nf === 1 ? " foto" : " fotos") : ""}${o.entrega ? " · Prometido " + fecha(o.entrega) : ""}${o.estado === "entregado" ? (saldo ? " · Debe " + pesos(saldo) : "") : " · " + estadoPago(o).txt}`;
    b.onclick = () => abrir(o);
    $("lista").appendChild(b);
  });
  uni.forEach(({ e, i, n }) => {
    const es = ENC_EST.find((x) => x[0] === (e.estado || "porpedir")) || ENC_EST[0],
      pg = encPagoTxt(e);
    const b = document.createElement("div");
    b.className = "orden";
    b.dataset.st = "encargo";
    b.style.setProperty("--c", `var(${es[2]})`);
    b.tabIndex = 0;
    b.setAttribute("role", "button");
    b.innerHTML =
      '<span class="num"></span><span class="tit"></span><span class="chip"></span><span class="det"></span>';
    b.querySelector(".num").textContent = "E" + e.num;
    b.querySelector(".tit").textContent =
      `${e.descripcion || "Encargo"}${n > 1 ? ` (unidad ${i} de ${n})` : ""}${e.cliente ? " · " + e.cliente : ""}`;
    b.querySelector(".chip").style.setProperty("--c", `var(${es[2]})`);
    b.querySelector(".chip").textContent = "Encargo · " + es[1];
    b.querySelector(".det").textContent = [
      e.tipo,
      e.equipo ? "Equipo: " + e.equipo : "",
      e.proveedor ? "Cotizado con " + e.proveedor : "",
      e.fecha ? "Pedido " + fecha(e.fecha) : "",
      +e.precio ? pesos(e.precio) + (n > 1 ? " en total" : "") : "Sin precio",
      pg.t,
    ]
      .filter(Boolean)
      .join(" · ");
    b.onclick = () => {
      $("fondo").hidden = false;
      $("enc").hidden = false;
      pintarEnc();
      abrirEnc(e.id);
    };
    b.onkeydown = (ev) => {
      if (ev.key === "Enter") b.onclick();
    };
    $("lista").appendChild(b);
  });
}
function diaRel(f) {
  if (!f) return "—";
  const d = new Date(f.length === 10 ? f + "T12:00" : f);
  if (isNaN(d)) return "—";
  const k = diaDe(d.toISOString()),
    h = hoyStr(),
    a = diaDe(new Date(Date.now() - 864e5).toISOString());
  return k === h ? "hoy" : k === a ? "ayer" : fecha(f);
}
function cuandoTxt(d) {
  const r = diaRel(d.toISOString()),
    hr = d.toLocaleTimeString("es-CO", {
      timeZone: "America/Bogota",
      hour: "numeric",
      minute: "2-digit",
    });
  return r === "hoy" || r === "ayer"
    ? r + ", " + hr
    : d.toLocaleString("es-CO", {
        timeZone: "America/Bogota",
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      });
}
const fecha = (f) => {
  if (!f) return "—";
  const d = new Date(f.length === 10 ? f + "T12:00" : f);
  return d.toLocaleDateString("es-CO", { day: "numeric", month: "short" });
};
$("estados").onclick = (ev) => {
  const b = ev.target.closest(".est");
  if (!b) return;
  if (b.dataset.k === "encargos") {
    $("btn-enc").click();
    return;
  }
  filtro = filtro === b.dataset.k ? null : b.dataset.k;
  pintar();
};
$("buscar").oninput = pintar;
