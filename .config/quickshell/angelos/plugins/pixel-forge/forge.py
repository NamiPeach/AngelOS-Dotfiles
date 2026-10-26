#!/usr/bin/env python3
"""Local conversions with allowlisted commands and exclusive output creation."""
import argparse
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
from urllib.parse import unquote, urlparse
import zipfile

GROUPS = {
    'image': 'png jpg jpeg webp avif bmp tiff tif heic gif',
    'video': 'mp4 mov mkv webm avi m4v mpg mpeg',
    'audio': 'mp3 wav flac ogg opus m4a aac aiff',
    'document': 'doc docx odt rtf txt html htm',
    'sheet': 'xls xlsx ods csv tsv', 'slides': 'ppt pptx odp',
    'ebook': 'epub md markdown rst', 'pdf': 'pdf',
    'archive': 'zip 7z tar gz xz bz2 tgz',
}
TARGETS = {
    'image': ['png', 'jpg', 'webp', 'avif', 'tiff', 'bmp', 'pdf'],
    'video': ['mp4', 'webm', 'mkv', 'mov', 'gif'],
    'audio': ['mp3', 'wav', 'flac', 'ogg', 'opus', 'm4a'],
    'document': ['pdf', 'docx', 'odt', 'rtf', 'txt', 'html'],
    'sheet': ['pdf', 'xlsx', 'ods', 'csv'], 'slides': ['pdf', 'pptx', 'odp'],
    'ebook': ['epub', 'html', 'docx', 'odt', 'txt'], 'pdf': ['txt', 'png'],
    'archive': [], 'other': [],
}

def local_path(value):
    if value.startswith('file:'):
        parsed = urlparse(value)
        if parsed.netloc not in ('', 'localhost'):
            raise ValueError('Only local files are supported.')
        value = unquote(parsed.path)
    elif '://' in value:
        raise ValueError('Drop a local file, not a web link.')
    raw = Path(value).expanduser()
    if raw.is_symlink():
        raise ValueError('Choose the actual file, not a symbolic link.')
    path = raw.resolve(strict=True)
    if not path.is_file():
        raise ValueError('Choose a regular file.')
    return path

def group(path):
    suffix = path.suffix.lower().lstrip('.')
    return next((key for key, values in GROUPS.items() if suffix in values.split()), 'other')

def engine(kind):
    return {'image': 'magick', 'video': 'ffmpeg', 'audio': 'ffmpeg',
            'document': 'libreoffice', 'sheet': 'libreoffice', 'slides': 'libreoffice',
            'ebook': 'pandoc', 'pdf': ('pdftotext' if shutil.which('pdftotext') else 'pdftoppm')}.get(kind)

def catalog(path):
    kind = group(path)
    actions = []
    def add(key, label, tool=None, targets=None, hint=''):
        actions.append(dict(id=key, label=label, tool=tool or '', available=not tool or bool(shutil.which(tool)),
                            targets=targets or [], hint=hint))
    if TARGETS[kind]:
        add('convert', 'Convert', engine(kind), TARGETS[kind], 'Layout may change. CSV saves one sheet; PDF to PNG saves page 1. Images use the first frame.')
    if kind == 'image':
        add('resize', 'Resize', 'magick', hint='Maximum width in pixels; never enlarges.')
        add('crop', 'Square crop', 'magick', hint='Crop the centre to a square, save as PNG.')
        add('compress', 'Compress', 'magick', hint='Lossy JPEG copy; transparency becomes white.')
    if kind in ('video', 'audio'):
        add('trim', 'Trim', 'ffmpeg', hint='Start and duration in seconds. Re-encodes for precise cuts.')
        add('compress', 'Compress', 'ffmpeg', hint='Lossy MP4 / MP3 copy. Smaller size is not guaranteed.')
    if kind == 'video':
        add('audio', 'Extract audio', 'ffmpeg', ['mp3', 'wav', 'flac', 'm4a'])
        add('resize', 'Resize', 'ffmpeg', hint='Maximum width in pixels; never enlarges.')
        add('mute', 'Mute', 'ffmpeg')
    if kind == 'archive':
        add('extract', 'Extract ZIP', targets=[], hint='ZIP only. Rejects links, unsafe paths and archives over 2 GiB expanded.') if path.suffix.lower() == '.zip' else None
    add('zip', 'Make ZIP', hint='Archive this file without changing it.')
    add('copy', 'Copy to folder', hint='Destination folder is required.')
    add('move', 'Move to folder', hint='Moves the original after creating the destination copy.')
    return dict(path=str(path), name=path.name, kind=kind, actions=actions)

def run(args):
    with tempfile.TemporaryFile() as log:
        result = subprocess.run(args, stdin=subprocess.DEVNULL, stdout=log, stderr=log, timeout=3600)
        if result.returncode:
            log.seek(0, 2)
            log.seek(max(0, log.tell() - 3500))
            raise ValueError(log.read().decode('utf-8', 'replace').strip() or 'Converter failed.')

def number(value, low, high, title):
    result = float(value)
    if not math.isfinite(result) or not low <= result <= high:
        raise ValueError(f'{title} must be between {low} and {high}.')
    return result

def publish(source, folder, name):
    original = Path(name)
    for index in range(10000):
        candidate = folder / (original.name if index == 0 else f'{original.stem} ({index}){original.suffix}')
        try:
            out = candidate.open('xb')
        except FileExistsError:
            continue
        try:
            with out, source.open('rb') as inp:
                shutil.copyfileobj(inp, out)
                out.flush()
                os.fsync(out.fileno())
            return candidate
        except BaseException:
            candidate.unlink(missing_ok=True)
            raise
    raise ValueError('Too many files with the same name.')

def extract_zip(src, folder):
    with zipfile.ZipFile(src) as archive:
        infos = archive.infolist()
        if len(infos) > 10000 or sum(i.file_size for i in infos) > 2 * 1024**3:
            raise ValueError('Archive exceeds the extraction limit.')
        for info in infos:
            name = info.filename.replace('\\', '/')
            parts = name.split('/')
            if name.startswith('/') or '..' in parts or ':' in name or ((info.external_attr >> 16) & 0o170000) == 0o120000:
                raise ValueError('Archive contains an unsafe path or symbolic link.')
        # A private new directory: never merge into existing user files.
        result = Path(tempfile.mkdtemp(prefix=src.stem + '-extracted-', dir=folder))
        try:
            archive.extractall(result)
        except BaseException:
            shutil.rmtree(result)
            raise
        return dict(ok=True, output=str(result))

def execute(request):
    src = local_path(request['path'])
    kind, action = group(src), request['action']
    entry = next((a for a in catalog(src)['actions'] if a['id'] == action), None)
    if not entry:
        raise ValueError('This action is not supported for the selected file.')
    if not entry['available']:
        raise ValueError('Install the required tool: ' + entry['tool'])
    target = request.get('target', '')
    if entry['targets'] and target not in entry['targets']:
        raise ValueError('Choose a supported output format.')
    dest = request.get('destination', '').strip()
    if action in ('copy', 'move') and not dest:
        raise ValueError('Choose a destination folder.')
    folder = Path(dest).expanduser().resolve(strict=True) if dest else src.parent
    if not folder.is_dir():
        raise ValueError('Destination must be an existing folder.')
    if action == 'move' and request.get('confirmMove') is not True:
        raise ValueError('Confirm moving the original file.')
    if action == 'move' and folder == src.parent:
        raise ValueError('Choose a different folder for Move.')
    if action == 'extract':
        return extract_zip(src, folder)
    before = src.stat()
    with tempfile.TemporaryDirectory(prefix='.pixel-forge-', dir=folder) as tmp:
        work, ext = Path(tmp), src.suffix.lstrip('.')
        output = work / 'output'
        if action in ('copy', 'move'):
            shutil.copyfile(src, output)
        elif action == 'zip':
            ext = 'zip'
            with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
                archive.write(src, arcname=src.name)
        elif kind in ('document', 'sheet', 'slides'):
            ext = target
            run(['libreoffice', '-env:UserInstallation=' + (work / 'profile').as_uri(),
                 '--headless', '--convert-to', target, '--outdir', str(work), str(src)])
            output = work / (src.stem + '.' + ext)
        elif kind == 'ebook':
            ext, output = target, work / ('output.' + target)
            run(['pandoc', str(src), '-t', 'plain' if ext == 'txt' else ext, '-o', str(output)])
        elif kind == 'pdf':
            required = 'pdftotext' if target == 'txt' else 'pdftoppm'
            if not shutil.which(required):
                raise ValueError('Install the required tool: ' + required)
            ext, output = target, work / ('output.' + target)
            if ext == 'txt':
                run(['pdftotext', '-layout', str(src), str(output)])
            else:
                run(['pdftoppm', '-f', '1', '-singlefile', '-scale-to', '2400', '-png', str(src), str(work / 'output')])
        elif kind == 'image':
            ext = target if action == 'convert' else ('jpg' if action == 'compress' else 'png')
            output = work / ('output.' + ext)
            # Copy to a simple name so ImageMagick never interprets source filenames as options/coders.
            safe = work / ('input' + src.suffix.lower())
            shutil.copyfile(src, safe)
            args = ['magick', str(safe) + '[0]', '-auto-orient']
            if action == 'resize':
                width = int(number(request.get('width', 1920), 16, 16384, 'Width'))
                args += ['-resize', f'{width}x>']
            if action == 'crop':
                args += ['-gravity', 'center', '-crop', '%[fx:min(w,h)]x%[fx:min(w,h)]+0+0', '+repage']
            if ext == 'jpg':
                args += ['-background', 'white', '-alpha', 'remove', '-alpha', 'off']
            args += ['-quality', '78' if action == 'compress' else '90', str(output)]
            run(args)
        elif kind in ('audio', 'video'):
            ext = target if action in ('convert', 'audio') else ('mp3' if kind == 'audio' else 'mp4')
            output = work / ('output.' + ext)
            args = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-nostdin', '-n']
            if action == 'trim':
                start = number(request.get('start', 0), 0, 864000, 'Start')
                duration = number(request.get('duration', 10), 0.01, 864000, 'Duration')
                args += ['-ss', str(start)]
            args += ['-i', str(src)]
            if action == 'trim':
                args += ['-t', str(duration)]
            if action == 'audio' or kind == 'audio':
                args += ['-vn']
                if ext == 'mp3':
                    args += ['-codec:a', 'libmp3lame', '-b:a', '128k' if action == 'compress' else '192k']
            elif ext == 'gif':
                args += ['-an', '-vf', 'fps=12,scale=480:-1:flags=lanczos']
            else:
                if action == 'resize':
                    width = int(number(request.get('width', 1920), 16, 16384, 'Width'))
                    args += ['-vf', f"scale='trunc(min({width},iw)/2)*2':-2,setsar=1"]
                else:
                    args += ['-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2,setsar=1']
                args += ['-c:v', 'libvpx-vp9' if ext == 'webm' else 'libx264', '-crf', '30' if action == 'compress' else '23']
                args += ['-b:v', '0', '-c:a', 'libopus'] if ext == 'webm' else ['-preset', 'medium', '-c:a', 'aac']
                if action == 'mute':
                    args += ['-an']
            run(args + [str(output)])
        if not output.is_file() or (output.stat().st_size == 0 and action not in ('copy', 'move')):
            raise ValueError('Converter produced no output. The format or codec may not be supported.')
        after = src.stat()
        if (before.st_size, before.st_mtime_ns, before.st_ino) != (after.st_size, after.st_mtime_ns, after.st_ino):
            raise ValueError('Source changed during processing. Try again.')
        name = src.name if action in ('copy', 'move') else f'{src.stem}-forge-{action}.{ext}'
        result = publish(output, folder, name)
        if action == 'move':
            try:
                src.unlink()
            except OSError as exc:
                return dict(ok=True, output=str(result), warning='Copied, but could not remove original: ' + str(exc))
        return dict(ok=True, output=str(result))

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('mode', choices=['inspect', 'run', 'clipboard'])
    parser.add_argument('value', nargs='?', default='')
    args = parser.parse_args()
    try:
        if args.mode == 'clipboard':
            data = subprocess.check_output(['wl-paste', '--type', 'text/uri-list'], timeout=5).decode()
            paths = [line for line in data.splitlines() if line and not line.startswith('#')]
            if len(paths) != 1:
                raise ValueError('Copy exactly one file in your file manager first.')
            subprocess.run(['qs', '-c', 'angelos', 'ipc', 'call', 'pixelForge', 'openFile', str(local_path(paths[0]))], check=True)
            return
        result = catalog(local_path(args.value)) if args.mode == 'inspect' else execute(json.loads(args.value))
        print(json.dumps(result))
    except Exception as exc:
        print(json.dumps(dict(ok=False, error=str(exc))))
        sys.exit(1)

if __name__ == '__main__':
    main()
