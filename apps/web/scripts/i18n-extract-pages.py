#!/usr/bin/env python3
"""Extract page content from page.tsx into zh-CN JSON files."""
from __future__ import annotations

import ast
import json
import re
import glob
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "src/app"
OUT = ROOT / "src/messages/zh-CN/pages"


def route_from_file(fpath: Path) -> str:
    rel = str(fpath).split("/[locale]/")[-1].replace("/page.tsx", "")
    return "/" + rel if rel else "/"


def page_id_from_route(route: str) -> str:
    return route.lstrip("/").replace("/", "-") or "home"


def extract_metadata(src: str) -> dict:
    m = re.search(r"export const metadata = generateSeo\(\{([\s\S]*?)\}\);", src)
    if not m:
        return {}
    block = m.group(1)
    meta: dict = {}
    for key in ("title", "description", "path"):
        km = re.search(rf'{key}:\s*(?:\n\s*)?["\']([^"\']+)["\']', block)
        if km:
            meta[key] = km.group(1)
    return {"meta": {"title": meta.get("title", ""), "description": meta.get("description", "")}}


def eval_js_array(block: str):
    """Best-effort parse JS object/array literals to Python."""
    block = block.strip()
    # normalize JS to JSON-ish
    s = block
    s = re.sub(r"(\w+):", r'"\1":', s)  # unquoted keys
    s = s.replace("'", '"')
    s = re.sub(r"(\w+\.\w+)", r'"\\1"', s)  # icon refs -> strings
    s = re.sub(r",\s*}", "}", s)
    s = re.sub(r",\s*]", "]", s)
    try:
        return json.loads(s)
    except json.JSONDecodeError:
        return block


def extract_const_objects(src: str) -> dict:
    """Extract top-level const NAME = [...] or {...} blocks."""
    results = {}
    pattern = re.compile(
        r"^const\s+([A-Z_][A-Z0-9_]*)\s*=\s*(\[[\s\S]*?\]|{[\s\S]*?});",
        re.MULTILINE,
    )
    for m in pattern.finditer(src):
        name = m.group(1)
        body = m.group(2)
        if not re.search(r"[\u4e00-\u9fff]", body):
            continue
        # capture string arrays simply
        if body.strip().startswith("["):
            items = re.findall(r'["\']([^"\']+)["\']', body)
            if items and all(re.search(r"[\u4e00-\u9fff]", i) for i in items[:1]):
                results[name] = items
        else:
            # object array - extract title/desc/name/q/a etc
            objs = []
            for obj in re.finditer(r"\{([\s\S]*?)\}", body):
                chunk = obj.group(1)
                o = {}
                for key in ("title", "desc", "name", "label", "q", "a", "prop", "value", "why", "spec", "eyebrow", "body"):
                    km = re.search(rf'{key}:\s*["\']([^"\']+)["\']', chunk)
                    if km:
                        o[key] = km.group(1)
                for key in ("modx", "container", "points"):
                    km = re.search(rf'{key}:\s*["\']([^"\']+)["\']', chunk)
                    if km:
                        o[key] = km.group(1)
                if "points:" in chunk:
                    pts = re.findall(r'["\']([^"\']+)["\']', chunk.split("points:")[-1])
                    if pts:
                        o["points"] = pts
                if o:
                    objs.append(o)
            if objs:
                results[name] = objs
    return results


def extract_hero_jsx(src: str) -> dict:
    hero = {}
    for comp in ("VideoHero", "PageHero"):
        m = re.search(rf"<{comp}([^/>]*)/?>", src)
        if m:
            attrs = m.group(1)
            for key in ("eyebrow", "title", "description"):
                km = re.search(rf'{key}=\{{?["\']([^"\']+)["\']\}}?', attrs)
                if km:
                    hero[key] = km.group(1)
            if hero:
                return {"hero": hero}
    # image hero section
    m = re.search(r"<Eyebrow inverted>([^<]+)</Eyebrow>", src)
    if m:
        hero["eyebrow"] = m.group(1).strip()
    m = re.search(r'<h1 className="rb-h1[^"]*"[^>]*>([^<]+)</h1>', src)
    if m:
        hero["title"] = m.group(1).strip()
    return {"hero": hero} if hero else {}


def camel_const(name: str) -> str:
    return name.lower()


def build_page_json(src: str) -> dict:
    data = extract_metadata(src)
    data.update(extract_hero_jsx(src))
    consts = extract_const_objects(src)
    key_map = {
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
    for k, v in consts.items():
        json_key = key_map.get(k, k.lower())
        data[json_key] = v
    return data


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    pattern = str(APP / "[[]locale[]]" / "**/page.tsx")
    count = 0
    for fpath in sorted(glob.glob(pattern, recursive=True)):
        if "[slug]" in fpath or "/contact/" in fpath:
            continue
        if fpath.endswith("/page.tsx") and fpath.count("/") == fpath.replace("[locale]", "").count("/") + 0:
            pass
        rel_check = fpath.split("/[locale]/")[-1]
        if rel_check == "page.tsx":
            continue  # homepage
        src = Path(fpath).read_text(encoding="utf-8")
        if "export const metadata" not in src and "generateMetadata" not in src:
            continue
        route = route_from_file(Path(fpath))
        pid = page_id_from_route(route)
        data = build_page_json(src)
        out_path = OUT / f"{pid}.json"
        out_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        count += 1
        print(f"Wrote {pid}.json ({len(json.dumps(data))} bytes)")
    print(f"Done: {count} files")


if __name__ == "__main__":
    main()
