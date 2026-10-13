"""Exercise release boundaries in tiny temporary workspaces, never the collection."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts/release/package.py'


class ReleasePackaging(unittest.TestCase):
    def test_only_declared_packs_and_client_are_packaged_with_stable_hashes(self):
        with tempfile.TemporaryDirectory(prefix='terrain-release-test-') as temporary:
            root = Path(temporary)
            def put(name, data):
                target = root / name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(data)
            put('scripts/release/package.py', SCRIPT.read_bytes())
            put('package.json', b'{"version":"1.0.0"}')
            put('desktop/builtin-index.json', b'{"piece":{"pack":"starter"}}')
            put('release-config/deepstone.json', b'{"archives":[{"id":"print-pack"}]}')
            put('launcher/TerrainFoundryLauncher.exe', b'launcher-fixture')
            put('release/desktop-1.0.0/TerrainFoundry-win32-x64/TerrainFoundry.exe', b'editor-fixture')
            payload = b'large-file-fixture' * 100000
            put('release/asset-packs/starter/index.json', b'{"piece":{}}')
            put('release/asset-packs/starter/models/piece.bin', payload)
            put('release/asset-packs/print-pack/index.json', b'{}')
            put('release/asset-packs/print-pack/print/piece.stl', b'stl-fixture')
            put('release/asset-packs/test-pack/private.txt', b'excluded')
            put('work/private.txt', b'excluded')
            def build(component='full', success=True):
                result = subprocess.run([sys.executable, str(root / 'scripts/release/package.py')],
                    capture_output=True, env={**os.environ, 'TERRAIN_COMPONENT': component})
                self.assertEqual(result.returncode == 0, success, result.stderr.decode())
                if success:
                    return json.loads((root / 'release/publish/package-files.json').read_text())
            first = build()
            self.assertEqual(set(first['content']), {'starter', 'print-pack'})
            self.assertEqual(set(first['client']['files']), {'TerrainFoundry.exe'})
            meta = first['content']['starter']['files']['models/piece.bin']
            self.assertEqual(meta['sha256'], hashlib.sha256(payload).hexdigest())
            self.assertEqual((root / 'release/publish' / meta['artifact']).read_bytes(), payload)
            self.assertEqual(first, build())
            self.assertNotIn('client', build('content'))
            self.assertEqual(build('client')['content'], {})
            self.assertEqual(build('launcher'), {'component': 'launcher', 'content': {}})
            build('unknown', success=False)
            (root / 'release/asset-packs/print-pack/index.json').unlink()
            build('full', success=False)


if __name__ == '__main__':
    unittest.main()
