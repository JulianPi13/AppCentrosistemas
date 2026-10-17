const ESTADOS = [
  { k: "recibido", n: "Recibido", c: "--s-rec" },
  { k: "repuesto", n: "Esperando repuesto", c: "--s-rep" },
  { k: "reparacion", n: "En reparación", c: "--s-arr" },
  { k: "listo", n: "Listo para entregar", c: "--s-listo" },
  { k: "sinreparacion", n: "No tuvo reparación", c: "--s-sin" },
  { k: "entregado", n: "Entregado", c: "--s-ent" },
];
const $ = (id) => document.getElementById(id);
const pesos = (n) => "$ " + Math.round(Number(n) || 0).toLocaleString("es-CO");
const est = (k) => ESTADOS.find((e) => e.k === k) || ESTADOS[0];
let ordenes = [],
  filtro = null,
  editando = null,
  db = null,
  col = null,
  costos = {},
  esAdmin = false;
const DEF = {
  encargos: true,
  recibir: true,
  editarDatos: true,
  fotos: true,
  estados: true,
  cobros: true,
  bajar: false,
  whatsapp: true,
  eliminar: false,
  inventario: false,
  caja: true,
  reportar: false,
  entregar: true,
  diagnostico: true,
  vender: true,
};
const DEF_TEC = {
  encargos: true,
  vender: false,
  recibir: true,
  editarDatos: false,
  fotos: true,
  estados: true,
  cobros: false,
  bajar: false,
  whatsapp: false,
  eliminar: false,
  inventario: false,
  caja: false,
  reportar: true,
  entregar: false,
  diagnostico: true,
};
let P = { asesor: { ...DEF }, tecnico: { ...DEF_TEC } },
  miId = null,
  fotoOk = false,
  patBloq = false,
  usuarios = [],
  esDueno = false,
  sesion = null,
  adminHash = null,
  adminUsuario = "",
  adminCargado = false,
  configCargada = false,
  selLogin = null;
const IMP_DEF = {
  papel: "58",
  nombre: "CENTROSISTEMAS",
  sub: "Servicio técnico de celulares",
  logo: true,
  pieIngreso: "Presente este recibo para reclamar su equipo.",
  pieEntrega: "¡Gracias por confiar en CENTROSISTEMAS!",
  garantia: 15,
  firma: true,
};
let IMP = { ...IMP_DEF },
  MSG = {},
  papelCfg = null;
const garDef = () =>
  +IMP.garantia >= 0 && IMP.garantia !== "" && IMP.garantia != null ? +IMP.garantia : 15;
const listaNoCubre = () =>
  typeof IMP.nocubre === "string"
    ? IMP.nocubre
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean)
    : NO_CUBRE;
const rolActual = () =>
  esAdmin
    ? "admin"
    : sesion
      ? (usuarios.find((u) => u.id === sesion.id) || {}).rol || "consulta"
      : "consulta";
const perm = (k) => {
  if (esAdmin) return true;
  const r = rolActual();
  return (r === "asesor" && !!P.asesor[k]) || (r === "tecnico" && !!P.tecnico[k]);
};
function aplicarRol() {
  const r = rolActual();
  const et =
    r === "admin"
      ? "Administrador"
      : r === "consulta"
        ? "Solo consulta"
        : r === "tecnico"
          ? "Técnico"
          : "Asesor de ventas";
  $("rol").textContent = sesion ? (sesion.id === "admin" ? et : sesion.nombre + " · " + et) : "";
  $("salir").hidden = !sesion || !db;
  $("c-repuesto").hidden = !esAdmin;
  $("r-ganancia").hidden = !esAdmin;
  $("nueva").hidden = !perm("recibir");
  $("foto-btn").hidden = !(fotoOk && perm("recibir"));
  $("btn-voz").hidden = !(vozOk && perm("recibir"));
  $("btn-admin").hidden = !(esAdmin && db);
  $("btn-inv").hidden = !db;
  $("btn-pos").hidden = !(db && perm("vender"));
  $("btn-ent").hidden = !(db && perm("entregar"));
  $("btn-caja").hidden = !(db && perm("caja"));
  $("btn-rep").hidden = !(db && perm("reportar"));
  $("btn-enc").hidden = !(db && perm("encargos"));
  $("c-pieza").hidden = !db;
  $("inv-foto-btn").hidden = !(fotoOk && perm("inventario"));
  $("inv-nuevo").hidden = !perm("inventario");
  $("rec-wrap").hidden = $("foto-btn").hidden && $("btn-voz").hidden && $("nueva").hidden;
}
function menuRec(abrir) {
  $("rec-menu").hidden = !abrir;
  $("rec-btn").setAttribute("aria-expanded", String(abrir));
}
$("rec-btn").onclick = (ev) => {
  ev.stopPropagation();
  menuRec($("rec-menu").hidden);
};
document.addEventListener("click", (ev) => {
  if (!$("rec-menu").hidden && !ev.target.closest("#rec-wrap")) menuRec(false);
});
document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape" && !$("rec-menu").hidden) {
    menuRec(false);
    $("rec-btn").focus();
  }
});
["btn-voz", "nueva"].forEach((id) => $(id).addEventListener("click", () => menuRec(false)));
$("foto").addEventListener("change", () => menuRec(false));
