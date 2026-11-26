"""Build the self-contained game with the Python standard library."""
import base64
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "src"
VENDOR = ROOT / "vendor"
LOCAL_IMPORT = re.compile(r"""(\bfrom\s+)(['"])((?:\./|\.\./)[\w./-]+\.js)\2""")


def module_url(code):
    encoded = base64.b64encode(code.encode("utf-8")).decode("ascii")
    return "data:text/javascript;base64," + encoded


def build():
    imports = {"three": module_url((VENDOR / "three.module.min.js").read_text(encoding="utf-8"))}
    modules = {path.resolve(): path.relative_to(SOURCE).with_suffix("").as_posix()
               for path in sorted(SOURCE.rglob("*.js"))}

    for path, name in modules.items():
        def resolve(match):
            imported = (path.parent / match[3]).resolve()
            if imported not in modules:
                raise ValueError(f"Unknown local import in {name}: {match[3]}")
            return f'{match[1]}"ride/{modules[imported]}"'

        code = LOCAL_IMPORT.sub(resolve, path.read_text(encoding="utf-8"))
        imports["ride/" + name] = module_url(code)

    license_text = (VENDOR / "LICENSE-three.txt").read_text(encoding="utf-8")
    tags = (f"<!-- Three.js\n{license_text}\n-->\n"
            + '<script type="importmap">' + json.dumps({"imports": imports}) + '</script>\n'
            + '<script type="module">import "ride/ride";</script>')
    page = (SOURCE / "shell.html").read_text(encoding="utf-8")
    if page.count("<!--MODULES-->") != 1:
        raise ValueError("The HTML template needs exactly one module placeholder")
    output = ROOT / "风过雪岭.html"
    output.write_bytes(page.replace("<!--MODULES-->", tags).encode("utf-8"))
    print(output.name, output.stat().st_size)


if __name__ == "__main__":
    build()
