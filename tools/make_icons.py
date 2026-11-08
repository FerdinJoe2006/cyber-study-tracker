#!/usr/bin/env python3
"""make_icons.py - draw the app icons (192, 512, 180 apple-touch, maskable 512) with Pillow.
Run:  python tools/make_icons.py      (needs: pip install pillow)"""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "icons"
OUT.mkdir(exist_ok=True)
S = 1024  # draw big, then downscale for smooth edges
AMBER, LILAC, BG1, BG2 = (245, 176, 65), (167, 139, 250), (24, 21, 34), (38, 30, 58)


def draw(maskable: bool) -> Image.Image:
    img = Image.new("RGBA", (S, S), BG1 + (255,))
    px = img.load()
    for y in range(S):  # soft diagonal gradient
        for x in range(0, S, 1):
            t = (x + y) / (2 * S)
            px[x, y] = tuple(int(BG1[i] + (BG2[i] - BG1[i]) * t) for i in range(3)) + (255,)
    d = ImageDraw.Draw(img)
    pad = 0.18 * S if maskable else 0.10 * S  # maskable icons need a bigger safe zone
    # terminal prompt ">" and "_" in amber
    w = int(0.075 * S)
    x0, x1, yc, h = pad + 0.12 * S, pad + 0.36 * S, S / 2 - 0.02 * S, 0.17 * S
    d.line([(x0, yc - h), (x1, yc), (x0, yc + h)], fill=AMBER, width=w, joint="curve")
    for cx, cy in ((x0, yc - h), (x1, yc), (x0, yc + h)):
        d.ellipse([cx - w / 2, cy - w / 2, cx + w / 2, cy + w / 2], fill=AMBER)
    ux0, ux1, uy = pad + 0.44 * S, pad + 0.70 * S, yc + h
    d.rounded_rectangle([ux0, uy - w / 2, ux1, uy + w / 2], radius=w / 2, fill=LILAC)
    if not maskable:  # rounded corners for the normal icon
        mask = Image.new("L", (S, S), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, S, S], radius=int(0.22 * S), fill=255)
        out = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        out.paste(img, mask=mask)
        return out
    return img


for name, size, mk in (("icon-192.png", 192, False), ("icon-512.png", 512, False),
                       ("apple-touch-icon.png", 180, False), ("icon-maskable-512.png", 512, True)):
    draw(mk).resize((size, size), Image.LANCZOS).save(OUT / name)
    print("wrote", OUT / name)
