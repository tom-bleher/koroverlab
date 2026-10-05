#!/usr/bin/env python3
"""Refresh the publication list in index.html from a Google Scholar profile.

    python3 scripts/update_publications.py [SCHOLAR_USER]

Google Scholar has no API, so this reads the public profile page (the one
kind of request its robots.txt allows) and rewrites the block between the
publications:start and publications:end markers. If the page cannot be
fetched or does not look like the right profile, index.html is left
untouched and the script exits with an error.
"""
import html
import re
import sys
import urllib.request
from pathlib import Path

SCHOLAR_USER = ""          # the user=... value in the profile URL
EXPECTED_NAME = "Korover"  # guards against a wrong ID or a block page
LIMIT = 15                 # newest articles to show (Scholar serves 20)

INDEX = Path(__file__).resolve().parent.parent / "index.html"
INSPIRE = "https://inspirehep.net/literature?q=a%20Korover%2C%20I&amp;sort=mostrecent"
BLOCK = re.compile(r"(<!-- publications:start.*?-->\n).*?(\n *<!-- publications:end -->)", re.S)


def text(fragment):
    """Plain text of an HTML fragment."""
    return html.unescape(re.sub(r"<[^>]+>", "", fragment)).strip()


def fetch(user):
    url = f"https://scholar.google.com/citations?user={user}&hl=en&sortby=pubdate"
    request = urllib.request.Request(url, headers={"User-Agent": "koroverlab-publications/1.0 (weekly research-group site update)"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read().decode(response.headers.get_content_charset() or "utf-8", "replace")


def parse(page):
    name = re.search(r'id="gsc_prf_in">(.*?)</div>', page)
    if not name or EXPECTED_NAME not in name.group(1):
        raise ValueError(f"not {EXPECTED_NAME}'s profile (found: {text(name.group(1)) if name else 'no profile'})")
    articles = []
    for row in re.findall(r'<tr class="gsc_a_tr">(.*?)</tr>', page, re.S):
        link = re.search(r'<a href="([^"]+)" class="gsc_a_at">(.*?)</a>', row, re.S)
        authors, venue = re.findall(r'<div class="gs_gray">(.*?)</div>', row, re.S)
        year = re.search(r'class="gsc_a_h[^"]*">(\d{4})<', row)
        venue = text(re.sub(r'<span class="gs_oph">.*?</span>', "", venue))
        arxiv = re.search(r"arXiv:(\d{4}\.\d{4,5})", venue)
        articles.append({
            "title": text(link.group(2)),
            "url": f"https://arxiv.org/abs/{arxiv.group(1)}" if arxiv else "https://scholar.google.com" + html.unescape(link.group(1)),
            "authors": text(authors),
            "venue": venue,
            "year": year.group(1) if year else "",
        })
    if not articles:
        raise ValueError("no articles found on the profile page")
    return articles


def render(articles, user):
    items = []
    for a in articles[:LIMIT]:
        details = " · ".join(html.escape(part, quote=False) for part in (a["authors"], a["venue"]) if part)
        items.append(
            "      <li>\n"
            f'        <span class="year">{a["year"]}</span>\n'
            f'        <p><a href="{html.escape(a["url"])}">{html.escape(a["title"], quote=False)}</a><br>\n'
            f"        {details}</p>\n"
            "      </li>"
        )
    return (
        '    <ol class="pubs">\n' + "\n".join(items) + "\n    </ol>\n"
        f'    <p>Latest articles, updated automatically from <a href="https://scholar.google.com/citations?user={user}&amp;hl=en&amp;sortby=pubdate">Google Scholar</a>. '
        f'Full list also on <a href="{INSPIRE}">INSPIRE</a>.</p>'
    )


def main():
    user = sys.argv[1] if len(sys.argv) > 1 else SCHOLAR_USER
    if not user:
        sys.exit("Set SCHOLAR_USER or pass the Scholar user ID as an argument.")
    old = INDEX.read_text(encoding="utf-8")
    if not BLOCK.search(old):
        sys.exit(f"publications markers not found in {INDEX}")
    try:
        block = render(parse(fetch(user)), user)
    except Exception as error:  # network trouble, block page, changed markup
        sys.exit(f"Publications not updated: {error}")
    new = BLOCK.sub(lambda m: m.group(1) + block + m.group(2), old)
    if new == old:
        print("Publications already up to date.")
    else:
        INDEX.write_text(new, encoding="utf-8")
        print(f"Updated {INDEX.name} with {min(LIMIT, block.count('<li>'))} articles.")


if __name__ == "__main__":
    main()
