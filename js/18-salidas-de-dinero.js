// ---- salidas de dinero (gastos con plata de la caja) ----
let salidasDia = {},
  salFoto = null;
function pintarSalidas(dia, r) {
  const g = $("c-sal-g"),
    puede = db && perm("caja") && rolActual() !== "consulta";
  g.hidden = !puede && !r.sal.length;
  const hoy = dia === hoyStr(),
    cerrada = cajaDocs[dia] && cajaDocs[dia].cierre;
  $("c-sal-form").hidden = !(puede && (esAdmin || (hoy && !cerrada)));
  $("c-sal-t").textContent =
    "Salidas de dinero de la caja" + (r.salTot ? " · " + pesos(r.salTot) : "");
  const c = $("c-sal");
  c.innerHTML = "";
  if (!r.sal.length) {
    c.innerHTML = '<p class="aviso" style="margin:0">No hubo salidas este día.</p>';
    return;
  }
  r.sal
    .slice()
    .sort((a, b) => String(a.hora).localeCompare(String(b.hora)))
    .forEach((x) => {
      const d = document.createElement("div");
      d.className = "mov";
      d.innerHTML = '<span></span><b class="neg"></b><small></small>';
      d.querySelector("span").textContent = x.concepto;
      d.querySelector("b").textContent = "− " + pesos(x.valor);
      const sm = d.querySelector("small");
      sm.textContent = [hora(x.hora), x.quien].filter(Boolean).join(" · ") + " ";
      if (x.foto) {
        const v = document.createElement("button");
        v.type = "button";
        v.textContent = "Ver factura";
        v.style.cssText = "padding:2px 8px;font-size:.78rem";
        v.onclick = () => verFoto(x.foto);
        sm.appendChild(v);
      }
      if (esAdmin) {
        const q = document.createElement("button");
        q.type = "button";
        q.className = "btn-danger";
        q.textContent = "Quitar";
        q.style.cssText = "padding:2px 8px;font-size:.78rem;margin-left:4px";
        q.onclick = async () => {
          if (!q.dataset.ok) {
            q.dataset.ok = "1";
            q.textContent = "¿Seguro? Quitar";
            return;
          }
          try {
            await cambiarDia(
              db.doc("salidas/" + x.dia),
              (it) => it.filter((y) => y.id !== x.id),
              (it) => !it.some((y) => y.id === x.id),
            );
            {
              const item = { ...x };
              delete item.dia;
              logAccion("Salida quitada", x.concepto + " · " + pesos(x.valor));
              ofrecerDeshacer(
                "Salida de " + pesos(x.valor) + " quitada",
                async () => {
                  await cambiarDia(
                    db.doc("salidas/" + x.dia),
                    (it) => (it.some((y) => y.id === item.id) ? it : it.concat([item])),
                    (it) => it.some((y) => y.id === item.id),
                  );
                },
                () => {
                  if (x.foto) borrarFoto(x.foto);
                },
              );
            }
          } catch (e) {
            $("caja-msg").textContent = "No se pudo quitar la salida.";
          }
        };
        sm.appendChild(q);
      }
      c.appendChild(d);
    });
}
$("s-foto").onchange = async (ev) => {
  const f = ev.target.files && ev.target.files[0];
  ev.target.value = "";
  if (!f) return;
  $("s-foto-ok").textContent = "Subiendo foto…";
  try {
    if (salFoto) borrarFoto(salFoto);
    salFoto = await subirBlobFoto(f);
    $("s-foto-ok").textContent = "✓ Factura adjunta";
  } catch (e) {
    $("s-foto-ok").textContent = errFoto(e);
  }
};
$("s-agregar").onclick = async () => {
  const concepto = $("s-concepto").value.trim(),
    valor = Math.round(+$("s-valor").value || 0);
  if (!concepto) {
    $("caja-msg").textContent = "Escriba en qué se gastó la plata.";
    $("s-concepto").focus();
    return;
  }
  if (valor <= 0) {
    $("caja-msg").textContent = "Escriba el valor de la salida.";
    $("s-valor").focus();
    return;
  }
  const dia = $("c-fecha").value,
    item = {
      id: "s" + Date.now().toString(36),
      concepto,
      valor,
      hora: new Date().toISOString(),
      quien: sesion ? sesion.nombre : "",
    };
  if (salFoto) item.foto = salFoto;
  const b = $("s-agregar");
  b.disabled = true;
  $("caja-msg").textContent = "Registrando salida…";
  try {
    await cambiarDia(
      db.doc("salidas/" + dia),
      (it) => it.concat([item]),
      (it) => it.some((y) => y.id === item.id),
    );
    logAccion("Salida de caja", `${concepto} · ${pesos(valor)} (${dia})`);
    $("s-concepto").value = "";
    $("s-valor").value = "";
    salFoto = null;
    $("s-foto-ok").textContent = "";
    $("caja-msg").textContent =
      `Salida registrada: ${concepto} · ${pesos(valor)}. Se restó del efectivo de la caja.`;
  } catch (e) {
    $("caja-msg").textContent =
      e && e.code === "invalid_argument"
        ? "Esta cuenta no tiene permiso para registrar salidas."
        : "No se pudo registrar la salida. Revise la conexión.";
  }
  b.disabled = false;
};
