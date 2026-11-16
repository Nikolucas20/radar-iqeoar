// Pestaña "Mejorar mi CV": lee el PDF en el navegador (pdf.js), lo revisa como un filtro ATS
// y arma una versión mejorada con los hechos de radar/perfil.json. El archivo no sale del dispositivo.
(function () {
  const KEY = "radar-cv";
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const kw = (label, ...variants) => ({ label, variants: variants.length ? variants : [norm(label)] });

  const K = {
    excel: kw("Excel avanzado", "excel avanzado", "tablas dinamicas", "buscarv", "macros"),
    erp: kw("ERP", "erp", "odoo", "sap", "siigo", "world office", "helisa", "dynamics", "oracle"),
    powerbi: kw("Power BI", "power bi"),
    m365: kw("Microsoft 365", "microsoft 365", "office 365", "outlook", "microsoft office"),
    informes: kw("Informes de gestión", "informes de gestion", "informes financieros", "informes", "reportes"),
    kpi: kw("Indicadores (KPI)", "indicadores", "kpi"),
    cxp: kw("Cuentas por pagar", "cuentas por pagar", "accounts payable", "pago a proveedores"),
    cxc: kw("Cuentas por cobrar", "cuentas por cobrar", "accounts receivable", "cxc"),
    proveedores: kw("Proveedores", "proveedores"),
    compras: kw("Compras", "compras", "ordenes de compra"),
    caja: kw("Caja menor", "caja menor", "cajas menores"),
    legal: kw("Legalizaciones y anticipos", "legalizacion", "anticipos"),
    concil: kw("Conciliaciones", "conciliacion", "conciliaciones"),
    concilBanc: kw("Conciliación bancaria", "conciliacion bancaria", "extractos bancarios"),
    factura: kw("Facturación", "facturacion", "facturas"),
    docs: kw("Gestión documental", "gestion documental", "archivo", "custodia de soportes", "soportes"),
    procesos: kw("Manuales y mejora de procesos", "manuales de procedimientos", "manual", "mejora de procesos", "estandariz"),
    presupuesto: kw("Control presupuestal", "control presupuestal", "presupuesto"),
    gestionAdm: kw("Gestión administrativa", "gestion administrativa", "procesos administrativos", "area administrativa"),
    clienteInt: kw("Servicio al cliente interno", "cliente interno", "soporte a varias areas", "atencion al cliente"),
    agenda: kw("Agenda y reuniones", "agenda", "reuniones", "logistica de eventos"),
    correspondencia: kw("Correspondencia", "correspondencia", "radicacion"),
    actas: kw("Actas", "actas"),
    inventario: kw("Inventarios", "inventario"),
    viajes: kw("Viajes y tiquetes", "viajes", "tiquetes"),
    cartera: kw("Cartera", "cartera"),
    recaudo: kw("Recaudo", "recaudo", "recaudos"),
    cobro: kw("Gestión de cobro", "gestion de cobro", "cobranza", "cobro de cartera", "cobro"),
    aplicacion: kw("Aplicación de pagos", "aplicacion de pagos", "aplicacion de recaudos", "recibos de caja"),
    edades: kw("Edades de cartera", "edades de cartera", "antiguedad de cartera", "cartera vencida"),
    acuerdos: kw("Acuerdos de pago", "acuerdos de pago"),
    provision: kw("Provisión de cartera", "provision de cartera", "deterioro de cartera"),
    retencion: kw("Certificados de retención", "certificados de retencion"),
    estadosCta: kw("Estados de cuenta", "estados de cuenta"),
    seguimiento: kw("Seguimiento a clientes", "seguimiento a clientes", "seguimiento de cartera", "seguimiento al recaudo"),
  };
  const ROLES = {
    analista_administrativa: { titulo: "Analista Administrativa", alias: ["analista administrativ", "administrative analyst"],
      kws: ["gestionAdm", "cxp", "proveedores", "compras", "caja", "legal", "concil", "presupuesto", "informes", "kpi", "procesos", "docs", "factura", "clienteInt", "erp", "excel", "powerbi"],
      perfil: (f) => `Administradora de Empresas con ${f.anos} años de experiencia en áreas administrativas, de tesorería y cartera. Experiencia en ${f.lista}. Enfoque en el control, la estandarización de procesos y el soporte a las áreas de la compañía.` },
    asistente_administrativa: { titulo: "Asistente Administrativa", alias: ["asistente administrativ", "auxiliar administrativ", "administrative assistant"],
      kws: ["docs", "correspondencia", "agenda", "clienteInt", "caja", "legal", "compras", "proveedores", "factura", "cxp", "actas", "informes", "inventario", "viajes", "m365", "excel", "erp"],
      perfil: (f) => `Administradora de Empresas con ${f.anos} años de experiencia brindando soporte administrativo y financiero. Experiencia en ${f.lista}. Ha diseñado manuales de procedimientos y fortalecido los controles de caja menor.` },
    analista_cartera: { titulo: "Analista de Cartera", alias: ["analista de cartera", "analista de recaudo", "analista de cobranza", "cuentas por cobrar", "accounts receivable"],
      kws: ["cartera", "recaudo", "cxc", "cobro", "concil", "concilBanc", "aplicacion", "edades", "acuerdos", "provision", "factura", "retencion", "estadosCta", "kpi", "informes", "erp", "excel", "powerbi"],
      perfil: (f) => `Administradora de Empresas con ${f.anos} años de experiencia en cartera, recaudo y tesorería. Experiencia en ${f.lista}. Orientada al recaudo oportuno, la conciliación de saldos y el reporte claro de la cartera.` },
    asistente_cartera: { titulo: "Asistente de Cartera", alias: ["asistente de cartera", "auxiliar de cartera", "asistente de cobranza", "asistente de recaudo"],
      kws: ["cartera", "recaudo", "cxc", "cobro", "aplicacion", "concil", "estadosCta", "seguimiento", "factura", "retencion", "docs", "clienteInt", "excel", "erp", "m365"],
      perfil: (f) => `Administradora de Empresas con ${f.anos} años de experiencia en recaudo, cuentas por cobrar y soporte administrativo. Experiencia en ${f.lista}. Ha gestionado el recaudo oportuno, conciliaciones periódicas y la expedición de certificados de retención.` },
  };

  const HEADINGS = {
    perfil: /^(perfil( profesional| laboral)?|resumen( profesional)?|acerca de mi|sobre mi|extracto|objetivo( profesional| laboral)?|professional summary|summary|profile)\b/,
    experiencia: /^(experiencia( laboral| profesional)?|historial laboral|trayectoria( laboral| profesional)?|work experience|experience)\b/,
    educacion: /^(educacion|formacion( academica)?|estudios( realizados)?|education)\b/,
    habilidades: /^(habilidades|competencias|conocimientos|aptitudes|herramientas|skills)\b/,
    cursos: /^(cursos|certificaciones|capacitacion(es)?|formacion complementaria|educacion complementaria|certifications)\b/,
    idiomas: /^(idiomas|languages)\b/,
    referencias: /^(referencias)\b/,
  };
  const MONTH = "(ene|feb|mar|abr|may|jun|jul|ago|sep|sept|oct|nov|dic|jan|apr|aug|dec)[a-z]*\\.?";
  const VERBS = /^(gestion|coordin|implement|elabor|concili|ejecut|disen|reduj|optimic|lider|control|analic|registr|valid|administr|negoci|recuper|depur|automatic|estandaric|fortalec|organic|supervis|realic|planifiqu|planific|logr|aument|disminu|mejor|consolid|prepar|program|tramit|verifiqu|verific|atend|apli|factur|cobr|report|actualic|capacit|establec|desarroll|propus|propuso|identific|resolv|manej|direct|garantic|redact|diseñ|dise)/;
  const WEAK = /^(responsable de|encargad[ao] de|apoyo (en|a|al|de)|funciones|tareas|ayud|colabor(e|o|ar)|me encargaba|se encarg|labores de)/;
  const CLICHES = ["persona responsable", "proactiva", "proactivo", "trabajo en equipo", "honesta", "puntual", "dinamica", "capacidad de aprendizaje", "facilidad de aprendizaje", "excelentes relaciones interpersonales", "buena presentacion", "me considero", "soy una persona"];

  let painted = "", perfil = null, cv = null, role = "analista_cartera", vacante = "", offers = [], loading = false, built = null;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null");
    if (saved && saved.text) cv = saved;
    role = localStorage.getItem(KEY + "-rol") || role;
    if (!ROLES[role]) role = "analista_cartera";
  } catch (e) {}

  const $ = (id) => document.getElementById(id);
  const has = (text, k) => k.variants.some((v) => new RegExp("(^|[^a-z0-9])" + v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).test(text));

  function loadScript(src) {
    return new Promise((ok, bad) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => bad(new Error("No cargó " + src)); document.head.appendChild(s); });
  }
  async function pdfjs() {
    if (!window.pdfjsLib) await loadScript("vendor/pdfjs/pdf.min.js");
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = "vendor/pdfjs/pdf.worker.min.js";
    return window.pdfjsLib;
  }
  async function getPerfil() {
    if (perfil) return perfil;
    try { perfil = await (await fetch("radar/perfil.json", { cache: "no-store" })).json(); } catch (e) { perfil = { candidata: { logros_cv: [], educacion: [], anos_experiencia: 5 }, experiencia: [] }; }
    return perfil;
  }

  // ---------- Lectura del PDF ----------
  async function readPdf(file) {
    const lib = await pdfjs();
    const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const lines = [];
    let images = 0, splitLines = 0, icons = 0;
    const starts = [];
    const imgOps = [lib.OPS.paintImageXObject, lib.OPS.paintInlineImageXObject, lib.OPS.paintJpegXObject].filter((x) => x != null);
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const width = page.getViewport({ scale: 1 }).width;
      const tc = await page.getTextContent();
      const items = tc.items.filter((it) => it.str && it.str.trim()).map((it) => ({ s: it.str, x: it.transform[4], y: it.transform[5], w: it.width }));
      items.sort((a, b) => b.y - a.y || a.x - b.x);
      const rows = [];
      for (const it of items) {
        const r = rows.find((row) => Math.abs(row.y - it.y) < 3);
        r ? r.items.push(it) : rows.push({ y: it.y, items: [it] });
      }
      rows.sort((a, b) => b.y - a.y);
      for (const r of rows) {
        r.items.sort((a, b) => a.x - b.x);
        let text = "", prevEnd = null, split = false;
        for (const it of r.items) {
          if (prevEnd != null) {
            const gap = it.x - prevEnd;
            if (gap > width * 0.12 && prevEnd < width * 0.55 && it.x > width * 0.35) split = true;
            text += gap > 1.5 ? " " : "";
          }
          text += it.s;
          prevEnd = it.x + it.w;
        }
        if (split) splitLines++;
        starts.push(r.items[0].x / width);
        if (/[-☀-➿]|[\uD83C-\uDBFF][\uDC00-\uDFFF]/.test(text)) icons++;
        lines.push({ t: text.replace(/\s+/g, " ").trim(), p });
      }
      const ops = await page.getOperatorList();
      images += ops.fnArray.filter((f) => imgOps.includes(f)).length;
    }
    // Columnas: muchas líneas que arrancan alineadas en la mitad derecha (el texto centrado arranca en x distintas).
    const n = Math.max(lines.length, 1);
    const right = starts.filter((x) => x > 0.3);
    const bins = {};
    for (const x of right) bins[Math.round(x * 50)] = (bins[Math.round(x * 50)] || 0) + 1;
    const aligned = Math.max(0, ...Object.values(bins));
    return {
      fileName: file.name, size: file.size, pages: doc.numPages, images, icons,
      multiCol: lines.length > 12 && (splitLines / n > 0.18 || (right.length / n > 0.2 && aligned / Math.max(right.length, 1) > 0.4)),
      lines: lines.map((l) => l.t).filter(Boolean),
      text: lines.map((l) => l.t).join("\n"),
    };
  }

  // ---------- Revisión tipo ATS ----------
  function roleKeywords() {
    const r = ROLES[role];
    const list = r.kws.map((k) => K[k]);
    const o = offers.find((x) => x.id === vacante);
    if (o) for (const p of o.kit?.palabras_clave || []) {
      const n = norm(p).trim();
      if (n && !list.some((k) => k.variants.includes(n))) list.push(kw(p, n));
    }
    return list;
  }

  function evidenceText() {
    const c = perfil?.candidata || {};
    return norm([...(c.logros_cv || []), ...(c.educacion || [])].join("\n"));
  }

  function analyze(d) {
    const text = norm(d.text);
    const lines = d.lines.map(norm);
    const words = (d.text.match(/[A-Za-zÁÉÍÓÚÑáéíóúñ]{2,}/g) || []).length;
    const checks = [];
    const add = (grupo, ok, max, titulo, detalle, partial) => checks.push({ grupo, estado: ok ? "ok" : partial != null && partial > 0 ? "warn" : "fail", pts: ok ? max : Math.round(max * (partial || 0)), max, titulo, detalle });

    const readable = words >= 25;
    add("formato", readable, 12, readable ? "El texto se puede leer" : "El PDF es una imagen",
      readable ? "Los filtros pueden copiar tu texto. Es lo primero que revisan." : "No encontré texto seleccionable: parece escaneado o exportado como imagen. Los ATS lo ven en blanco. Exporta el CV desde Word o Google Docs con Archivo > Descargar > PDF.");
    if (!readable) return { checks, score: 0, words, keywords: { found: [], missing: [] }, weak: [] };

    add("formato", d.pages <= 2, 5, d.pages <= 2 ? `${d.pages} ${d.pages === 1 ? "página" : "páginas"}` : `${d.pages} páginas`,
      d.pages <= 2 ? "Con 5 años de experiencia, 1 o 2 páginas es lo esperado." : "Recorta a 2 páginas: deja los últimos 10 años y los logros que se relacionan con el cargo.", d.pages === 3 ? 0.4 : 0);
    add("formato", !d.multiCol, 8, d.multiCol ? "Diseño a dos columnas" : "Una sola columna",
      d.multiCol ? "Muchos ATS leen de izquierda a derecha y mezclan las dos columnas: tu experiencia puede quedar revuelta con tus datos o habilidades. Usa una sola columna." : "El orden de lectura es claro para un ATS.");
    add("formato", d.images === 0, 5, d.images ? `${d.images} ${d.images === 1 ? "imagen o foto" : "imágenes o gráficos"}` : "Sin fotos ni gráficos",
      d.images ? "Los ATS ignoran las imágenes y algunos rechazan el archivo. Quita la foto, logos y barras de nivel; si una empresa pide foto, la piden aparte." : "Nada que el filtro no pueda leer.");
    add("formato", d.icons === 0, 3, d.icons ? "Íconos en el texto" : "Sin íconos raros",
      d.icons ? "Los íconos de teléfono, correo o viñetas decorativas salen como símbolos extraños. Escribe 'Celular:', 'Correo:' o usa viñetas simples (•)." : "Las viñetas y los datos se leen bien.");

    const found = Object.fromEntries(Object.keys(HEADINGS).map((h) => [h, lines.some((l) => l.length < 45 && HEADINGS[h].test(l.replace(/^[^a-z]+/, "")))]));
    const core = ["perfil", "experiencia", "educacion", "habilidades"];
    const missingH = core.filter((h) => !found[h]);
    const hName = { perfil: "Perfil profesional", experiencia: "Experiencia laboral", educacion: "Educación", habilidades: "Habilidades" };
    add("formato", !missingH.length, 9, missingH.length ? "Faltan títulos de sección estándar" : "Secciones con títulos estándar",
      missingH.length ? `No encontré: ${missingH.map((h) => hName[h]).join(", ")}. Los ATS ubican la información por estos títulos; usa nombres comunes, sin frases creativas.` : "Perfil, Experiencia, Educación y Habilidades están donde el filtro los busca.",
      1 - missingH.length / core.length);

    const r = ROLES[role];
    const head = lines.slice(0, 8).join(" ");
    const titled = r.alias.some((a) => head.includes(a));
    add("contenido", titled, 6, titled ? "El cargo aparece al inicio" : "El cargo no aparece debajo de tu nombre",
      titled ? `Arriba dice ${r.titulo}, igual que la vacante.` : `Escribe "${r.titulo}" justo debajo de tu nombre. Los reclutadores buscan por el nombre exacto del cargo.`);

    const email = /[\w.+-]+@[\w-]+\.[\w.]+/.test(d.text), phone = /(\+?57[\s-]?)?3\d{2}[\s.-]?\d{3}[\s.-]?\d{4}/.test(d.text), city = /bogota|colombia/.test(text), linked = /linkedin\.com\/in\//.test(text);
    const contact = [email, phone, city].filter(Boolean).length;
    add("contenido", contact === 3, 6, contact === 3 ? "Datos de contacto completos" : "Faltan datos de contacto",
      contact === 3 ? (linked ? "Correo, celular, ciudad y LinkedIn." : "Correo, celular y ciudad. Suma tu enlace de LinkedIn: muchos reclutadores lo revisan.") : `Falta ${[!email && "el correo", !phone && "el celular", !city && "la ciudad"].filter(Boolean).join(", ")}. Ponlos en texto, no dentro de un encabezado de página.`,
      contact / 3);

    const kws = roleKeywords();
    const kFound = kws.filter((k) => has(text, k)), kMissing = kws.filter((k) => !has(text, k));
    const cov = kFound.length / kws.length;
    add("contenido", cov >= 0.7, 18, `Palabras clave: ${kFound.length} de ${kws.length}`,
      cov >= 0.7 ? "Tu CV usa el vocabulario que buscan los filtros para este cargo." : "Los ATS puntúan por coincidencias exactas con la vacante. Agrega las que faltan, con las mismas palabras, solo si las has hecho.", Math.min(1, cov / 0.7));

    const metrics = d.lines.filter((l) => /\d+\s?%|\$\s?\d|\d+\s?(millones|proveedores|clientes|cuentas|facturas|areas|áreas|personas|usuarios|dias|días)/i.test(l)).length;
    add("contenido", metrics >= 3, 8, metrics ? `${metrics} ${metrics === 1 ? "logro con cifras" : "logros con cifras"}` : "Ningún logro con cifras",
      metrics >= 3 ? "Las cifras hacen creíbles tus logros." : "Agrega números reales: monto de cartera que manejabas, % de recaudo, número de proveedores o de conciliaciones al mes, días que redujiste.", metrics / 3);

    const bullets = d.lines.map((l) => l.replace(/^[\s•●▪◦\-–*·]+/, "")).filter((l) => l.length > 25);
    const weak = bullets.filter((l) => WEAK.test(norm(l)));
    const strong = bullets.filter((l) => VERBS.test(norm(l))).length;
    add("contenido", strong >= 5 && weak.length <= 1, 6, weak.length ? `${weak.length} ${weak.length === 1 ? "frase empieza" : "frases empiezan"} débil` : "Logros con verbos de acción",
      weak.length ? "Cambia 'Responsable de…' o 'Apoyo en…' por un verbo de logro: Gestioné, Concilié, Implementé, Reduje." : strong >= 5 ? "Tus logros empiezan con verbos de acción." : "Empieza cada logro con un verbo de acción (Gestioné, Concilié, Implementé).", weak.length ? 0.4 : strong / 5);

    const ranges = (text.match(new RegExp(`(${MONTH}\\s*(de\\s*)?)?(19|20)\\d{2}\\s*(-|–|a|al|hasta)\\s*(${MONTH}\\s*(de\\s*)?)?((19|20)\\d{2}|actual|presente|la fecha|hoy)`, "g")) || []).length;
    add("contenido", ranges >= 1, 6, ranges ? "Fechas de cada cargo" : "No encontré fechas en tu experiencia",
      ranges ? "Formato recomendado: mes y año (ene. 2020 – jun. 2026)." : "Pon inicio y fin de cada cargo con mes y año. Sin fechas, el ATS no puede calcular tus años de experiencia.");

    add("contenido", words >= 300 && words <= 950, 4, `${words} palabras`,
      words < 300 ? "Es corto: el filtro tiene poco con qué compararte. Desarrolla tus logros." : words > 950 ? "Es largo: los reclutadores leen en 7 segundos. Deja lo que se relaciona con el cargo." : "Buena extensión.", words < 300 ? words / 300 : 0.5);

    const sensitive = [/c[eé]dula|\bc\.?\s?c\.?\s*(no\.?)?\s*\d/i, /estado civil|solter[ao]|casad[ao]|union libre/i, /fecha de nacimiento|\bedad\b|\d{2} anos de edad/i, /libreta militar|tipo de sangre|\brh\b|grupo sangu/i].filter((re) => re.test(text)).length;
    const cliches = CLICHES.filter((c) => text.includes(c));
    add("contenido", !sensitive && cliches.length <= 1, 4, sensitive ? "Datos personales que sobran" : cliches.length > 1 ? "Frases genéricas" : "Sin datos de más",
      sensitive ? "Quita cédula, estado civil, edad, fecha de nacimiento y tipo de sangre: no suman puntos y exponen tus datos. Se piden en la contratación." : cliches.length > 1 ? `Frases como "${cliches.slice(0, 2).join('", "')}" no le dicen nada al filtro. Cámbialas por un logro concreto.` : "Solo lo que suma.", 0.5);

    const score = Math.round(checks.reduce((a, c) => a + c.pts, 0));
    return { checks, score, words, keywords: { found: kFound, missing: kMissing }, weak: weak.slice(0, 5), found };
  }

  // ---------- Versión mejorada ----------
  function guessName(d) {
    for (const l of d.lines.slice(0, 15)) {
      const t = l.trim();
      if (/^[A-Za-zÁÉÍÓÚÑáéíóúñ]+( [A-Za-zÁÉÍÓÚÑáéíóúñ]+){1,4}$/.test(t) && !Object.values(HEADINGS).some((re) => re.test(norm(t))) && !/hoja de vida|curriculum/i.test(t)) {
        return t.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
      }
    }
    return perfil?.candidata?.nombre || "";
  }
  const clean = (s) => s.replace(/\s*\([^)]*\b(19|20)\d{2}[^)]*\)\s*\.?$/, ".").replace(/\.\.$/, ".");

  function build(d) {
    const r = ROLES[role], c = perfil.candidata || {};
    const ev = norm(d.text) + "\n" + evidenceText();
    const kws = roleKeywords().filter((k) => has(ev, k));
    const comp = kws.filter((k) => !["erp", "excel", "powerbi", "m365"].includes(Object.keys(K).find((x) => K[x] === k))).slice(0, 10);
    const tools = [];
    if (/odoo/.test(ev)) tools.push("ERP Odoo"); else if (has(ev, K.erp)) tools.push("ERP");
    for (const t of ["sap", "siigo", "world office", "helisa"]) if (norm(d.text).includes(t)) tools.push(t.replace(/\b\w/g, (x) => x.toUpperCase()).replace("Sap", "SAP"));
    if (has(ev, K.excel)) tools.push("Excel avanzado");
    if (has(ev, K.powerbi)) tools.push("Power BI");
    if (has(norm(d.text), K.m365)) tools.push("Microsoft 365");
    const lista = comp.slice(0, 4).map((k) => k.label.toLowerCase()).join(", ").replace(/, ([^,]*)$/, " y $1");
    const email = (d.text.match(/[\w.+-]+@[\w-]+\.[\w.]+/) || [""])[0];
    const phone = (d.text.match(/(\+?57[\s-]?)?3\d{2}[\s.-]?\d{3}[\s.-]?\d{4}/) || [""])[0];
    const linked = (d.text.match(/(https?:\/\/)?(www\.)?linkedin\.com\/in\/[\w-]+/i) || [""])[0];
    const idioma = d.lines.find((l) => /ingl[eé]s|english/i.test(l) && l.length < 80);
    const relevance = (txt) => roleKeywords().filter((k) => has(norm(txt), k)).length;
    const jobs = (perfil.experiencia || []).map((j) => ({
      ...j, items: j.logros.map((i) => (c.logros_cv || [])[i]).filter(Boolean).map(clean).sort((a, b) => relevance(b) - relevance(a)),
    }));
    const formal = (c.educacion || []).filter((e) => !/excel|power bi|curso/i.test(e));
    const cursos = (c.educacion || []).filter((e) => /excel|power bi|curso/i.test(e));
    const ph = (v, label) => v ? esc(v) : `<mark>${label}</mark>`;
    return `
      <h1 contenteditable="true">${ph(guessName(d), "Tu nombre")}</h1>
      <p class="d-title" contenteditable="true">${esc(r.titulo)} | Administradora de Empresas</p>
      <p class="d-contact" contenteditable="true">Bogotá, Colombia · ${ph(phone, "Celular")} · ${ph(email, "Correo")}${linked ? " · " + esc(linked.replace(/^https?:\/\/(www\.)?/, "")) : ""}</p>
      <h2>Perfil profesional</h2>
      <p contenteditable="true">${esc(r.perfil({ anos: c.anos_experiencia || 5, lista: lista || "procesos administrativos y financieros" }))}</p>
      <h2>Competencias clave</h2>
      <p contenteditable="true">${comp.map((k) => esc(k.label)).join(" · ")}</p>
      <h2>Experiencia laboral</h2>
      ${jobs.map((j) => `<div class="d-job"><p class="d-role" contenteditable="true"><b>${esc(j.cargo)}</b> | ${esc(j.empresa)} | Bogotá | ${esc(j.periodo)}</p>
        <ul contenteditable="true">${j.items.map((l) => `<li>${esc(l)}</li>`).join("")}</ul></div>`).join("")}
      <h2>Educación</h2>
      <ul contenteditable="true">${formal.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>
      ${cursos.length ? `<h2>Cursos y certificaciones</h2><ul contenteditable="true">${cursos.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>` : ""}
      <h2>Herramientas</h2>
      <p contenteditable="true">${tools.map(esc).join(" · ") || "<mark>Excel, ERP que manejas</mark>"}</p>
      ${idioma ? `<h2>Idiomas</h2><p contenteditable="true">${esc(idioma.replace(/^[\s•●▪\-–*]+/, ""))}</p>` : ""}`;
  }

  // ---------- Pantalla ----------
  const STATE = { ok: "Bien", warn: "Mejorable", fail: "Corregir" };
  function verdict(s) { return s >= 80 ? "Pasa bien los filtros" : s >= 60 ? "Pasa, pero pierde puntos" : "Lo pueden descartar"; }

  function paint() {
    const root = $("cvpanel");
    if (!root) return;
    const o = offers.filter((x) => (x.estado || "nueva") !== "descartada");
    $("cv-rol").value = role;
    const vSel = $("cv-vac");
    vSel.innerHTML = '<option value="">Sin vacante específica</option>' + o.map((x) => `<option value="${esc(x.id)}">${esc(x.titulo)} · ${esc(x.empresa || "Confidencial")}</option>`).join("");
    vSel.value = o.some((x) => x.id === vacante) ? vacante : "";
    const out = $("cv-out");
    $("cv-file-name").textContent = cv ? `${cv.fileName} · ${cv.pages} ${cv.pages === 1 ? "página" : "páginas"}` : "Ningún archivo todavía";
    $("cv-clear").hidden = !cv;
    if (loading) { out.innerHTML = `<p class="cv-empty">Leyendo tu hoja de vida…</p>`; return; }
    if (!cv) { out.innerHTML = `<p class="cv-empty">Sube tu CV en PDF para ver cómo lo lee un filtro automático y recibir tu versión mejorada.</p>`; return; }
    const a = analyze(cv);
    const group = (g, title) => `<div class="cv-group"><h4>${title}</h4><ul class="cv-checks">${a.checks.filter((c) => c.grupo === g).map((c) => `
      <li class="${c.estado}"><span class="cv-dot" aria-hidden="true"></span><div><b>${esc(c.titulo)}</b> <span class="cv-tag">${STATE[c.estado]}</span><p>${esc(c.detalle)}</p></div></li>`).join("")}</ul></div>`;
    const r = ROLES[role];
    const ev = evidenceText();
    const miss = a.keywords.missing;
    const backed = miss.filter((k) => has(ev, k)), other = miss.filter((k) => !has(ev, k));
    let after = null;
    if (a.words >= 25) {
      built = build(cv);
      const tmp = document.createElement("div");
      tmp.innerHTML = built;
      const lines = [...tmp.querySelectorAll("h1,h2,p,li")].map((e) => e.textContent.trim());
      after = analyze({ text: lines.join("\n"), lines, pages: 1, images: 0, icons: 0, multiCol: false });
    }
    out.innerHTML = `
      <div class="cv-score">
        <div class="cv-dial" style="--v:${a.score}" role="img" aria-label="Puntaje ATS ${a.score} de 100"><b class="num">${a.score}</b><small>de 100</small></div>
        <div><h3>${verdict(a.score)}</h3><p class="hint">Revisé tu CV como lo hacen los filtros automáticos (ATS) de Computrabajo, elempleo, Magneto, LinkedIn y los portales de las empresas, para el cargo de <b>${esc(r.titulo)}</b>${vacante ? " y la vacante elegida" : ""}.${after && after.score > a.score ? ` La versión mejorada de abajo llega a <b class="num">${after.score}</b>.` : ""}</p></div>
      </div>
      <div class="cv-cols">${group("formato", "Que el filtro lo pueda leer")}${group("contenido", "Que el filtro te elija")}</div>
      ${a.words >= 25 ? `<div class="cv-group"><h4>Palabras clave para ${esc(r.titulo)}</h4>
        <p class="hint">Ya las tienes:</p><div class="chips">${a.keywords.found.map((k) => `<span class="chip good">${esc(k.label)}</span>`).join("") || "<span class='hint'>Ninguna todavía.</span>"}</div>
        ${backed.length ? `<p class="hint">Te faltan y tu experiencia las respalda, agrégalas:</p><div class="chips">${backed.map((k) => `<span class="chip new">${esc(k.label)}</span>`).join("")}</div>` : ""}
        ${other.length ? `<p class="hint">Te faltan. Agrégalas solo si las has hecho:</p><div class="chips">${other.map((k) => `<span class="chip ask">${esc(k.label)}</span>`).join("")}</div>` : ""}
      </div>` : ""}
      ${a.weak.length ? `<div class="cv-group"><h4>Frases para reescribir</h4><ul class="cv-weak">${a.weak.map((l) => `<li>${esc(l)}</li>`).join("")}</ul><p class="hint">Empieza con un verbo de logro y, si puedes, una cifra: "Gestioné la cartera de 120 clientes y reduje la vencida a 30 días".</p></div>` : ""}
      ${built ? `<div class="cv-group"><div class="kit-row"><h4>Tu CV mejorado para ${esc(r.titulo)}</h4>
        <span class="actions"><button class="btn copy" type="button" id="cv-copy">Copiar texto</button><button class="btn btn-go copy" type="button" id="cv-print">Descargar PDF</button></span></div>
        <p class="hint">Una columna, títulos estándar y solo hechos de tu experiencia. Toca cualquier texto para editarlo; lo resaltado falta por completar. Si te falta algún cargo anterior, agrégalo antes de descargar.</p>
        <article class="cv-doc" id="cv-doc">${built}</article></div>` : ""}`;
  }

  async function onFile(file) {
    if (!file) return;
    if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name)) { window.radarToast?.("Sube el CV en PDF."); return; }
    loading = true; paint();
    try {
      await getPerfil();
      cv = await readPdf(file);
      try { localStorage.setItem(KEY, JSON.stringify(cv)); } catch (e) {}
    } catch (e) {
      window.radarToast?.("No pude leer ese PDF. Si tiene clave, quítasela y vuelve a subirlo.");
    }
    loading = false; paint();
  }

  function printDoc() {
    const doc = $("cv-doc");
    if (!doc) return;
    let root = $("print-root");
    if (!root) { root = document.createElement("div"); root.id = "print-root"; document.body.appendChild(root); }
    root.innerHTML = `<article class="cv-doc">${doc.innerHTML}</article>`;
    root.querySelectorAll("[contenteditable]").forEach((e) => e.removeAttribute("contenteditable"));
    const name = (doc.querySelector("h1")?.textContent || "CV").trim();
    const prev = document.title;
    document.title = `${name} - ${ROLES[role].titulo}`.replace(/[\\/:*?"<>|]/g, "");
    const done = () => { document.title = prev; window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done);
    window.print();
    setTimeout(done, 1500);
  }

  function wire() {
    if (!$("cvpanel") || $("cvpanel").dataset.wired) return;
    $("cvpanel").dataset.wired = "1";
    $("cv-file").addEventListener("change", (e) => { onFile(e.target.files[0]); e.target.value = ""; });
    const drop = $("cv-drop");
    drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
    drop.addEventListener("dragleave", () => drop.classList.remove("over"));
    drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("over"); onFile(e.dataTransfer.files[0]); });
    $("cv-rol").addEventListener("change", (e) => { role = e.target.value; try { localStorage.setItem(KEY + "-rol", role); } catch (x) {} paint(); });
    $("cv-vac").addEventListener("change", (e) => {
      vacante = e.target.value;
      const t = norm(offers.find((x) => x.id === vacante)?.titulo);
      const match = Object.keys(ROLES).find((k) => ROLES[k].alias.some((a) => t.includes(a)));
      if (match) role = match;
      paint();
    });
    $("cv-clear").addEventListener("click", () => { cv = null; built = null; try { localStorage.removeItem(KEY); } catch (e) {} paint(); });
    $("cv-out").addEventListener("click", async (e) => {
      if (e.target.closest("#cv-print")) printDoc();
      const b = e.target.closest("#cv-copy");
      if (b) {
        const doc = $("cv-doc");
        const text = [...doc.querySelectorAll("h1,h2,p,li")].map((x) => (x.tagName === "LI" ? "• " : x.tagName === "H2" ? "\n" + "" : "") + x.textContent.trim()).join("\n");
        try { await navigator.clipboard.writeText(text); b.textContent = "¡Copiado!"; } catch (x) { b.textContent = "No se pudo copiar"; }
        setTimeout(() => { b.textContent = "Copiar texto"; }, 1800);
      }
    });
  }

  window.RadarCV = {
    async show(list) {
      const key = (list || []).map((o) => o.id + (o.estado || "")).join("|");
      if (painted && key === painted) return;
      painted = key;
      offers = list || [];
      wire();
      if (cv && !perfil) { loading = true; paint(); await getPerfil(); loading = false; }
      paint();
    },
  };
})();
