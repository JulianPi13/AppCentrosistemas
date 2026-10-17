// ---- Deshacer (borrados que se pueden recuperar) ----
const deshacerPila = [];
let deshacerT = null;
function pintarDeshacer() {
  const b = $("deshacer-bar");
  if (!deshacerPila.length) {
    b.hidden = true;
    clearTimeout(deshacerT);
    return;
  }
  const u = deshacerPila[deshacerPila.length - 1];
  b.hidden = false;
  $("deshacer-ok").hidden = false;
  $("deshacer-ok").disabled = false;
  $("deshacer-txt").textContent =
    u.texto + (deshacerPila.length > 1 ? ` · (${deshacerPila.length - 1} más antes)` : "");
  clearTimeout(deshacerT);
  deshacerT = setTimeout(descartarDeshacer, 300000);
}
function ofrecerDeshacer(texto, restaurar, fin) {
  deshacerPila.push({ texto, restaurar, fin });
  while (deshacerPila.length > 8) {
    const v = deshacerPila.shift();
    try {
      v.fin && v.fin();
    } catch (e) {}
  }
  pintarDeshacer();
}
function descartarDeshacer() {
  while (deshacerPila.length) {
    const u = deshacerPila.pop();
    try {
      u.fin && u.fin();
    } catch (e) {}
  }
  pintarDeshacer();
}
$("deshacer-x").onclick = descartarDeshacer;
$("deshacer-ok").onclick = async () => {
  const u = deshacerPila.pop();
  if (!u) return;
  $("deshacer-ok").disabled = true;
  try {
    await u.restaurar();
    logAccion("Deshacer", u.texto);
    $("deshacer-txt").textContent =
      "Listo: se recuperó. " + u.texto.replace(/ (eliminad[oa]|quitad[oa])$/, "");
    $("deshacer-ok").hidden = true;
    setTimeout(pintarDeshacer, 2500);
  } catch (e) {
    deshacerPila.push(u);
    $("deshacer-txt").textContent = "No se pudo deshacer. Revise la conexión.";
    setTimeout(pintarDeshacer, 3000);
  }
};
async function borrarConDeshacer(col, id, doc, texto) {
  const copia = JSON.parse(JSON.stringify(doc));
  delete copia.id;
  await db.doc(col + "/" + id).delete();
  logAccion("Eliminado", texto);
  ofrecerDeshacer(texto + " eliminado", async () => {
    await db.doc(col + "/" + id).set(copia);
  });
}
