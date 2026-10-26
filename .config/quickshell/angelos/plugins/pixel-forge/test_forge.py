import importlib.util
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest.mock import patch
import zipfile

spec = importlib.util.spec_from_file_location('forge', Path(__file__).with_name('forge.py'))
forge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(forge)

class ForgeTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.source = self.root / "spaces ' ; $(nothing).txt"
        self.source.write_text('original content', encoding='utf-8')

    def request(self, action, **extra):
        return dict(path=str(self.source), action=action, **extra)

    def test_copy_never_overwrites(self):
        result = forge.execute(self.request('copy', destination=str(self.root)))
        self.assertNotEqual(result['output'], str(self.source))
        self.assertEqual(Path(result['output']).read_bytes(), self.source.read_bytes())
        self.assertEqual(self.source.read_text(), 'original content')

    def test_move_requires_confirmation(self):
        dest = self.root / 'dest'
        dest.mkdir()
        with self.assertRaisesRegex(ValueError, 'Confirm'):
            forge.execute(self.request('move', destination=str(dest)))
        self.assertTrue(self.source.exists())
        result = forge.execute(self.request('move', destination=str(dest), confirmMove=True))
        self.assertFalse(self.source.exists())
        self.assertEqual(Path(result['output']).read_text(), 'original content')

    def test_zip_roundtrip(self):
        result = forge.execute(self.request('zip'))
        unpacked = forge.execute(dict(path=result['output'], action='extract'))
        self.assertEqual((Path(unpacked['output']) / self.source.name).read_bytes(), self.source.read_bytes())

    def test_zip_traversal_is_rejected(self):
        for name in ['../escape.txt', '/absolute.txt', 'C:/evil.txt', 'folder/../../evil']:
            archive = self.root / 'bad.zip'
            with zipfile.ZipFile(archive, 'w') as z:
                z.writestr(name, 'no')
            with self.assertRaisesRegex(ValueError, 'unsafe'):
                forge.execute(dict(path=str(archive), action='extract'))
        self.assertFalse((self.root / 'escape.txt').exists())

    def test_zip_symlink_rejected(self):
        archive = self.root / 'link.zip'
        with zipfile.ZipFile(archive, 'w') as z:
            info = zipfile.ZipInfo('link')
            info.external_attr = 0o120777 << 16
            z.writestr(info, '../outside')
        with self.assertRaisesRegex(ValueError, 'symbolic'):
            forge.execute(dict(path=str(archive), action='extract'))

    def test_missing_tool(self):
        with patch.object(forge.shutil, 'which', return_value=None):
            self.assertFalse(forge.catalog(self.source)['actions'][0]['available'])
            with self.assertRaisesRegex(ValueError, 'Install'):
                forge.execute(self.request('convert', target='pdf'))

    def test_invalid_format_rejected(self):
        with patch.object(forge.shutil, 'which', return_value='/bin/tool'):
            with self.assertRaisesRegex(ValueError, 'supported output'):
                forge.execute(self.request('convert', target='pdf; rm -rf /'))

    def test_converter_failure_keeps_original(self):
        with patch.object(forge.shutil, 'which', return_value='/bin/tool'), patch.object(forge, 'run', side_effect=ValueError('failed')):
            with self.assertRaisesRegex(ValueError, 'failed'):
                forge.execute(self.request('convert', target='pdf'))
        self.assertEqual(self.source.read_text(), 'original content')
        self.assertFalse(list(self.root.glob('.pixel-forge-*')))

    def test_nonfinite_numbers(self):
        for value in ['nan', 'inf', '-1', '999999']:
            with self.assertRaises(ValueError):
                forge.number(value, 0, 1000, 'Start')

    def test_all_categories(self):
        for ext, kind in [('png','image'),('mp4','video'),('wav','audio'),('docx','document'),('xlsx','sheet'),('pptx','slides'),('md','ebook'),('pdf','pdf'),('zip','archive')]:
            path = self.root / ('sample.' + ext)
            path.touch()
            self.assertEqual(forge.catalog(path)['kind'], kind)

    def test_remote_url_rejected(self):
        for value in ['https://example.com/file', 'file://remote/path']:
            with self.assertRaises(ValueError):
                forge.local_path(value)

    def test_fake_encoder_receives_safe_arguments(self):
        self.source = self.root / '$(touch evil); clip.mp4'
        self.source.write_bytes(b'video')
        calls = []
        def encoder(args):
            calls.append(args)
            Path(args[-1]).write_bytes(b'encoded')
        with patch.object(forge.shutil, 'which', return_value='/bin/tool'), patch.object(forge, 'run', side_effect=encoder):
            result = forge.execute(self.request('trim', start='2', duration='3'))
        self.assertEqual(calls[0][calls[0].index('-i') + 1], str(self.source))
        self.assertEqual(Path(result['output']).read_bytes(), b'encoded')
        self.assertEqual(self.source.read_bytes(), b'video')

if __name__ == '__main__':
    unittest.main()
