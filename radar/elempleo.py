"""Lee ofertas de elempleo.com y las deja en radar/elempleo.json para la rutina en la nube.

Corre en GitHub Actions (tiene internet abierto). Solo lee páginas públicas.
"""
import datetime
import html
import json
import re
import time
import urllib.request
from pathlib import Path

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36"
BASE = "https://www.elempleo.com/co/ofertas-empleo/"
BUSQUEDAS = [
    "trabajo-analista-tesoreria",
    "trabajo-analista-cartera",
    "trabajo-analista-administrativo",
    "trabajo-analista-administrativo-financiero",
    "trabajo-asistente-gerencia",
    "trabajo-asistente-ejecutiva",
    "trabajo-asistente-administrativo",
    "trabajo-cuentas-por-pagar",
    "trabajo-cuentas-por-cobrar",
    "trabajo-office-manager",
    "trabajo-coordinador-administrativo",
]
MODALIDADES = ["modalidad-h%C3%ADbrido", "modalidad-remoto"]
MAX_DETALLES = 80
SALIDA = Path(__file__).with_name("elempleo.json")


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "es-CO,es;q=0.9"})
    with urllib.request.urlopen(req, timeout=30) as r:
        raw = r.read()
    for enc in ("utf-8", "cp1252"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", "replace")


def urls_de_listado(page):
    return set(re.findall(r'"@id":\s*"(https://www\.elempleo\.com/co/ofertas-trabajo/[^"#]+)"', page))


def fecha(d):
    try:
        dd, mm, yy = (int(x) for x in d.split("-"))
        return datetime.date(yy, mm, dd)
    except Exception:
        return None


def detalle(url):
    page = get(url)
    m = re.search(r"let offerData = \{(.*?)\};", page, re.S)
    if not m:
        return None
    data = {k: html.unescape(v) for k, v in re.findall(r"(\w+):\s*'((?:[^'\\]|\\.)*)'", m.group(1))}
    desc = ""
    for block in re.findall(r'<script[^>]*application/ld\+json[^>]*>(.*?)</script>', page, re.S):
        if '"JobPosting"' in block:
            dm = re.search(r'"description":\s*"(.*?)",\s*"datePosted"', block, re.S)
            if dm:
                desc = dm.group(1).replace("\\r\\n", "\n").replace("\\n", "\n").replace('\\"', '"')
            break
    fin = fecha(data.get("dateFinished", ""))
    return {
        "url": url,
        "titulo": data.get("title", ""),
        "empresa": data.get("company", ""),
        "salario": data.get("salary", ""),
        "ubicacion": data.get("location", ""),
        "publicada": str(fecha(data.get("datePublish", "")) or data.get("datePublish", "")),
        "vence": str(fin or data.get("dateFinished", "")),
        "contrato": data.get("contract", ""),
        "experiencia": data.get("experience", ""),
        "nivel": data.get("offerLevel", ""),
        "sector": data.get("sector", ""),
        "palabras_clave": data.get("keywords", ""),
        "descripcion": html.unescape(desc)[:2500],
        "_vencida": bool(fin and fin < datetime.date.today()),
    }


def main():
    urls = set()
    for b in BUSQUEDAS:
        for mod in MODALIDADES:
            try:
                urls |= urls_de_listado(get(BASE + b + "-" + mod))
            except Exception as e:
                print("listado falló:", b, mod, e)
            time.sleep(1)
    print("ofertas en listados:", len(urls))
    ofertas = []
    for url in sorted(urls, key=lambda u: re.sub(r"\D", "", u[-10:]), reverse=True)[:MAX_DETALLES]:
        try:
            d = detalle(url)
        except Exception as e:
            print("detalle falló:", url, e)
            continue
        if d and not d.pop("_vencida"):
            ofertas.append(d)
        time.sleep(0.7)
    SALIDA.write_text(json.dumps({
        "generado": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
        "fuente": "elempleo.com (listados híbrido y remoto)",
        "ofertas": ofertas,
    }, ensure_ascii=False, indent=1), encoding="utf-8")
    print("guardadas:", len(ofertas))


if __name__ == "__main__":
    main()
