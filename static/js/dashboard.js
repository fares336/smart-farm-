const $ = (id) => document.getElementById(id);
let DATA = null, SEL = null;
const PALETTE = ["#8bc34a","#ffb74d","#4fc3f7","#ba68c8","#e57373","#4db6ac","#fff176","#a1887f","#90a4ae","#f06292","#7986cb","#aed581"];
const cropColor = {};

function lerp(a, b, t) { return a + (b - a) * t; }
function ramp(stops, t) { // stops: [[r,g,b],...]
  t = Math.max(0, Math.min(1, t)); const n = stops.length - 1, i = Math.min(n - 1, Math.floor(t * n)), f = t * n - i;
  const c = stops[i].map((v, k) => Math.round(lerp(v, stops[i + 1][k], f))); return `rgb(${c})`;
}
const MOIST = [[245,222,179],[129,199,132],[66,165,245],[13,71,161]];
const TDSR = [[200,230,201],[255,241,118],[255,167,38],[198,40,40]];
function colour(z, layer) {
  if (z.moisture == null && layer === "moisture") return null;
  if (z.tds == null && layer === "tds") return null;
  if (layer === "moisture") return ramp(MOIST, z.moisture / 100);
  if (layer === "tds") return ramp(TDSR, z.tds / 4000);
  if (!z.best_crop) return null;
  if (!cropColor[z.best_crop]) cropColor[z.best_crop] = PALETTE[Object.keys(cropColor).length % PALETTE.length];
  return cropColor[z.best_crop];
}
function legend(layer) {
  const L = $("legend");
  if (layer === "moisture") L.innerHTML = '<span><i style="background:rgb(245,222,179)"></i>dry 0%</span><span><i style="background:rgb(129,199,132)"></i>moist</span><span><i style="background:rgb(13,71,161)"></i>wet 100%</span>';
  else if (layer === "tds") L.innerHTML = '<span><i style="background:rgb(200,230,201)"></i>low</span><span><i style="background:rgb(255,167,38)"></i>high</span><span><i style="background:rgb(198,40,40)"></i>≥4000 ppm</span>';
  else L.innerHTML = Object.entries(cropColor).map(([n, c]) => `<span><i style="background:${c}"></i>${n}</span>`).join("") || '<span class="muted">No recommendations yet (needs readings).</span>';
}
function draw() {
  const layer = $("layer").value, g = $("farmgrid"); g.innerHTML = "";
  const byRC = {}; DATA.zones.forEach(z => byRC[z.row + "," + z.col] = z);
  for (let r = 0; r < 16; r++) {
    const a = document.createElement("div"); a.className = "arrow"; a.textContent = r % 2 === 0 ? "→" : "←"; g.appendChild(a);
    for (let c = 0; c < 16; c++) {
      const z = byRC[r + "," + c], el = document.createElement("div"), col = colour(z, layer);
      el.className = "cell" + (col ? "" : " nodata") + (z.id === DATA.robot_zone ? " robot" : "") + (z.id === SEL ? " sel" : "");
      if (col) el.style.background = col;
      el.textContent = z.id; el.title = `Zone ${z.id} (row ${r + 1}, col ${c + 1})`;
      el.onclick = () => { SEL = z.id; draw(); openZone(z.id); };
      g.appendChild(el);
    }
  }
  legend(layer);
}
const fmt = (v, d = 0, u = "") => v == null ? "—" : Number(v).toFixed(d) + u;
async function openZone(id) {
  const d = await (await fetch("/api/zone/" + id)).json(), P = $("zonepanel");
  let h = `<h2>Zone ${d.id} <span class="muted small">row ${d.row}, col ${d.col}</span></h2>`;
  if (!d.history.length) { P.innerHTML = h + '<p class="muted">No readings for this zone yet. Add one on the Manual entry page or wait for the robot.</p>'; return; }
  const l = d.history[0];
  h += `<p>Moisture <b>${fmt(l.moisture, 1, "%")}</b> · TDS <b>${fmt(l.tds, 0, " ppm")}</b><br><span class="muted small">${l.recorded_at.replace("T", " ").slice(0, 16)} UTC · ${l.source} · position: ${l.zone_method}${l.expected_zone && l.expected_zone !== l.zone_id ? ` · <span class="pill warnpill">schedule expected zone ${l.expected_zone}</span>` : ""}</span></p>`;
  h += `<h2>Crop suitability</h2>` + (d.recommendations.length ? d.recommendations.map(r => `<div><b>${r.name}</b> ${r.score}%<div class="bar"><div style="width:${r.score}%"></div></div><span class="muted small">${r.limits.length ? "Limits: " + r.limits.join(", ") : "No limiting factor"}</span></div>`).join("") : '<p class="muted">Not enough data.</p>');
  h += `<p class="muted small">Based on this zone's latest reading${d.temp_used != null ? ` and ${d.temp_used} °C average temperature (NASA POWER, 14 days)` : " (climate data unavailable)"}. Indicative only.</p>`;
  h += `<h2>History</h2><div class="scroll" style="max-height:160px"><table><tr><th>Time (UTC)</th><th>Moist.</th><th>TDS</th><th>Src</th></tr>${d.history.map(x => `<tr><td>${x.recorded_at.replace("T", " ").slice(5, 16)}</td><td>${fmt(x.moisture, 1)}</td><td>${fmt(x.tds, 0)}</td><td>${x.source}</td></tr>`).join("")}</table></div>`;
  P.innerHTML = h;
}
async function load() {
  const [zr, sr, cr] = await Promise.all([fetch("/api/zones"), fetch("/api/robot/status"), fetch("/api/climate")]);
  DATA = await zr.json(); const st = await sr.json(), cl = await cr.json();
  const withM = DATA.zones.filter(z => z.moisture != null), withT = DATA.zones.filter(z => z.tds != null);
  const avg = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;
  $("k-robot").innerHTML = `<span class="pill ${st.online ? "on" : "off"}">${st.online ? "Online" : "Offline"}</span>`;
  $("k-robot").title = st.message;
  $("k-zones").textContent = DATA.with_data;
  $("k-moist").textContent = fmt(avg(withM.map(z => z.moisture)), 1, "%");
  $("k-tds").textContent = fmt(avg(withT.map(z => z.tds)), 0);
  if (cl.ok) { $("k-temp").textContent = fmt(cl.latest.t2m, 1, " °C"); $("k-temp-l").textContent = "Temperature on " + cl.latest.date + " (NASA POWER, latest day available)"; }
  else { $("k-temp").textContent = "—"; $("k-temp-l").textContent = "Climate unavailable"; }
  draw();
}
$("layer").onchange = draw;
load(); setInterval(load, 60000);
