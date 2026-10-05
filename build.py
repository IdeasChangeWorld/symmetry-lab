#!/usr/bin/env python3
"""Bundle the static project into one offline HTML file using only Python stdlib."""
from pathlib import Path
import re

project = Path(__file__).resolve().parent
html = (project / "index.html").read_text(encoding="utf-8")
for name in ("styles.css", "course.css", "stereo.css", "crystal.css"):
    css = (project / name).read_text(encoding="utf-8")
    pattern = r'<link rel="stylesheet" href="' + re.escape(name) + r'(?:\?[^\"]*)?">'
    html, count = re.subn(pattern, lambda _: "<style>\n" + css + "\n</style>", html)
    if count != 1:
        raise ValueError("Expected exactly one style link for " + name)

scripts = []
for name in ("math.js", "lattice-math.js", "learning-data.js", "point-group-math.js", "advanced-math.js", "course-math.js", "crystal-math.js", "app.js", "point-group-view.js", "lattice-view.js", "stereo-view.js", "crystal-view.js", "course-view.js"):
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
