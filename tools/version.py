"""Setzt die Fassungsnummer in allen Dateien der App.

Aufruf:  python3 tools/version.py 6

Jede Datei wird mit ?v=<Nummer> geladen. So holt das iPhone nach einer
Änderung sicher alle Dateien neu und mischt keine alten mit neuen.
"""
import pathlib
import re
import sys

nummer = int(sys.argv[1])
wurzel = pathlib.Path(__file__).resolve().parent.parent
dateien = [wurzel / 'index.html'] + sorted((wurzel / 'js').glob('*.js'))
for datei in dateien:
    alt = datei.read_text(encoding='utf-8')
    neu = re.sub(r'\?v=\d+', '?v=%d' % nummer, alt)
    neu = re.sub(r'const VERSION = \d+;', 'const VERSION = %d;' % nummer, neu)
    if neu != alt:
        datei.write_text(neu, encoding='utf-8')
        print('aktualisiert:', datei.relative_to(wurzel))
