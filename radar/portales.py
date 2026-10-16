"""Lee ofertas públicas de elempleo, LinkedIn, Computrabajo y Magneto y las deja en
radar/portales.json para la rutina en la nube (que no puede abrir esos sitios).

Corre en GitHub Actions. Solo lee páginas públicas, sin iniciar sesión, con pausas entre pedidos.
"""
import datetime as dt
import html
import json
import re
import time
import urllib.parse
import urllib.error
import urllib.request
from pathlib import Path

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36"
AQUI = Path(__file__).parent
SALIDA = AQUI / "portales.json"
DIAS = 6  # solo ofertas publicadas en los últimos N días
HOY = dt.date.today()

CARGOS = [
    "analista de tesoreria", "analista de cartera", "analista administrativo", "analista administrativo y financiero",
    "asistente de gerencia", "asistente ejecutiva", "asistente administrativa", "analista cuentas por pagar",
    "analista cuentas por cobrar", "office manager", "coordinadora administrativa", "analista de recaudo",
]
EXCLUIR = re.compile(r"obra o labor|obra labor|prestaci[oó]n de servicios|aprendiz|practicante|pasant|t[eé]rmino fijo|temporal|100\s*% presencial|freelance|FIXED_TERM|PART_TIME|TEMPORARY|CONTRACTOR|INTERN", re.I)
DESCRIPCION_MAX = 1300


def get(url, intentos=3):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "es-CO,es;q=0.9"})
    for n in range(intentos):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                raw = r.read()
            break
        except urllib.error.HTTPError as e:
            if e.code == 429 and n < intentos - 1:
                time.sleep(25 * (n + 1))
                continue
            raise
    for enc in ("utf-8", "cp1252"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            pass
    return raw.decode("utf-8", "replace")


def limpio(s):
    s = re.sub(r"<(script|style|noscript|svg)[^>]*>.*?</\1>", " ", s, flags=re.S | re.I)
    s = re.sub(r"<br\s*/?>|</p>|</li>", "\n", s, flags=re.I)
    s = html.unescape(re.sub(r"<[^>]+>", " ", s))
    return re.sub(r"[ \t\r\f\v]+", " ", re.sub(r"\n\s*\n+", "\n", s)).strip()


def fecha_iso(s):
    if not s:
        return None
    m = re.match(r"(\d{4})-(\d{1,2})-(\d{1,2})", s)
    if m:
        return dt.date(*map(int, m.groups()))
    m = re.match(r"(\d{1,2})-(\d{1,2})-(\d{4})", s)
    if m:
        d, mo, y = map(int, m.groups())
        return dt.date(y, mo, d)
    return None


def job_posting(page):
    for block in re.findall(r'<script[^>]*application/ld\+json[^>]*>(.*?)</script>', page, re.S):
        if '"JobPosting"' not in block:
            continue
        try:
            d = json.loads(block, strict=False)
        except Exception:
            continue
        if isinstance(d, list):
            d = next((x for x in d if isinstance(x, dict) and x.get("@type") == "JobPosting"), None)
        if isinstance(d, dict) and d.get("@type") == "JobPosting":
            return d
    return None


def de_jobposting(jp):
    sal = jp.get("baseSalary") or {}
    val = sal.get("value") if isinstance(sal, dict) else None
    if isinstance(val, dict):
        lo, hi = val.get("minValue") or val.get("value"), val.get("maxValue")
        salario = " a ".join(str(x) for x in (lo, hi) if x) + (" " + str(sal.get("currency", "")) if lo or hi else "")
    else:
        salario = ""
    org = jp.get("hiringOrganization") or {}
    loc = jp.get("jobLocation") or {}
    if isinstance(loc, list):
        loc = loc[0] if loc else {}
    addr = (loc.get("address") or {}) if isinstance(loc, dict) else {}
    return {
        "titulo": html.unescape(jp.get("title", "")),
        "empresa": org.get("name", "") if isinstance(org, dict) else "",
        "salario": salario.strip(),
        "ubicacion": ", ".join(" / ".join(map(str, x)) if isinstance(x, list) else str(x) for x in [addr.get("addressLocality", ""), jp.get("jobLocationType", "")] if x),
        "publicada": str(fecha_iso(jp.get("datePosted", "")) or ""),
        "vence": str(fecha_iso(jp.get("validThrough", "")) or ""),
        "contrato": str(jp.get("employmentType", "")),
        "descripcion": limpio(jp.get("description", ""))[:DESCRIPCION_MAX],
    }


def salario_max_cop(s):
    """Máximo del rango en COP si se puede leer ('$2 a $2,5 millones', '3050000', '$3.762.800'); None si no."""
    s = (s or "").lower()
    if not s or "convenir" in s or "confidencial" in s:
        return None
    if "millon" in s:
        nums = [float(x.replace(",", ".")) for x in re.findall(r"\d+(?:[.,]\d+)?", s)]
        return max(nums) * 1_000_000 if nums else None
    nums = [int(re.sub(r"\D", "", x)) for x in re.findall(r"\d[\d.,]{5,}", s)]
    return max(nums) if nums else None


# ---------- elempleo ----------
def elempleo():
    urls = set()
    for c in CARGOS:
        slug = "trabajo-" + re.sub(r"\s+", "-", c)
        for mod in ("modalidad-h%C3%ADbrido", "modalidad-remoto"):
            try:
                page = get(f"https://www.elempleo.com/co/ofertas-empleo/{slug}-{mod}")
                urls |= set(re.findall(r'"@id":\s*"(https://www\.elempleo\.com/co/ofertas-trabajo/[^"#]+)"', page))
            except Exception as e:
                print("elempleo listado:", c, e)
            time.sleep(0.8)
    out = []
    for url in sorted(urls, key=lambda u: u[-10:], reverse=True)[:90]:
        try:
            page = get(url)
        except Exception as e:
            print("elempleo detalle:", e)
            continue
        m = re.search(r"let offerData = \{(.*?)\};", page, re.S)
        if not m:
            continue
        d = {k: html.unescape(v) for k, v in re.findall(r"(\w+):\s*'((?:[^'\\]|\\.)*)'", m.group(1))}
        jp = job_posting(page) or {}
        out.append({
            "portal": "elempleo", "url": url, "titulo": d.get("title", ""), "empresa": d.get("company", ""),
            "salario": d.get("salary", ""), "ubicacion": d.get("location", ""),
            "publicada": str(fecha_iso(d.get("datePublish", "")) or ""), "vence": str(fecha_iso(d.get("dateFinished", "")) or ""),
            "contrato": d.get("contract", ""), "experiencia": d.get("experience", ""),
            "descripcion": limpio(jp.get("description", ""))[:DESCRIPCION_MAX],
        })
        time.sleep(0.6)
    return out


# ---------- LinkedIn (vista pública para invitados) ----------
def linkedin():
    ids = []
    for c in CARGOS:
        q = urllib.parse.urlencode({"keywords": c, "location": "Bogotá, Colombia", "f_WT": "2,3", "f_TPR": f"r{DIAS * 86400}", "start": 0})
        try:
            page = get("https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?" + q)
            ids += [i for i in re.findall(r"urn:li:jobPosting:(\d+)", page) if i not in ids]
        except Exception as e:
            print("linkedin listado:", c, e)
        time.sleep(2)
    out = []
    for i in ids[:30]:
        try:
            page = get(f"https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/{i}")
        except Exception as e:
            print("linkedin detalle:", e)
            continue
        t = lambda pat: limpio(m.group(1)) if (m := re.search(pat, page, re.S)) else ""
        desc = t(r'class="show-more-less-html__markup[^"]*"[^>]*>(.*?)</div>')
        criterios = dict(zip(
            [limpio(x) for x in re.findall(r'description__job-criteria-subheader[^>]*>(.*?)</h3>', page, re.S)],
            [limpio(x) for x in re.findall(r'description__job-criteria-text[^>]*>(.*?)</span>', page, re.S)],
        ))
        out.append({
            "portal": "LinkedIn", "url": f"https://www.linkedin.com/jobs/view/{i}",
            "titulo": t(r'<h2[^>]*top-card-layout__title[^>]*>(.*?)</h2>'),
            "empresa": t(r'topcard__org-name-link[^>]*>(.*?)</a>') or t(r'topcard__flavor[^>]*>(.*?)</span>'),
            "salario": t(r'compensation__salary[^>]*>(.*?)</div>'),
            "ubicacion": t(r'topcard__flavor--bullet[^>]*>(.*?)</span>'),
            "publicada": "", "hace": t(r'posted-time-ago__text[^>]*>(.*?)</span>'),
            "contrato": criterios.get("Employment type", criterios.get("Tipo de empleo", "")),
            "experiencia": criterios.get("Seniority level", criterios.get("Nivel de antigüedad", "")),
            "descripcion": desc[:DESCRIPCION_MAX],
        })
        time.sleep(3.5)
    return out


# ---------- Computrabajo ----------
def computrabajo():
    urls = []
    for c in CARGOS:
        slug = re.sub(r"\s+", "-", c)
        try:
            page = get(f"https://co.computrabajo.com/trabajo-de-{slug}-en-bogota-dc")
            for h in re.findall(r'href="(/ofertas-de-trabajo/[^"#]+)', page):
                u = "https://co.computrabajo.com" + h
                if u not in urls:
                    urls.append(u)
        except Exception as e:
            print("computrabajo listado:", c, e)
        time.sleep(1)
    out = []
    for url in urls[:45]:
        try:
            page = get(url)
        except Exception as e:
            print("computrabajo detalle:", e)
            continue
        jp = job_posting(page)
        if jp:
            o = de_jobposting(jp)
        else:
            texto = limpio(page)
            i = texto.find("Volver al listado")
            h1 = re.search(r"<h1[^>]*>(.*?)</h1>", page, re.S)
            o = {"titulo": limpio(h1.group(1)) if h1 else "", "empresa": "", "salario": "", "ubicacion": "Bogotá", "publicada": "", "vence": "", "contrato": "",
                 "descripcion": texto[i:i + DESCRIPCION_MAX] if i >= 0 else texto[:DESCRIPCION_MAX]}
        o.update({"portal": "Computrabajo", "url": url})
        out.append(o)
        time.sleep(0.8)
    return out


# ---------- Magneto ----------
RELEVANTE = re.compile(r"tesor|cartera|recaud|cobr|administrativ|asistente|cuentas por|office|gerencia|ejecutiv|coordinador|financ|pagos|factur|backoffice|back office", re.I)


def magneto():
    urls = []
    for path in ("vacantes-en-administracion-oficina", "vacantes-en-contabilidad-finanzas-impuestos", "ofertas-empleo-en-bogota"):
        try:
            page = get("https://www.magneto365.com/co/trabajos/" + path)
            for slug in re.findall(r'/co/empleos/([a-z0-9-]+-\d{5,})', page):
                u = "https://www.magneto365.com/co/empleos/" + slug
                if u not in urls and RELEVANTE.search(slug.replace("-", " ")):
                    urls.append(u)
        except Exception as e:
            print("magneto listado:", path, e)
        time.sleep(1)
    out = []
    for url in urls[:40]:
        try:
            page = get(url)
        except Exception as e:
            print("magneto detalle:", e)
            continue
        jp = job_posting(page)
        if not jp:
            continue
        o = de_jobposting(jp)
        o.update({"portal": "Magneto", "url": url})
        out.append(o)
        time.sleep(0.8)
    return out


def main():
    ya = set()
    try:
        ya = {x["d"].get("url") for x in json.loads((AQUI.parent / "ofertas.json").read_text(encoding="utf-8"))["ofertas"]}
    except Exception:
        pass
    todas, conteo = [], {}
    for nombre, fn in (("elempleo", elempleo), ("LinkedIn", linkedin), ("Computrabajo", computrabajo), ("Magneto", magneto)):
        try:
            lote = fn()
        except Exception as e:
            print(nombre, "falló:", e)
            lote = []
        conteo[nombre] = {"leidas": len(lote)}
        todas += lote
    vistas, salida = set(), []
    for o in todas:
        clave = (o.get("url"), (o.get("empresa", "") + "|" + o.get("titulo", "")).lower())
        if o.get("url") in ya or clave in vistas or not RELEVANTE.search(o.get("titulo", "") or o.get("descripcion", "")[:200]):
            continue
        vistas.add(clave)
        f = fecha_iso(o.get("publicada", ""))
        v = fecha_iso(o.get("vence", ""))
        texto = " ".join(str(o.get(k, "")) for k in ("titulo", "contrato", "ubicacion", "descripcion"))
        if (f and (HOY - f).days > DIAS) or (v and v < HOY) or EXCLUIR.search(o.get("contrato", "") + " " + o.get("titulo", "")):
            continue
        smax = salario_max_cop(o.get("salario", ""))
        if smax and smax < 2_800_000:
            continue
        ub = o.get("ubicacion", "")
        if ub and not re.search(r"bogot|colombia|remot", ub, re.I) and not re.search(r"remot|teletrabajo|100\s*% virtual", texto, re.I):
            continue
        if re.search(r"presencial", ub, re.I) and not re.search(r"h[ií]brid|remot", texto, re.I):
            continue
        salida.append(o)
    for o in salida:
        conteo[o["portal"]]["para_evaluar"] = conteo[o["portal"]].get("para_evaluar", 0) + 1
    SALIDA.write_text(json.dumps({
        "generado": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "conteo": conteo,
        "ofertas": salida,
    }, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(conteo, ensure_ascii=False))


if __name__ == "__main__":
    main()
