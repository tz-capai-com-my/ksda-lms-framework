#!/usr/bin/env python3
"""Offline byte verification of the release package. No provider connection."""
import hashlib, json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
manifest=json.loads((root/'PACKAGE-MANIFEST.json').read_text())
for row in manifest['files']:
 p=root/row['path']
 assert p.resolve().is_relative_to(root.resolve()) and not p.is_symlink(), row['path']
 b=p.read_bytes()
 assert len(b)==row['bytes'] and hashlib.sha256(b).hexdigest()==row['sha256'], row['path']
for row in json.loads((root/'content/reading-code-manifest.json').read_text()):
 assert hashlib.sha256((root/row['path']).read_bytes()).hexdigest()==row['sha256'], row['path']
print(f"PASS: {len(manifest['files'])} packaged files and all runtime code bindings; no network requests.")
