#!/usr/bin/env python3
"""build.py - assemble the single-file app: src/*  ->  index.html
Only needed if you edit files in src/ (index.html is already built).
Run:  python tools/build.py
It inlines CSS (+ base64 fonts), React, htm, data/seed.json and the app scripts."""
import base64
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC, VENDOR = ROOT / "src", ROOT / "vendor"
read = lambda p: Path(p).read_text(encoding="utf-8")
b64 = lambda p: base64.b64encode(Path(p).read_bytes()).decode()

css = read(SRC / "style.css").replace("__GEISTMONO__", b64(VENDOR / "geist-mono.woff2")).replace("__GEIST__", b64(VENDOR / "geist.woff2"))
seed = json.dumps(json.loads(read(ROOT / "data" / "seed.json")), ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
app = "\n".join(read(SRC / f) for f in ["verify.js", "core.js", "ui_common.js", "ui_today.js", "ui_more.js", "ui_dash.js", "ui_app.js"])
app = app.replace("</script", "<\\/script")

page = read(SRC / "template.html")
for key, val in {"/*__CSS__*/": css, "/*__REACT__*/": read(VENDOR / "react.production.min.js"), "/*__REACTDOM__*/": read(VENDOR / "react-dom.production.min.js"),
                 "/*__HTM__*/": read(VENDOR / "htm.umd.js"), "/*__SEED__*/": seed, "/*__APP__*/": app}.items():
    page = page.replace(key, val)
(ROOT / "index.html").write_text(page, encoding="utf-8")
print(f"wrote index.html ({len(page) / 1024:.0f} KB)")
