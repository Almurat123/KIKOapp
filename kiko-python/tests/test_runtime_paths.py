import tempfile
import unittest
from pathlib import Path

from runtime_paths import resolve_kiko_api_src_root


class RuntimePathsTests(unittest.TestCase):
    def test_resolves_repo_layout(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            src_root = tmp_path / "repo" / "kiko-api" / "src"
            (src_root / "skills_exec").mkdir(parents=True)
            anchor = tmp_path / "repo" / "kiko-python" / "runtime_paths.py"

            self.assertEqual(resolve_kiko_api_src_root(anchor), src_root)

    def test_resolves_plain_src_layout(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            src_root = tmp_path / "src"
            (src_root / "skills_exec").mkdir(parents=True)
            anchor = tmp_path / "kiko-python" / "runtime_paths.py"

            self.assertEqual(resolve_kiko_api_src_root(anchor), src_root)


if __name__ == "__main__":
    unittest.main()
