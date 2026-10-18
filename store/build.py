#!/usr/bin/env python3
"""Render the Chrome Web Store images and the website's social image.

    python3 store/build.py

Needs Google Chrome (set CHROME=/path/to/chrome to override). Steps:
  1. copies popup.css into store/ui/ so the saved UI states match the extension,
  2. writes one HTML layout per image into store/src/pages/ (open these to preview),
  3. renders them with headless Chrome at the exact sizes the store asks for.

store/ui/*.html are real popup states saved from the running extension with demo cookies.
"""
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

STORE = Path(__file__).resolve().parent
ROOT = STORE.parent
PAGES = STORE / 'src' / 'pages'
CHROME = os.environ.get('CHROME', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')

SCREENSHOTS = [
    ('1-every-cookie', 'list', 'See <em>every</em> cookie, even the hidden ones', [
        'Cookies set on other paths',
        'Partitioned (CHIPS) cookies',
        'Cookies from embedded sites',
        'Updates live as sites change them',
    ]),
    ('2-delete-all', 'delete', 'Delete all. <em>Keep</em> what matters.', [
        'Pin a cookie and “Delete all” skips it',
        'Protected cookies are kept too',
        'Only the cookies you see are deleted',
    ]),
    ('3-protect', 'editor', '<em>Protect</em> a cookie. Block the rest.', [
        'Protect: any change a site makes is undone',
        'Block: deleted the moment a site sets it',
        'Edit every field, including the partition',
    ]),
    ('4-import', 'import', 'Imports that <em>explain</em> themselves', [
        'JSON, Netscape cookies.txt and header strings',
        'Reads files from other cookie tools',
        'Every failed cookie says why',
    ]),
    ('5-backups', 'backups', 'Back up on a <em>schedule</em>', [
        'Every hour, day or week',
        'Restore or download any snapshot',
        'Kept only in your browser',
    ], True),
]


def page(name, body_class, content, title='Cookie Keeper'):
    html = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{title}</title>
<link rel="stylesheet" href="../promo.css">
</head>
<body class="{body_class}">
{content}
</body>
</html>
"""
    (PAGES / f'{name}.html').write_text(html)


BRAND = '<div class="brand"><img src="../../../icons/icon.svg" alt=""> Cookie Keeper</div>'


def window(state, dark=False):
    src = f'../../ui/{state}{".dark" if dark else ""}.html'
    return f'<div class="window"><iframe src="{src}" scrolling="no" tabindex="-1"></iframe></div>'


def write_pages():
    PAGES.mkdir(parents=True, exist_ok=True)
    for name, state, headline, points, *dark in SCREENSHOTS:
        dark = bool(dark and dark[0])
        items = ''.join(f'<li>{p}</li>' for p in points)
        page(f'screenshot-{name}', 'shot dark' if dark else 'shot',
             f'<div class="copy">{BRAND}<h1>{headline}</h1><ul class="points">{items}</ul></div>\n{window(state, dark)}')
    page('promo-small', 'tile',
         f'{BRAND}<p class="lede">Edit, pin, protect, block and back up your cookies.</p>')
    page('promo-marquee', 'marquee',
         f'<div class="copy">{BRAND}<h1>Your cookies, <em>under control</em></h1>'
         f'<p class="lede">The cookie editor built from what users kept asking for. Nothing leaves your browser.</p></div>\n'
         f'{window("list")}')
    page('social', 'social',
         f'<div class="copy">{BRAND}<h1>The cookie editor users <em>asked for</em></h1>'
         f'<p class="lede">Free and open source. Nothing leaves your browser.</p></div>\n{window("list")}')
    page('icon-128', 'icon128', '<img src="../../../icons/icon.svg" alt="">')


def write_ui_assets():
    shutil.copy(ROOT / 'popup.css', STORE / 'ui' / 'popup.css')
    # Dark copies of the UI states: popup.css only goes dark via prefers-color-scheme,
    # so load the same tokens unconditionally.
    css = (ROOT / 'popup.css').read_text()
    start = css.index('@media (prefers-color-scheme: dark)')
    block = css[css.index(':root', start):css.index('}', css.index(':root', start)) + 1]
    (STORE / 'ui' / 'dark.css').write_text(block + '\n')
    for f in (STORE / 'ui').glob('*.html'):
        if f.name.endswith('.dark.html'):
            continue
        html = f.read_text().replace('href="popup.css">', 'href="popup.css"><link rel="stylesheet" href="dark.css">')
        f.with_name(f.stem + '.dark.html').write_text(html)


def render(name, out, width, height, transparent=False):
    out.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as profile:
        args = [
            CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars',
            '--force-device-scale-factor=1', f'--user-data-dir={profile}',
            '--allow-file-access-from-files', '--lang=en-US', '--virtual-time-budget=5000',
            f'--window-size={width},{height}', f'--screenshot={out}',
        ]
        if transparent:
            args.append('--default-background-color=00000000')
        subprocess.run([*args, (PAGES / f'{name}.html').as_uri()], check=True,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(f'{out.relative_to(ROOT)}  {width}x{height}')


def main():
    write_ui_assets()
    write_pages()
    for name, *_ in SCREENSHOTS:
        render(f'screenshot-{name}', STORE / 'screenshots' / f'{name}.png', 1280, 800)
    render('promo-small', STORE / 'promo-small-440x280.png', 440, 280)
    render('promo-marquee', STORE / 'promo-marquee-1400x560.png', 1400, 560)
    render('icon-128', STORE / 'icon-128.png', 128, 128, transparent=True)
    render('social', ROOT / 'docs' / 'img' / 'social.png', 1280, 640)


if __name__ == '__main__':
    main()
