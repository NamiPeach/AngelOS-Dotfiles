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


class NativeSelectionTests(unittest.TestCase):
    setUp = ForgeTests.setUp
    def test_common_formats_intersect(self):
        image=self.root/'image.png'; image.write_bytes(b'png')
        with patch.object(forge.shutil,'which',return_value='/tool'):
            data=forge.catalog_many([self.source,image])
        convert=next(a for a in data['actions'] if a['id']=='convert')
        self.assertEqual(convert['targets'],['pdf'])
        self.assertNotIn('resize',[a['id'] for a in data['actions']])

    def test_missing_pdf_converter_hides_target(self):
        pdf=self.root/'report.pdf';pdf.write_bytes(b'pdf')
        with patch.object(forge.shutil,'which',side_effect=lambda t:'/tool' if t=='pdftoppm' else None):
            data=forge.catalog(pdf)
        self.assertEqual(next(a for a in data['actions'] if a['id']=='convert')['targets'],['png'])

    def test_batch_copy_preserves_sources_and_names(self):
        second=self.root/'two.txt';second.write_text('two')
        dest=self.root/'dest';dest.mkdir()
        result=forge.execute_many(dict(paths=[str(self.source),str(second)],action='copy',destination=str(dest)))
        self.assertEqual(len(result['outputs']),2)
        self.assertTrue(self.source.exists() and second.exists())

    def test_batch_partial_error_is_reported(self):
        second=self.root/'two.txt';second.write_text('two')
        original=forge.execute
        def execute(request):
            if request['path']==str(second):raise ValueError('test failure')
            return original(request)
        with patch.object(forge,'execute',side_effect=execute):
            result=forge.execute_many(dict(paths=[str(self.source),str(second)],action='zip'))
        self.assertIn('1 of 2',result['message'])
        self.assertIn('test failure',result['warning'])
        self.assertTrue(self.source.exists() and second.exists())

    def test_batch_move_still_requires_confirmation(self):
        dest=self.root/'dest';dest.mkdir()
        with self.assertRaisesRegex(ValueError,'Confirm'):
            forge.execute_many(dict(paths=[str(self.source)],action='move',destination=str(dest)))
        self.assertTrue(self.source.exists())

    def test_share_uses_argv_and_clipboard_stdin(self):
        with patch.object(forge.subprocess,'run') as call:
            forge.desktop_action([self.source],'email')
            self.assertEqual(call.call_args.args[0],['xdg-email','--attach',str(self.source)])
            self.assertNotIn('shell',call.call_args.kwargs)
            forge.desktop_action([self.source],'copyfile')
            self.assertEqual(call.call_args.kwargs['input'],(self.source.as_uri()+'\r\n').encode())

    def test_missing_share_tool_rejected_before_launch(self):
        with patch.object(forge.shutil,'which',return_value=None), patch.object(forge.subprocess,'run') as call:
            with self.assertRaisesRegex(ValueError,'unavailable'):
                forge.execute_many(dict(paths=[str(self.source)],action='email'))
            call.assert_not_called()

    def test_metadata_does_not_modify_file(self):
        before=self.source.read_bytes()
        result=forge.execute_many(dict(paths=[str(self.source)],action='metadata'))
        self.assertIn(self.source.name,result['message'])
        self.assertEqual(before,self.source.read_bytes())

if __name__ == '__main__':
    unittest.main()
