import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data' / 'events.json'
TZ_NAME = 'America/Argentina/Cordoba'

HEADERS = {'User-Agent': 'AgendaAuto/1.0 (+GitHub Actions)'}

SOURCES = [
    {
        'name': 'CTERA',
        'type': 'teacher',
        'url': 'https://ctera.org.ar/search/paro',
        'base': 'https://ctera.org.ar',
        'keywords': ['paro', 'jornada de lucha'],
    },
    {
        'name': 'CONADU Histórica',
        'type': 'university',
        'url': 'https://conaduhistorica.org.ar/',
        'base': 'https://conaduhistorica.org.ar',
        'keywords': ['paro', 'cese total', '48 horas', '72 horas'],
    },
    {
        'name': 'FATUN',
        'type': 'nonteacher',
        'url': 'https://www.fatun.org.ar/',
        'base': 'https://www.fatun.org.ar',
        'keywords': ['paro', 'medida de fuerza', 'medidas de fuerza'],
    },
]

DATE_PATTERNS = [
    re.compile(r'(?<!\d)(\d{1,2})\s*(?:y|al|-)?\s*(\d{1,2})?\s*de\s*(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)', re.I),
    re.compile(r'(?<!\d)(\d{1,2})\s*(?:y|al|-)?\s*(\d{1,2})?\s*/\s*(\d{1,2})(?:\s*/\s*(\d{4}))?'),
    re.compile(r'(?<!\d)(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)', re.I),
]
MONTHS = {m: i for i, m in enumerate(['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'], 1)}


def get(url: str) -> str:
    r = requests.get(url, headers=HEADERS, timeout=25)
    r.raise_for_status()
    return r.text


def parse_candidate_date(text: str, default_year: int):
    for p in DATE_PATTERNS:
        m = p.search(text)
        if not m:
            continue
        if p.pattern.startswith('(?<!\\d)(\\d{1,2})\\s*(?:y'):
            d1 = int(m.group(1)); d2 = m.group(2); month = MONTHS[m.group(3).lower()]
            return [(d1, month, default_year), *([(int(d2), month, default_year)] if d2 else [])]
        if '/\\s*' in p.pattern:
            d1 = int(m.group(1)); d2 = m.group(2); month = int(m.group(3)); year = int(m.group(4) or default_year)
            if d2:
                return [(d1, month, year), (int(d2), month, year)]
            return [(d1, month, year)]
        d1 = int(m.group(1)); month = MONTHS[m.group(2).lower()]
        return [(d1, month, default_year)]
    return []


def normalize_title(text: str) -> str:
    return re.sub(r'\s+', ' ', text).strip()


def infer_scope(title: str, body: str, source_type: str) -> str:
    s = (title + ' ' + body).lower()
    if source_type == 'teacher':
        if 'nacional' in s:
            return 'Nacional · docentes'
        return 'Docentes · verificar jurisdicción'
    if source_type == 'nonteacher':
        if 'nacional' in s or 'todas las universidades' in s:
            return 'Nacional · nodocentes universitarios'
        return 'Nodocentes · verificar alcance'
    if '57 universidades' in s or 'universidades nacionales' in s or 'nacional' in s:
        return 'Nacional · universidades nacionales'
    return 'Universitario · verificar alcance'


def extract_from_page(source):
    html = get(source['url'])
    soup = BeautifulSoup(html, 'html.parser')
    year = datetime.now(timezone.utc).year
    found = []

    for a in soup.find_all('a', href=True):
        title = normalize_title(a.get_text(' ', strip=True))
        if not title or len(title) < 8:
            continue
        lower = title.lower()
        if not any(k in lower for k in source['keywords']):
            continue
        href = urljoin(source['base'], a['href'])
        try:
            article_html = get(href)
        except Exception:
            continue
        article = BeautifulSoup(article_html, 'html.parser')
        body = normalize_title(article.get_text(' ', strip=True))
        combined = f'{title} {body[:18000]}'
        dates = parse_candidate_date(combined, year)
        for d, m, y in dates:
            iso = f'{y:04d}-{m:02d}-{d:02d}'
            if not re.match(r'^20\d\d-', iso):
                continue
            event_type = source['type']
            final_type = event_type
            if source['type'] == 'university' and ('nodocente' in combined.lower() and 'docente' not in combined.lower()):
                final_type = 'nonteacher'
            found.append({
                'id': f"auto-{source['name'].lower().replace(' ','-')}-{iso}-{abs(hash(title)) % 100000}",
                'date': iso,
                'title': title[:120],
                'description': title[:240],
                'type': final_type,
                'scope': infer_scope(title, body[:4000], source['type']),
                'source': source['name'],
                'source_url': href,
                'status': 'announced',
            })
    return found


def main():
    existing = json.loads(OUT.read_text(encoding='utf-8')) if OUT.exists() else {'events': []}
    old = {e['id']: e for e in existing.get('events', [])}

    found = []
    errors = []
    for source in SOURCES:
        try:
            found.extend(extract_from_page(source))
        except Exception as exc:
            errors.append(f"{source['name']}: {exc}")

    # Keep verified/manual events, plus newly discovered ones.
    for e in found:
        old[e['id']] = e

    events = list(old.values())
    events.sort(key=lambda e: (e.get('date',''), e.get('type',''), e.get('title','')))

    payload = {
        'updated_at': datetime.now(timezone.utc).isoformat(),
        'timezone': TZ_NAME,
        'events': events,
        'update_errors': errors,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')

    print(f'Wrote {len(events)} events')
    if errors:
        print('Update warnings:')
        for err in errors:
            print(' -', err)


if __name__ == '__main__':
    main()
