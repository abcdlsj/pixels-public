#!/usr/bin/env python3
"""Build dock/index.html from dock/src.

The page is a single self-contained file: the sources are concatenated in order and the
Fusion Pixel 12px font (SIL OFL 1.1) is subset to the characters the page uses and inlined
as a data URI.

    pip install fonttools brotli
    python3 dock/build.py                       # writes dock/index.html
    python3 dock/build.py --fragment out.html   # also writes the body-only fragment (no <html>/<head>)
    python3 dock/build.py --lang zh             # Chinese only, no language switch: writes dock/dist/zh/index.html

The source font is downloaded once from npm (@fontsource/fusion-pixel-12px-proportional-sc)
into dock/.fontsrc/, which is git-ignored.
"""
import base64, io, json, os, re, subprocess, sys, tarfile, tempfile, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'src')
FONT_PKG, FONT_VER = '@fontsource/fusion-pixel-12px-proportional-sc', '5.3.0'
FONT_FILE = 'package/files/fusion-pixel-12px-proportional-sc-latin-400-normal.woff2'
# script order matters: engine constants first, i18n before the UI, the UI last (it boots the game)
SCRIPTS = ['engine.js', 'i18n.js', 'materials.js', 'raster.js', 'game.js', 'render.js', 'audio.js', 'ui.js']


def source_font():
    cache = os.path.join(HERE, '.fontsrc')
    path = os.path.join(cache, 'fusion-pixel-12px.woff2')
    if os.path.exists(path):
        return path
    os.makedirs(cache, exist_ok=True)
    meta = json.load(urllib.request.urlopen(f'https://registry.npmjs.org/{FONT_PKG}/{FONT_VER}'))
    tf = tarfile.open(fileobj=io.BytesIO(urllib.request.urlopen(meta['dist']['tarball']).read()))
    with open(path, 'wb') as f:
        f.write(tf.extractfile(FONT_FILE).read())
    with open(os.path.join(HERE, 'FONT-LICENSE.txt'), 'wb') as f:
        f.write(tf.extractfile('package/LICENSE').read())
    return path


def read(name):
    with open(os.path.join(SRC, name), encoding='utf-8') as f:
        return f.read()


def single_language(head, i18n, lang):
    """Keep one language: drop the other string tables and the switch, pin LANG, and put that
    language's text straight into the markup so nothing else flashes before applyLang runs."""
    tables = dict(re.findall(r'\n  (\w+): \{\n(.*?)\n  \},', i18n, re.S))
    if lang not in tables:
        sys.exit(f'unknown language {lang!r}; have {", ".join(tables)}')
    for other in tables:
        if other != lang:
            i18n = re.sub(r'\n  ' + other + r': \{\n.*?\n  \},', '', i18n, count=1, flags=re.S)
    i18n = i18n.replace('const ONLY_LANG = null;', f"const ONLY_LANG = '{lang}';")
    strings = dict(re.findall(r"(\w+): '([^']*)'", tables[lang]))
    head = re.sub(r'\n *<button[^>]*id="lang"[^>]*></button>', '', head)
    head = re.sub(r'data-i18n="(\w+)">[^<]*<', lambda m: f'data-i18n="{m[1]}">{strings[m[1]]}<', head)
    head = re.sub(r'data-i18n-label="(\w+)" aria-label="[^"]*"', lambda m: f'data-i18n-label="{m[1]}" aria-label="{strings[m[1]]}"', head)
    head = re.sub(r'<title>[^<]*</title>', f"<title>{strings['title']}</title>", head)
    return head, i18n


def main():
    lang = sys.argv[sys.argv.index('--lang') + 1] if '--lang' in sys.argv else None
    head = read('head.html')
    sources = {n: read(n) for n in SCRIPTS}
    if lang:
        head, sources['i18n.js'] = single_language(head, sources['i18n.js'], lang)
    split = head.index('</style>') + len('</style>')
    styles, markup = head[:split], head[split:]
    script = '\n'.join(sources[n].rstrip('\n') for n in SCRIPTS)
    fragment = styles + markup + '\n<script>\n' + script + '\n</script>\n'

    # every character on the page goes into the font subset (every language left in i18n.js)
    chars = ''.join(sorted({c for c in fragment if ord(c) > 0x20}))
    with tempfile.TemporaryDirectory() as tmp:
        sub = os.path.join(tmp, 'sub.woff2')
        subprocess.run(['pyftsubset', source_font(), '--text=' + chars, '--flavor=woff2', '--output-file=' + sub], check=True)
        with open(sub, 'rb') as f:
            b64 = base64.b64encode(f.read()).decode()
    fragment = fragment.replace('__FONT_B64__', b64)

    html_lang = {'zh': 'zh-CN'}.get(lang, lang or 'en')
    page = ('<!doctype html>\n<html lang="' + html_lang + '">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            + fragment[:fragment.index('</style>') + len('</style>')]
            + '\n</head>\n<body>\n' + fragment[fragment.index('</style>') + len('</style>'):] + '</body>\n</html>\n')
    out = os.path.join(HERE, 'dist', lang, 'index.html') if lang else os.path.join(HERE, 'index.html')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, 'w', encoding='utf-8') as f:
        f.write(page)
    print(f'{os.path.relpath(out)}: {len(page.encode()) // 1024} KB, font subset {len(b64) * 3 // 4 // 1024} KB, {len(chars)} glyphs')

    if '--fragment' in sys.argv:
        frag_out = sys.argv[sys.argv.index('--fragment') + 1]
        with open(frag_out, 'w', encoding='utf-8') as f:
            f.write(fragment)
        print('fragment:', frag_out)


if __name__ == '__main__':
    main()
