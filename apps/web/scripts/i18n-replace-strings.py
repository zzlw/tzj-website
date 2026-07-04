#!/usr/bin/env python3
"""Replace hardcoded Chinese strings in page.tsx with t()/t.raw() using page JSON."""
from __future__ import annotations

import glob
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "src/app"
JSON_DIR = ROOT / "src/messages/zh-CN/pages"

CONST_TO_KEY = {
    "STANDARD_FEATURES": "standardFeatures",
    "CUSTOM_FEATURES": "customFeatures",
    "COMPARE": "compare",
    "SERIES": "series",
    "COMPARE_ROWS": "compareRows",
    "SPECS": "specs",
    "LINER_FEATURES": "linerFeatures",
    "FEATURES": "features",
    "CAPABILITIES": "capabilities",
    "PROPS": "props",
    "MARITIME_FEATURES": "maritimeFeatures",
    "TACTICAL_SCENARIOS": "tacticalScenarios",
    "HAZMAT_PRODUCTS": "hazmatProducts",
    "PILLARS": "pillars",
    "VALUES": "values",
    "PRODUCTS": "products",
    "EXPLORE": "explore",
    "SECTIONS": "sections",
    "GROUPS": "groups",
    "TRAILER_FEATURES": "trailerFeatures",
}


def kebab_to_camel(s: str) -> str:
    parts = s.split("-")
    return parts[0] + "".join(p.capitalize() for p in parts[1:])


def page_id(fpath: str) -> str:
    rel = fpath.split("/[locale]/")[-1].replace("/page.tsx", "")
    return rel.replace("/", "-") or "home"


def flatten_paths(obj, prefix: str = "") -> dict[str, str]:
    """Map string value -> dot path (for scalar replacement)."""
    out: dict[str, str] = {}
    if isinstance(obj, str):
        if re.search(r"[\u4e00-\u9fff]", obj) and len(obj) > 1:
            out[obj] = prefix
    elif isinstance(obj, dict):
        for k, v in obj.items():
            p = f"{prefix}.{k}" if prefix else k
            if isinstance(v, list) and v and all(isinstance(x, str) for x in v):
                continue  # arrays handled via t.raw
            out.update(flatten_paths(v, p))
    elif isinstance(obj, list):
        if obj and all(isinstance(x, str) for x in obj):
            return out
        for i, v in enumerate(obj):
            out.update(flatten_paths(v, f"{prefix}.{i}"))
    return out


def remove_const_blocks(src: str, keys_in_json: set[str]) -> str:
    for const, key in CONST_TO_KEY.items():
        if key not in keys_in_json:
            continue
        src = re.sub(
            rf"const {const} = [\s\S]*?;\n\n?",
            "",
            src,
            count=1,
        )
        src = src.replace(f"{{{const}.map", f"{{(t.raw(\"{key}\") as typeof {const}).map")
        src = src.replace(f"{CONST_TO_KEY.get(const, key)}.map", f"(t.raw(\"{key}\") as any[]).map")
        # fix map usages
        src = re.sub(rf"\b{const}\.map\b", f'(t.raw("{key}") as string[]).map', src)
        src = re.sub(rf"\b{const}\b", f't.raw("{key}")', src)
    return src


def replace_scalars(src: str, mapping: dict[str, str]) -> str:
    # longest first to avoid partial replacements
    for text, path in sorted(mapping.items(), key=lambda x: -len(x[0])):
        if path.endswith((".0", ".1")) and ".points." not in path:
            continue
        # JSX attribute strings
        src = src.replace(f'"{text}"', f'{{t("{path}")}}')
        src = src.replace(f"'{text}'", f'{{t("{path}")}}')
    return src


def process(fpath: str) -> bool:
    if "[slug]" in fpath or "/contact/" in fpath or fpath.endswith("/page.tsx") and fpath.split("/[locale]/")[-1] == "page.tsx":
        return False
    pid = page_id(fpath)
    json_path = JSON_DIR / f"{pid}.json"
    if not json_path.exists():
        return False
    data = json.loads(json_path.read_text(encoding="utf-8"))
    src = Path(fpath).read_text(encoding="utf-8")
    if "getTranslations" not in src:
        return False
    orig = src
    keys = set(data.keys())
    src = remove_const_blocks(src, keys)
    mapping = flatten_paths(data)
    # don't replace already translated
    src = replace_scalars(src, mapping)
    # fix double braces
    src = re.sub(r"\{\{t\(", "{t(", src)
    src = re.sub(r"\)\}\}", ")}", src)
    if src != orig:
        Path(fpath).write_text(src, encoding="utf-8")
        return True
    return False


def main():
    n = 0
    for f in sorted(glob.glob(str(APP / "[[]locale[]]" / "**/page.tsx"), recursive=True)):
        if process(f):
            n += 1
            print("Updated:", f.split("/[locale]/")[-1])
    print("Done:", n)


if __name__ == "__main__":
    main()
