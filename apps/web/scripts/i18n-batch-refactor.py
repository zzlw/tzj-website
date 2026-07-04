#!/usr/bin/env python3
"""Mechanical i18n refactor for all static page.tsx files."""
from __future__ import annotations

import glob
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "src/app"
PAGES_JSON = ROOT / "src/messages/zh-CN/pages"


def kebab_to_camel(s: str) -> str:
    parts = s.split("-")
    return parts[0] + "".join(p.capitalize() for p in parts[1:])


def route_from_file(fpath: str) -> str:
    rel = fpath.split("/[locale]/")[-1].replace("/page.tsx", "")
    return "/" + rel if rel else "/"


def page_id_from_route(route: str) -> str:
    return route.lstrip("/").replace("/", "-") or "home"


def load_json(page_id: str) -> dict:
    p = PAGES_JSON / f"{page_id}.json"
    if p.exists():
        return json.loads(p.read_text(encoding="utf-8"))
    return {}


IMPORTS = """import { getTranslations } from "next-intl/server";
import { createPageMetadata } from "@/lib/i18n/metadata";
"""


def ensure_imports(src: str) -> str:
    if "getTranslations" not in src:
        # insert after last import block
        m = re.search(r"(import[\s\S]*?from [\"'][^\"']+[\"'];?\n)(?!\s*import)", src)
        if m:
            insert_at = m.end()
            src = src[:insert_at] + IMPORTS + src[insert_at:]
    if "StatBandI18n" in src and "blocks-i18n" not in src:
        src = src.replace(
            'from "@/components/sections/blocks";',
            'from "@/components/sections/blocks";\nimport { StatBandI18n, ProcessBandI18n } from "@/components/sections/blocks-i18n";',
        )
    return src


def replace_metadata(src: str, namespace: str, path: str) -> str:
    src = re.sub(
        r"export const metadata = generateSeo\(\{[\s\S]*?\}\);\n?",
        f"""export async function generateMetadata() {{
  return createPageMetadata({{ namespace: "{namespace}", path: "{path}" }});
}}

""",
        src,
    )
    src = re.sub(r"import \{ generateSeo \} from \"@/lib/seo\";\n?", "", src)
    return src


def replace_bands(src: str) -> str:
    src = src.replace("<StatBand />", "<StatBandI18n />")
    src = src.replace("<StatBand/>", "<StatBandI18n />")
    src = src.replace("<ProcessBand />", "<ProcessBandI18n />")
    src = src.replace("<ProcessBand/>", "<ProcessBandI18n />")
    src = re.sub(r"import \{([^}]*)\bStatBand\b([^}]*)\} from \"@/components/sections/blocks\";", lambda m: (
        "import {" + m.group(1).replace("StatBand, ", "").replace("StatBand,", "").replace(", StatBand", "").replace("ProcessBand, ", "").replace("ProcessBand,", "").replace(", ProcessBand", "") + m.group(2) + '} from "@/components/sections/blocks";'
        if "StatBandI18n" not in m.group(0) else m.group(0)
    ), src)
    return src


def replace_cta_strings(src: str) -> str:
    src = src.replace(">预约咨询<", ">{tCta(\"bookConsult\")}<")
    src = src.replace('{ name: "首页", path: "/" }', '{ name: tBread("home"), path: "/" }')
    return src


def make_async(src: str) -> str:
    src = re.sub(
        r"export default function (\w+)\(",
        r"export default async function \1(",
        src,
    )
    return src


def inject_translations(src: str, ns: str) -> str:
    if "getTranslations(\"pages." in src:
        return src
    fn = re.search(r"export default async function \w+\([^)]*\) \{", src)
    if not fn:
        return src
    insert = fn.end()
    block = f"""
  const t = await getTranslations("pages.{ns}");
  const tCta = await getTranslations("cta");
  const tBread = await getTranslations("breadcrumbs");
"""
    return src[:insert] + block + src[insert:]


def replace_page_hero(src: str) -> str:
    for key in ("eyebrow", "title", "description"):
        src = re.sub(
            rf'(<PageHero[^>]*\s{key}=)"[^"]*"',
            rf'\1{{t("hero.{key}")}}',
            src,
        )
        src = re.sub(
            rf'(<VideoHero[^>]*\s{key}=)"[^"]*"',
            rf'\1{{t("hero.{key}")}}',
            src,
        )
    return src


def refactor_file(fpath: str) -> bool:
    if "[slug]" in fpath or "/contact/" in fpath:
        return False
    rel = fpath.split("/[locale]/")[-1]
    if rel == "page.tsx":
        return False

    src = Path(fpath).read_text(encoding="utf-8")
    if "export const metadata" not in src:
        return False

    route = route_from_file(fpath)
    page_id = page_id_from_route(route)
    ns = kebab_to_camel(page_id)

    src = replace_metadata(src, f"pages.{ns}", route)
    src = replace_bands(src)
    src = ensure_imports(src)
    src = make_async(src)
    src = inject_translations(src, ns)
    src = replace_cta_strings(src)
    src = replace_page_hero(src)

    Path(fpath).write_text(src, encoding="utf-8")
    return True


def main():
    pattern = str(APP / "[[]locale[]]" / "**/page.tsx")
    count = 0
    for fpath in sorted(glob.glob(pattern, recursive=True)):
        if refactor_file(fpath):
            count += 1
            print(f"Refactored: {fpath.split('/[locale]/')[-1]}")
    print(f"Done: {count} pages")


if __name__ == "__main__":
    main()
