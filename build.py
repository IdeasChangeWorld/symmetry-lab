#!/usr/bin/env python3
"""Bundle the static project into one offline HTML file using only Python stdlib."""
from pathlib import Path
import re

project = Path(__file__).resolve().parent
html = (project / "index.html").read_text(encoding="utf-8")
css = (project / "styles.css").read_text(encoding="utf-8")
html, count = re.subn(r'<link rel="stylesheet" href="styles\.css(?:\?[^\"]*)?">', lambda _: "<style>\n" + css + "\n</style>", html)
if count != 1:
    raise ValueError("Expected exactly one styles.css link")

scripts = []
for name in ("math.js", "learning-data.js", "app.js"):
    source = (project / name).read_text(encoding="utf-8").replace("</script", "<\\/script")
    scripts.append("// " + name + "\n" + source)
    pattern = r'<script defer src="' + re.escape(name) + r'(?:\?[^\"]*)?"></script>'
    html, count = re.subn(pattern, "", html)
    if count != 1:
        raise ValueError("Expected exactly one script tag for " + name)

# Scripts run after all page controls exist, matching the source files' defer order.
html = html.replace("</body>", "<script>\n" + "\n\n".join(scripts) + "\n</script>\n</body>")
output = project / "symmetry-lab.html"
output.write_text(html, encoding="utf-8")
print("Created " + output.name + " (" + str(output.stat().st_size) + " bytes)")
