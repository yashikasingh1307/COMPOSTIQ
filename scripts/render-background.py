"""Rasterises src/assets/botanical-background.svg to an optimised WebP (needs playwright + Pillow)."""
import asyncio, pathlib
from playwright.async_api import async_playwright
from PIL import Image
root = pathlib.Path(__file__).resolve().parent.parent / 'src' / 'assets'
page = root / '_bg.html'
page.write_text('<body style="margin:0"><img src="botanical-background.svg" width="2000" height="1126" style="display:block">')
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 2000, 'height': 1126})
        await pg.goto(page.as_uri()); await pg.wait_for_timeout(1000)
        await pg.screenshot(path=str(root / '_bg.png')); await b.close()
    Image.open(root / '_bg.png').convert('RGB').save(root / 'botanical-background.webp', quality=80, method=6)
    (root / '_bg.png').unlink(); page.unlink()
asyncio.run(main())
