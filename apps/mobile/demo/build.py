"""
Builds the offline, single-file web preview of the app (no server needed).

  1. MEDDEXA_SINGLE_BUNDLE=1 EXPO_PUBLIC_API_URL=https://demo.meddexa.invalid npx expo export --platform web
  2. esbuild demo/shim.ts --bundle --format=iife --alias:@meddexa/shared=../../packages/shared/src/index.ts --outfile=<shim.js>
  3. python3 demo/build.py dist <shim.js> <data.json> <out.html>

Every script, font and image is inlined so the file works from any URL (or from disk).
The demo catalogue in <data.json> is the fictional seed data recorded from the API.
"""
import base64
import glob
import json
import mimetypes
import os
import re
import sys

dist, shim_path, data_path, out_path = sys.argv[1:5]


def data_uri(path: str) -> str:
    mime = mimetypes.guess_type(path)[0] or ('font/ttf' if path.endswith('.ttf') else 'application/octet-stream')
    with open(path, 'rb') as f:
        return f'data:{mime};base64,{base64.b64encode(f.read()).decode()}'


def safe(js: str) -> str:
    return js.replace('</script', '<\\/script')


html = open(os.path.join(dist, 'index.html'), encoding='utf-8').read()
entry_src = re.search(r'<script src="(/_expo/static/js/web/entry-[^"]+\.js)"', html).group(1)
entry = open(os.path.join(dist, entry_src.lstrip('/')), encoding='utf-8').read()

# Static assets referenced by absolute path → data URIs.
for ref in sorted(set(re.findall(r'"(/assets/[^"]+)"', entry))):
    entry = entry.replace(f'"{ref}"', json.dumps(data_uri(os.path.join(dist, ref.lstrip('/')))))
# Lazily loaded chunks (web barcode-detector polyfill) → data URIs as well.
for ref in sorted(set(re.findall(r'"(/_expo/static/js/web/[^"]+\.js)"', entry))):
    if ref != entry_src:
        entry = entry.replace(f'"{ref}"', json.dumps(data_uri(os.path.join(dist, ref.lstrip('/'))).replace('application/octet-stream', 'text/javascript')))

shim = open(shim_path, encoding='utf-8').read()
data = open(data_path, encoding='utf-8').read()

route_fix = """(function(){try{if(location.pathname!=='/'){history.replaceState(history.state,'','/'+location.search+location.hash);}}catch(e){console.warn('MedDexa preview: could not reset path',e);}})();"""

banner = """<div id="mdx-demo-banner" style="position:fixed;right:8px;top:6px;z-index:9999;background:#B7791F;color:#fff;font:600 10px/1.3 system-ui,sans-serif;padding:3px 10px;border-radius:999px;pointer-events:none;opacity:.92">Preview · fictional demo data</div>"""

html = re.sub(r'<link rel="icon"[^>]*/?>', '', html)
html = html.replace(f'<script src="{entry_src}" defer></script>', '')
html = html.replace(
    '</body>',
    f'<script>window.__MDX_DATA={safe(data)};</script>'
    + f'<script>{safe(shim)}</script>'
    + f'<script>{route_fix}</script>'
    + f'<script>{safe(entry)}</script>'
    + '</body>',
)
html = html.replace('<title>MedDexa</title>', '<title>MedDexa Preview</title>')
open(out_path, 'w', encoding='utf-8').write(html)
print(out_path, round(os.path.getsize(out_path) / 1e6, 2), 'MB')
