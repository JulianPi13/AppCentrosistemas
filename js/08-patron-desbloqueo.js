// ---- patrón de desbloqueo ----
let patSeq = [],
  trazando = false;
const PP = (i) => ({ x: 50 + ((i - 1) % 3) * 100, y: 50 + Math.floor((i - 1) / 3) * 100 });
function pintarPat() {
  let s = "";
  if (patSeq.length > 1)
    s += `<polyline points="${patSeq.map((i) => PP(i).x + "," + PP(i).y).join(" ")}" style="fill:none;stroke:var(--accent);stroke-width:10;stroke-linecap:round;stroke-linejoin:round;opacity:.8"/>`;
  for (let i = 1; i <= 9; i++) {
    const p = PP(i),
      u = patSeq.indexOf(i);
    if (u === 0)
      s += `<circle cx="${p.x}" cy="${p.y}" r="30" style="fill:none;stroke:var(--accent);stroke-width:4"/>`;
    s += `<circle cx="${p.x}" cy="${p.y}" r="${u >= 0 ? 20 : 11}" style="fill:${u >= 0 ? "var(--accent)" : "var(--muted)"}"/>`;
    if (u >= 0)
      s += `<text x="${p.x}" y="${p.y + 7}" text-anchor="middle" style="fill:var(--accent-ink);font:700 20px var(--f-body)">${u + 1}</text>`;
  }
  $("pat").innerHTML = s;
  $("pat-txt").textContent = patSeq.length ? "Patrón: " + patSeq.join("-") : "Sin patrón";
}
function puntoPat(ev) {
  const r = $("pat").getBoundingClientRect(),
    x = ((ev.clientX - r.left) * 300) / r.width,
    y = ((ev.clientY - r.top) * 300) / r.height;
  for (let i = 1; i <= 9; i++) {
    const p = PP(i);
    if (Math.hypot(p.x - x, p.y - y) < 38 && !patSeq.includes(i)) {
      const last = patSeq[patSeq.length - 1];
      if (last) {
        const a = PP(last),
          mx = (a.x + p.x) / 2,
          my = (a.y + p.y) / 2;
        for (let j = 1; j <= 9; j++) {
          const q = PP(j);
          if (q.x === mx && q.y === my && !patSeq.includes(j)) patSeq.push(j);
        }
      }
      patSeq.push(i);
      pintarPat();
      return;
    }
  }
}
$("pat").addEventListener("pointerdown", (ev) => {
  ev.preventDefault();
  if (patBloq) return;
  patSeq = [];
  trazando = true;
  try {
    $("pat").setPointerCapture(ev.pointerId);
  } catch (e) {}
  puntoPat(ev);
  pintarPat();
});
$("pat").addEventListener("pointermove", (ev) => {
  if (trazando) puntoPat(ev);
});
["pointerup", "pointercancel"].forEach((t) =>
  $("pat").addEventListener(t, () => {
    trazando = false;
  }),
);
$("pat-borrar").onclick = () => {
  patSeq = [];
  pintarPat();
};
pintarPat();
