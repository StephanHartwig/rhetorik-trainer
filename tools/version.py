"""Setzt die Fassungsnummer in allen Dateien der App.

Aufruf:  python3 tools/version.py 20.1

Jede Datei wird mit ?v=<Nummer> geladen. So holt das iPhone nach einer
Änderung sicher alle Dateien neu und mischt keine alten mit neuen.
"""
import pathlib
import re
import sys

# "20.1" wird intern zu 2001 (Hauptnummer * 100 + Unterstufe); die App zeigt wieder "20.1" an.
# Eine reine Zahl ohne Punkt ("21") bedeutet "21.0" und wird zu 2100.
haupt, _, unter = sys.argv[1].partition('.')
nummer = int(haupt) * 100 + int(unter or 0)
assert 0 <= int(unter or 0) <= 99
wurzel = pathlib.Path(__file__).resolve().parent.parent
dateien = [wurzel / 'index.html'] + sorted((wurzel / 'js').glob('*.js'))
for datei in dateien:
    alt = datei.read_text(encoding='utf-8')
    neu = re.sub(r'\?v=\d+', '?v=%d' % nummer, alt)
    neu = re.sub(r'const VERSION = \d+;', 'const VERSION = %d;' % nummer, neu)
    if neu != alt:
        datei.write_text(neu, encoding='utf-8')
        print('aktualisiert:', datei.relative_to(wurzel))
