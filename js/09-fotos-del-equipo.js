// ---- fotos de cómo llega el equipo ----
let assets = null,
  fotosEdit = [];
(async () => {
  try {
    assets = window.claude ? await window.claude.use("assets") : null;
  } catch (e) {
    assets = null;
  }
  pintarFotos();
})();
const srcFoto = (f) => f.url || "/_blob/" + f.id;
const puedeFotos = () => !!(assets || db);
let soloVer = false;
function errFoto(e) {
  const c = e && e.code;
  if (
    soloVer ||
    c === "invalid_argument" ||
    c === "not_granted" ||
    c === "not_writer" ||
    c === "forbidden"
  )
    return "No se pudo guardar la foto: esta cuenta de Claude no tiene permiso para guardar. El dueño debe invitar este correo como Editor en Compartir.";
  if (c === "too_large" || c === "quota_exceeded")
    return "La foto es muy pesada o se llenó el espacio. Intente con otra foto.";
  if (e && e.type === "error") return "No se pudo leer esa foto. Tómela otra vez con la cámara.";
  return "No se pudo subir la foto. Revise la conexión e intente otra vez.";
}
const fotoCache = {};
function ponerSrc(img, f) {
  if (!f) return;
  if (!f.db) {
    img.src = srcFoto(f);
    return;
  }
  if (fotoCache[f.db]) {
    img.src = fotoCache[f.db];
    return;
  }
  img.removeAttribute("src");
  if (!db) return;
  db.collection("fotos")
    .doc(f.db)
    .get()
    .then((s) => {
      if (s.exists) {
        fotoCache[f.db] = s.data().d;
        img.src = s.data().d;
      }
    })
    .catch(() => {});
}
async function fotoData(file) {
  let blob = await achicar(file),
    m = 1200,
    q = 0.7,
    out = "";
  for (let i = 0; i < 6; i++) {
    const bm = await createImageBitmap(blob),
      k = Math.min(1, m / Math.max(bm.width, bm.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bm.width * k);
    c.height = Math.round(bm.height * k);
    c.getContext("2d").drawImage(bm, 0, 0, c.width, c.height);
    bm.close();
    out = c.toDataURL("image/jpeg", q);
    c.width = c.height = 0;
    if (out.length < 230000) break;
    m *= 0.82;
    q = Math.max(0.45, q - 0.07);
  }
  return out;
}
async function subirBlobFoto(file) {
  if (assets && !soloVer) {
    try {
      const b = await achicar(file);
      const r = await assets.upload(b);
      return { id: r.id, url: r.url };
    } catch (e) {
      if (!db) throw e;
    }
  }
  const d = await fotoData(file),
    id = "f" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  await db.collection("fotos").doc(id).set({ d, fecha: new Date().toISOString() });
  fotoCache[id] = d;
  return { db: id };
}
function borrarFoto(f) {
  if (!f) return Promise.resolve();
  if (f.db)
    return db
      ? db
          .collection("fotos")
          .doc(f.db)
          .delete()
          .catch(() => {})
      : Promise.resolve();
  return assets ? assets.delete(f.id).catch(() => {}) : Promise.resolve();
}
function pintarFotos() {
  $("g-fotos").hidden = !puedeFotos() && !fotosEdit.length;
  const c = $("fotos");
  c.innerHTML = "";
  fotosEdit.forEach((f, i) => {
    const s = document.createElement("div");
    s.className = "slot llena";
    const im = document.createElement("img");
    ponerSrc(im, f);
    im.alt = "Foto " + (i + 1) + " del equipo";
    im.onclick = () => verFoto(f);
    s.appendChild(im);
    if (puedeFotos() && perm("fotos")) {
      const q = document.createElement("button");
      q.type = "button";
      q.className = "quitar";
      q.textContent = "Quitar";
      q.onclick = () => quitarFoto(i);
      s.appendChild(q);
    }
    c.appendChild(s);
  });
  if (puedeFotos() && perm("fotos") && fotosEdit.length < 3) {
    const s = document.createElement("label");
    s.className = "slot";
    s.textContent = "+ Agregar foto";
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "image/*";
    inp.setAttribute("capture", "environment");
    inp.id = "foto-equipo-" + fotosEdit.length;
    inp.onchange = () => {
      const f = inp.files && inp.files[0];
      if (f) subirFoto(f);
    };
    s.appendChild(inp);
    c.appendChild(s);
  }
}
async function guardarFotos() {
  if (editando) {
    editando = { ...editando, fotos: fotosEdit.slice() };
    await guardarOrden(editando);
  }
}
async function subirFoto(file) {
  const m = $("fotos-msg");
  m.textContent = "Subiendo foto…";
  try {
    fotosEdit.push(await subirBlobFoto(file));
    await guardarFotos();
    m.textContent = editando
      ? "Foto guardada en la orden."
      : "Foto lista. Se guarda al tocar Registrar equipo.";
  } catch (e) {
    m.textContent = errFoto(e);
    try {
      console.warn("foto", e);
    } catch (_) {}
  }
  pintarFotos();
}
async function quitarFoto(i) {
  const f = fotosEdit.splice(i, 1)[0];
  pintarFotos();
  try {
    await guardarFotos();
    await borrarFoto(f);
  } catch (e) {}
}
function verFoto(f) {
  ponerSrc($("prev"), f);
  $("prev").classList.add("grande");
  $("leyendo-txt").textContent = "";
  $("leyendo-ok").hidden = false;
  $("leyendo").hidden = false;
}
$("leyendo-ok").addEventListener("click", () => $("prev").classList.remove("grande"));
