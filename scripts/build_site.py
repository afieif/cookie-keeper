#!/usr/bin/env python3
"""Refresh the generated parts of the GitHub Pages site in docs/.

    python3 scripts/build_site.py

- docs/privacy.html is generated from PRIVACY.md (the single source of truth).
- docs/ui/ gets the saved popup states from store/ui/ plus the current popup.css,
  which the home page shows as live previews.
- docs/img/icon.svg is copied from icons/icon.svg.

Run store/build.py as well to refresh docs/img/social.png.
"""
import html
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / 'docs'
UI_STATES = ['list', 'delete', 'editor', 'import', 'backups']


def inline(text):
    """The inline Markdown PRIVACY.md uses: links, `code`, **bold**, _italic_."""
    out, pos = [], 0
    for m in re.finditer(r'\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`', text):
        out.append(emphasis(html.escape(text[pos:m.start()], quote=False)))
        if m.group(3) is not None:
            out.append(f'<code>{html.escape(m.group(3))}</code>')
        else:
            out.append(f'<a href="{html.escape(m.group(2))}">{emphasis(html.escape(m.group(1), quote=False))}</a>')
        pos = m.end()
    out.append(emphasis(html.escape(text[pos:], quote=False)))
    return ''.join(out)


def emphasis(text):
    text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
    return re.sub(r'(?<!\w)_(.+?)_(?!\w)', r'<em>\1</em>', text)


def markdown(md):
    """Small converter for the block types PRIVACY.md uses: headings, paragraphs, lists, tables."""
    blocks, lines, i = [], md.splitlines(), 0
    while i < len(lines):
        line = lines[i]
        if not line.strip():
            i += 1
        elif line.startswith('#'):
            level = len(line) - len(line.lstrip('#'))
            blocks.append(f'<h{level}>{inline(line[level:].strip())}</h{level}>')
            i += 1
        elif line.startswith('|'):
            rows = []
            while i < len(lines) and lines[i].startswith('|'):
                cells = [c.strip() for c in lines[i].strip().strip('|').split('|')]
                if not all(re.fullmatch(r':?-+:?', c) for c in cells):
                    rows.append(cells)
                i += 1
            head = ''.join(f'<th>{inline(c)}</th>' for c in rows[0])
            body = ''.join('<tr>' + ''.join(f'<td>{inline(c)}</td>' for c in r) + '</tr>' for r in rows[1:])
            blocks.append(f'<div class="table"><table><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table></div>')
        elif line.startswith('- '):
            items = []
            while i < len(lines) and lines[i].startswith('- '):
                items.append(f'<li>{inline(lines[i][2:].strip())}</li>')
                i += 1
            blocks.append('<ul>' + ''.join(items) + '</ul>')
        else:
            para = []
            while i < len(lines) and lines[i].strip() and not lines[i].startswith(('#', '|', '- ')):
                para.append(lines[i].strip())
                i += 1
            blocks.append(f'<p>{inline(" ".join(para))}</p>')
    return '\n'.join(blocks)


def build_privacy():
    body = markdown((ROOT / 'PRIVACY.md').read_text())
    body = re.sub(r'<p><em>(Last updated: [^<]+)</em></p>', r'<p class="updated">\1</p>', body, count=1)
    page = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Privacy Policy – Cookie Keeper</title>
  <meta name="description" content="Cookie Keeper has no servers and never sends your cookies or any other data off your device.">
  <link rel="icon" href="img/icon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="site.css">
</head>
<body>
  <!-- Generated from PRIVACY.md by scripts/build_site.py. Edit PRIVACY.md instead. -->
  <header class="site-header">
    <div class="wrap">
      <a class="brand" href="./"><img src="img/icon.svg" alt=""> Cookie Keeper</a>
      <nav>
        <a href="./#features">Features</a>
        <a href="./#install" class="hide-sm">Install</a>
        <a href="privacy.html" aria-current="page">Privacy</a>
        <a href="https://github.com/afieif/cookie-keeper">GitHub</a>
      </nav>
    </div>
  </header>
  <main class="doc">
{body}
  </main>
  <footer class="site-footer">
    <div class="wrap">
      <span>© 2026 Cookie Keeper</span>
      <nav>
        <a href="./">Home</a>
        <a href="https://github.com/afieif/cookie-keeper">GitHub</a>
        <a href="mailto:fifdev@proton.me">fifdev@proton.me</a>
      </nav>
    </div>
  </footer>
</body>
</html>
"""
    (DOCS / 'privacy.html').write_text(page)
    print('docs/privacy.html')


def copy_assets():
    (DOCS / 'ui').mkdir(parents=True, exist_ok=True)
    (DOCS / 'img').mkdir(parents=True, exist_ok=True)
    shutil.copy(ROOT / 'popup.css', DOCS / 'ui' / 'popup.css')
    for state in UI_STATES:
        shutil.copy(ROOT / 'store' / 'ui' / f'{state}.html', DOCS / 'ui' / f'{state}.html')
    shutil.copy(ROOT / 'icons' / 'icon.svg', DOCS / 'img' / 'icon.svg')
    print('docs/ui/, docs/img/icon.svg')


if __name__ == '__main__':
    build_privacy()
    copy_assets()
