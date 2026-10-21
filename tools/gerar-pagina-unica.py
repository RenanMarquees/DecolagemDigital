#!/usr/bin/env python3
"""Junta index + estilo + scripts numa única página HTML (útil para publicar como artifact).
Uso: python3 tools/gerar-pagina-unica.py saida/index.html"""
import re
import sys
from pathlib import Path

raiz = Path(__file__).resolve().parent.parent
saida = Path(sys.argv[1] if len(sys.argv) > 1 else 'pagina-unica.html')

css = (raiz / 'style.css').read_text()
ordem = ['data.js', 'cartas.js', 'cenarios.js', 'eventos.js', 'logic.js', 'mapas.js', 'minis.js', 'tatica.js', 'vendor/three.min.js', 'modelos3d.js', 'modelos3d/heroi.js', 'modelos3d/valhala.js', 'modelos3d/olimpo.js', 'modelos3d/inferno.js', 'modelos3d/duat.js', 'modelos3d/estruturas.js', 'cena3d.js', 'tutorial.js', 'ui.js']
scripts = ''.join((raiz / 'js' / f).read_text() + '\n' for f in ordem)
assert '</script' not in scripts
# O service worker não funciona dentro da página publicada: removemos só esse trecho
scripts = re.sub(r"if \('serviceWorker' in navigator.*?\n\}\n", '', scripts, flags=re.S)

saida.parent.mkdir(parents=True, exist_ok=True)
saida.write_text(f"""<title>Fio do Destino</title>
<style>
{css}
</style>
<div id="app"></div>
<div id="modal"></div>
<script>
{scripts}
</script>
""")
print(f'{saida} ({saida.stat().st_size // 1024} KB)')
