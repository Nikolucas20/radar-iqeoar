// Pestaña "North Point": empresas del complejo empresarial y cómo contactarlas.
// Los datos viven en empresas_north_point.json; cada dato lleva su fuente.
(function () {
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const safeUrl = (u) => /^https?:\/\//i.test(String(u || "")) ? u : "#";
  const NIVEL = {
    vacantes: ["good", "Tiene cargos administrativos"],
    posible: ["ask", "Puede tener cargos administrativos"],
  };
  let data = null, loading = false, failed = false;

  const link = (l, cls = "") => `<a class="${cls}" href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener">${esc(l.texto)}</a>`;
  const contact = (c = {}) => [
    c.correo ? `<a class="np-c" href="mailto:${esc(c.correo)}">${esc(c.correo)}</a>` : "",
    c.telefono ? `<a class="np-c" href="tel:${esc(String(c.telefono).replace(/[^\d+]/g, ""))}">${esc(c.telefono)}</a>` : "",
  ].filter(Boolean).join("");

  function company(e) {
    const [cls, label] = NIVEL[e.nivel] || ["", ""];
    const c = contact(e.contacto);
    return `<li class="np-card">
      <div class="np-top"><h3>${esc(e.nombre)}</h3><span class="chip ${cls}">${esc(label)}</span></div>
      <p class="np-meta">${esc(e.sector)} · ${esc(e.ubicacion)}</p>
      <p><b>Cargos:</b> ${esc(e.cargos)}</p>
      <p><b>Cómo aplicar:</b> ${esc(e.como_aplicar)}</p>
      ${c || (e.enlaces || []).length ? `<div class="np-links">${c}${(e.enlaces || []).map((l) => link(l, "np-l")).join("")}</div>` : ""}
      ${e.no_confirmado ? `<p class="np-warn">${esc(e.no_confirmado)}</p>` : ""}
      <p class="np-src">Fuente: ${(e.fuentes || []).map((f) => link(f)).join(" · ")}</p>
    </li>`;
  }

  function paint() {
    const root = document.getElementById("np-out");
    if (!root) return;
    if (failed) { root.innerHTML = `<p class="cv-empty">No pude cargar el listado. Revisa tu conexión e inténtalo de nuevo.</p>`; return; }
    if (!data) { root.innerHTML = `<p class="cv-empty">Cargando empresas…</p>`; return; }
    const hay = data.empresas.filter((e) => e.nivel === "vacantes"), pos = data.empresas.filter((e) => e.nivel !== "vacantes");
    root.innerHTML = `
      <div class="np-aviso" role="note">${esc(data.aviso)}</div>
      <p class="hint">${esc(data.zona.nombre)}. ${esc(data.zona.nota)} Actualizado el ${esc(data.actualizado)}.</p>
      ${hay.length ? `<h4 class="np-h">Con cargos administrativos</h4><ul class="np-list">${hay.map(company).join("")}</ul>` : ""}
      ${pos.length ? `<h4 class="np-h">Podrían tener cargos administrativos</h4><ul class="np-list">${pos.map(company).join("")}</ul>` : ""}
      <h4 class="np-h">Administraciones del complejo</h4>
      <ul class="np-list">${data.administraciones.map((a) => `<li class="np-card">
        <h3>${esc(a.nombre)}</h3><p class="np-meta">${esc(a.ubicacion)}</p>
        <div class="np-links">${contact(a.contacto)}${(a.enlaces || []).map((l) => link(l, "np-l")).join("")}</div>
        <p class="np-warn">${esc(a.nota)}</p></li>`).join("")}</ul>
      <h4 class="np-h">También en el complejo</h4>
      <p class="hint">Sin canal de empleo confirmado: ${data.tambien_en_el_complejo.map(esc).join("; ")}.</p>
      <h4 class="np-h">Busca vacantes vigentes en la zona</h4>
      <div class="np-links">${data.buscar_vacantes.map((l) => link(l, "np-l")).join("")}</div>`;
  }

  async function load() {
    if (data || loading) return;
    loading = true;
    try {
      data = await (await fetch("empresas_north_point.json?t=" + Date.now(), { cache: "no-store" })).json();
      failed = false;
    } catch (e) { failed = true; }
    loading = false;
    paint();
  }

  window.RadarNorthPoint = { show() { paint(); load(); } };
})();
