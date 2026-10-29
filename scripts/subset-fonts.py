# /// script
# requires-python = ">=3.10"
# dependencies = ["fonttools[woff]==4.68.0"]
# ///
"""Cut the docs site's web fonts down to what the site renders.

Run by hand, never from the build, and commit what it writes to
apps/docs/fonts:

    bun run docs:build      # the script reads the built pages
    bun run fonts:subset    # uv run scripts/subset-fonts.py

Each face becomes two WOFF2 files. The core (ASCII, the punctuation most pages
use, and every character the site sets inside a word) is preloaded. The
extended file (the rest of Latin-1 and Latin Extended-A, plus characters the
site only sets on their own) sits behind `unicode-range` and downloads only on
pages that use it. apps/docs/fonts/integration.mjs serves both through Astro's
font pipeline, which still generates the fallback faces.

Rerun it when tests/docs-fonts.test.mjs fails (content uses a character the
files miss, or sets an extended character inside a word), when the site starts
using another weight, style, or OpenType feature, or to upgrade a font (update
its sha256 pin).
"""

import hashlib
import io
import json
import re
import sys
import unicodedata
import urllib.request
from html import unescape
from pathlib import Path

from fontTools import subset
from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "apps/docs/fonts"
SITE = ROOT / "apps/docs/dist/client"
CACHE = ROOT / "node_modules/.cache/vadivam-fonts"
UPSTREAM = "https://raw.githubusercontent.com/google/fonts/main/ofl/"

# Printable ASCII, the no-break space, curly quotes, en and em dashes, and the
# ellipsis.
CORE = {*range(0x20, 0x7F), 0xA0, 0x2018, 0x2019, 0x201C, 0x201D, 0x2013, 0x2014, 0x2026}
LATIN_1 = set(range(0xA0, 0x100))
LATIN_EXT_A = set(range(0x100, 0x180))

# The range of Google Fonts' `latin` subset, which the site loaded before these
# files. A character the site uses from it stays in the web font. Anything else
# outside Latin-1 and Latin Extended-A (₹, ≠, Tamil, CJK) keeps rendering in
# system fonts, as it did then.
GOOGLE_LATIN = {
    *range(0x0000, 0x0100), 0x0131, 0x0152, 0x0153, 0x02BB, 0x02BC, 0x02C6,
    0x02DA, 0x02DC, 0x0304, 0x0308, 0x0329, *range(0x2000, 0x2070), 0x20AC,
    0x2122, 0x2191, 0x2193, 0x2212, 0x2215, 0xFEFF, 0xFFFD,
}

FAMILIES = [
    dict(
        css_variable="--blume-ff-sn-pro",
        name="SN Pro",
        license=("snpro/OFL.txt", "a4e05b7a060fb2d9bb47744942fe2f0c9f982997b065f3902e9b965ea19d6aad"),
        # Faces are declared at 400, 500, 600, and 700, so every weight the CSS
        # asks for renders one of those instances (800 and 900 clamp to 700),
        # in both styles: blockquotes are italic 500 and bold inside them goes
        # higher. Nothing sets font-variation-settings. Limiting wght to
        # {"wght": (400, 700)} would save 2.6 KB per file, but instancing
        # rounds points and advances to whole units at the new default, which
        # moves glyph edges and widens long lines by a pixel or two. So the
        # upstream axis stays whole.
        axes={},
        # Browser defaults for Latin, plus tabular figures, which browsers set
        # on list markers. Nothing turns on fraction, case, or stylistic set
        # features, and only the Tamil wordmark changes `lang`.
        features=["ccmp", "kern", "liga", "calt", "mark", "mkmk", "tnum"],
        # The icon pages' license line (©), PNG sizes (×), and categories (·).
        core={0xA9, 0xB7, 0xD7},
        # Italic first, as Google lists it: Astro sizes the fallback faces from
        # the first file it gets.
        faces=[
            dict(source="snpro/SNPro-Italic[wght].ttf", sha256="5152b4b61590ff724901278fc950554a0207e09e600088c822120b590ab9cca2",
                 style="italic", weights=[400, 500, 600, 700], file="sn-pro-italic"),
            dict(source="snpro/SNPro[wght].ttf", sha256="63abf11c85df08dde6cec421c133c723408ee1e5744bb280b660dfd8be3fe061",
                 style="normal", weights=[400, 500, 600, 700], file="sn-pro"),
        ],
    ),
    dict(
        css_variable="--blume-ff-ibm-plex-mono",
        # "Plex" is a Reserved Font Name, so the modified files take another.
        name="Vadivam Mono",
        reserved_name="Plex",
        license=("ibmplexmono/OFL.txt", "7e6b2818edbd8f6a01ae80641cc8f16a51080d08fb4e532be3a0b6f74adb07da"),
        axes={},
        features=["ccmp", "mark"],
        # The icon pages' categories (·) and the search dialog's key hints.
        core={0xB7, 0x2191, 0x2193},
        faces=[
            dict(source="ibmplexmono/IBMPlexMono-Italic.ttf", sha256="3362fc791b0652193328b862c1c5f23a789bc7288b1617fa63302f88689a2a34",
                 style="italic", weights=[400], file="vadivam-mono-italic"),
            dict(source="ibmplexmono/IBMPlexMono-MediumItalic.ttf", sha256="de6e0f805a15a2a1538be5d1074741298a07ffcba6fa1f4cd93983ff73155a7d",
                 style="italic", weights=[500], file="vadivam-mono-medium-italic"),
            dict(source="ibmplexmono/IBMPlexMono-SemiBoldItalic.ttf", sha256="391ef0e273eb52571eccaab6a6dbddeec48e1d282cb7bf153043512b797ed6f0",
                 style="italic", weights=[600], file="vadivam-mono-semibold-italic"),
            dict(source="ibmplexmono/IBMPlexMono-Regular.ttf", sha256="6a3412f058c7d8dfd9170c41e85ade48e5156ecb89356110ca57a0a27734af46",
                 style="normal", weights=[400], file="vadivam-mono"),
            dict(source="ibmplexmono/IBMPlexMono-Medium.ttf", sha256="a9b4c49bb299e05b5f6c481e7fb5e78943d2793249a0c8874ab574a2d1ea6755",
                 style="normal", weights=[500], file="vadivam-mono-medium"),
            dict(source="ibmplexmono/IBMPlexMono-SemiBold.ttf", sha256="d3c38e55c78f5b0f28009fddba4834ec503278936a5986032424c9bd2d23aa46",
                 style="normal", weights=[600], file="vadivam-mono-semibold"),
        ],
    ),
]

HINTING_TABLES = {"fpgm", "prep", "cvt ", "cvar", "hdmx", "VDMX", "LTSH"}
WEIGHT_NAMES = {400: "", 500: "Medium", 600: "SemiBold", 700: "Bold"}


def fetch(path, sha256):
    """An upstream file from google/fonts, cached and checked against its pin."""
    cached = CACHE / path
    if not cached.exists():
        cached.parent.mkdir(parents=True, exist_ok=True)
        url = UPSTREAM + path.replace("[", "%5B").replace("]", "%5D")
        # The URL is always the https UPSTREAM plus a pinned path from FAMILIES.
        cached.write_bytes(urllib.request.urlopen(url).read())  # nosec B310
    digest = hashlib.sha256(cached.read_bytes()).hexdigest()
    if digest != sha256:
        cached.unlink()
        sys.exit(f"{path} changed upstream (sha256 {digest}). Review the new version, then update its pin.")
    return cached


def scan_site():
    """Pages per character, and the characters some text node sets inside a
    word (next to a non-space character, or a combining mark). Those share
    kerning and mark positioning with their neighbors, which a browser can't
    apply across two files, so they belong in the core."""
    if not SITE.exists():
        sys.exit("No built site at apps/docs/dist/client. Run `bun run docs:build` first.")
    pages, in_word = {}, set()
    for page in SITE.rglob("*.html"):
        html = re.sub(r"<(script|style)\b[\s\S]*?</\1>|<!--[\s\S]*?-->", "", page.read_text("utf8"))
        seen = set()
        for text in re.split(r"<[^>]*>", html) + re.findall(r'placeholder="([^"]*)"', html):
            text = unescape(text)
            seen.update(map(ord, text))
            for i, char in enumerate(text):
                if ord(char) >= 0x80 and (unicodedata.category(char).startswith("M") or text[max(i - 1, 0):i + 2].replace(char, "", 1).strip()):
                    in_word.add(ord(char))
        for code in seen:
            pages[code] = pages.get(code, 0) + 1
    return pages, in_word


def unicode_range(codes):
    ranges = []
    for code in sorted(codes):
        if ranges and code == ranges[-1][1] + 1:
            ranges[-1][1] = code
        else:
            ranges.append([code, code])
    return [f"U+{start:04X}" if start == end else f"U+{start:04X}-{end:04X}" for start, end in ranges]


def rename(font, family, style, weight):
    """Name the file after `family`, in the family/style pattern browsers expect."""
    weight_name = "" if "fvar" in font else WEIGHT_NAMES[weight]
    family_name = f"{family} {weight_name}".strip()
    italic = "Italic" if style == "italic" else ""
    postscript = f"{family.replace(' ', '')}-{weight_name + italic or 'Regular'}"
    table = font["name"]
    version = table.getDebugName(5)
    for name_id in (1, 2, 3, 4, 6, 16, 17):
        table.removeNames(nameID=name_id)
    names = {1: family_name, 2: italic or "Regular", 3: f"{version};{postscript}", 4: f"{family_name} {italic}".strip(), 6: postscript}
    for name_id, value in names.items():
        table.setName(value, name_id, 3, 1, 0x409)


def reload(font):
    """Round-trip through bytes: subsetting straight after instancing trips over
    gvar entries the instancer left unloaded."""
    data = io.BytesIO()
    font.save(data)
    data.seek(0)
    return TTFont(data, recalcTimestamp=False)


def subset_file(source, codes, family, face):
    # Keeping upstream's timestamp makes reruns byte-identical.
    font = TTFont(source, recalcTimestamp=False)
    if family["axes"]:
        font = reload(instancer.instantiateVariableFont(font, family["axes"]))
    if "fvar" in font:
        font["fvar"].instances = []
    options = subset.Options()
    options.layout_features = family["features"]
    options.layout_scripts = ["DFLT", "latn"]
    options.hinting = False
    options.glyph_names = False
    options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]
    options.drop_tables += ["STAT", "meta"]
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=codes)
    subsetter.subset(font)
    rename(font, family["name"], face["style"], face["weights"][0])
    font.flavor = "woff2"
    data = io.BytesIO()
    font.save(data)
    return data.getvalue()


def outline(glyph_set, glyph):
    pen = DecomposingRecordingPen(glyph_set)
    glyph_set[glyph].draw(pen)
    return [point for _, args in pen.value for point in args], glyph_set[glyph].width


def check(data, source, codes, family, face):
    """Fail on font tool quirks instead of shipping them: the cmap must be exactly
    `codes`, with no hinting, only the kept features, the intended axis range,
    no Reserved Font Name, and outlines and advances that match the upstream
    font at every declared weight. Returns the largest drift in font units."""
    font, upstream = TTFont(io.BytesIO(data)), TTFont(source)
    errors = []
    if set(font.getBestCmap()) != codes:
        errors.append("cmap differs from the requested characters")
    glyf = font["glyf"]
    if HINTING_TABLES & set(font.keys()) or any(
        hasattr(glyf[name], "program") and glyf[name].program.getBytecode() for name in font.getGlyphOrder()
    ):
        errors.append("hinting left in")
    for tag in ("GSUB", "GPOS"):
        if tag in font and font[tag].table.FeatureList:
            extra = {r.FeatureTag for r in font[tag].table.FeatureList.FeatureRecord} - set(family["features"])
            if extra:
                errors.append(f"{tag} keeps {sorted(extra)}")
    for axis, original in zip(font["fvar"].axes, upstream["fvar"].axes) if "fvar" in font else []:
        low, high = family["axes"].get(axis.axisTag, (original.minValue, original.maxValue))
        default = low if axis.axisTag in family["axes"] else original.defaultValue
        if (axis.minValue, axis.defaultValue, axis.maxValue) != (low, default, high):
            errors.append(f"{axis.axisTag} axis is {axis.minValue}..{axis.maxValue}")
    if family.get("reserved_name"):
        if any(family["reserved_name"] in str(r) for r in font["name"].names if r.nameID not in (0, 13, 14)):
            errors.append(f"still named {family['reserved_name']}")
    drift = 0
    ours_cmap, upstream_cmap = font.getBestCmap(), upstream.getBestCmap()
    for weight in face["weights"]:
        location = {"wght": weight} if "fvar" in font else None
        ours, theirs = font.getGlyphSet(location=location), upstream.getGlyphSet(location=location)
        for code in codes:
            (a, a_width), (b, b_width) = outline(ours, ours_cmap[code]), outline(theirs, upstream_cmap[code])
            if len(a) != len(b):
                errors.append(f"U+{code:04X} changed shape at {weight}")
                continue
            drift = max([drift, abs(a_width - b_width)] + [abs(p - q) for pa, pb in zip(a, b) for p, q in zip(pa, pb)])
    # Only instancing may move points, and by rounding to whole units at most.
    if drift > (1 if family["axes"] else 0.01):
        errors.append(f"outlines drift {drift:.2f} units from upstream")
    if errors:
        sys.exit(f"{source.name}: " + "; ".join(errors))
    return drift


def main():
    pages, in_word = scan_site()
    used = {code for code in pages if code >= 0x80}
    wanted = LATIN_1 | LATIN_EXT_A | (used & GOOGLE_LATIN)
    # Everything is built and checked before apps/docs/fonts changes, so a
    # failed run leaves the committed files in place.
    outputs, manifest, report, covered, core_codes = {}, [], [], set(), set()
    for family in FAMILIES:
        license_path, license_sha = family["license"]
        outputs[f"OFL-{family['name'].replace(' ', '-')}.txt"] = fetch(license_path, license_sha).read_bytes()
        faces, missing = [], set()
        for face in family["faces"]:
            source = fetch(face["source"], face["sha256"])
            available = set(TTFont(source).getBestCmap())
            core = (CORE | family["core"] | (in_word & wanted)) & available
            extended = (wanted & available) - core
            missing |= wanted - available
            covered |= core | extended
            core_codes |= core
            for kind, codes in (("core", core), ("extended", extended)):
                data = subset_file(source, codes, family, face)
                drift = check(data, source, codes, family, face)
                file = f"{face['file']}-{kind}.woff2"
                outputs[file] = data
                report.append(f"  {file:44} {len(data):>6} B  {len(codes):>3} characters  drift {drift:.2f}")
                # Blume preloads the `latin` subset, so only the core is preloaded.
                faces.append(dict(src=file, style=face["style"], weights=face["weights"],
                                  subset="latin" if kind == "core" else kind, unicodeRange=unicode_range(codes)))
        manifest.append(dict(cssVariable=family["css_variable"], name=family["name"], faces=faces,
                             missing=unicode_range(missing) if missing else []))
    # tests/docs-fonts.test.mjs checks the built pages against `eligible`.
    eligible = unicode_range((LATIN_1 | LATIN_EXT_A | GOOGLE_LATIN) - set(range(0x80)))
    outputs["fonts.json"] = (json.dumps(dict(eligible=eligible, families=manifest), indent=2) + "\n").encode()
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.woff2"):
        old.unlink()
    for name, data in outputs.items():
        (OUT / name).write_bytes(data)

    print("Wrote apps/docs/fonts:\n" + "\n".join(report))
    describe = lambda codes: " ".join(f"{chr(c)} U+{c:04X} ({pages[c]})" for c in sorted(codes))
    print(f"Pages using each character, of {pages.get(0x20, 0)}:")
    print("  In the core:", describe(used & core_codes))
    print("  In the extended files:", describe(used & covered - core_codes))
    print("  In system fonts, as before:", describe({c for c in used - covered if unicodedata.category(chr(c))[0] not in "CZ"}))


if __name__ == "__main__":
    main()
