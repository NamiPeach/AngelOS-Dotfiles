#!/usr/bin/env python3
"""Import a personally obtained Roxy ANI pack into a Linux Xcursor theme.
No cursor artwork is distributed with this script. Requires Pillow.
"""
import argparse
import io
import json
from pathlib import Path
import shutil
import struct
import tempfile
from PIL import Image
from cursors import xcursor_bytes

MAPPING = {
 '01-Normal.ani': 'default left_ptr arrow top_left_arrow',
 '02-Link.ani': 'pointer hand hand1 hand2 pointing_hand 9d800788f1b08800ae810202380a0822',
 '03-Loading.ani': 'wait watch progress left_ptr_watch half-busy 08e8e1c95fe2fc01f976f1e063a24ccd 3ecb610c1bf2410f44200f48c40d3599',
 '04-Help.ani': 'help question_arrow whats_this d9ce0ab605698f320427677b458ad60b',
 '05-Text Select.ani': 'text xterm ibeam',
 '05-Text Select Alt.ani': 'vertical-text',
 '06-Handwriting.ani': 'pencil handwriting',
 '07-Precision.ani': 'crosshair cross tcross',
 '08-Unavailable.ani': 'not-allowed forbidden crossed_circle no-drop dnd-none 03b6e0fcb3499374a867c041f52298f0',
 '09-Location Select.ani': 'location-select',
 '10-Person Select.ani': 'person-select',
 '11-Vertical Resize.ani': 'ns-resize n-resize s-resize sb_v_double_arrow size_ver v_double_arrow top_side bottom_side 00008160000006810000408080010102',
 '12-Horizontal Resize.ani': 'ew-resize e-resize w-resize sb_h_double_arrow size_hor h_double_arrow left_side right_side 028006030e0e7ebffc7f7070c0600140',
 '13-Diagonal Resize 1.ani': 'nwse-resize nw-resize se-resize size_fdiag top_left_corner bottom_right_corner c7088f0f3e6c8088236ef8e1e3e70000',
 '14-Diagonal Resize 2.ani': 'nesw-resize ne-resize sw-resize size_bdiag top_right_corner bottom_left_corner fcf1c3c7cd4491d801f1e1c78f100000',
 '15-Move.ani': 'move all-scroll size_all fleur grabbing closedhand dnd-move 4498f0e0c1937ffe01fd06f973665830',
 '16-Alternate Select.ani': 'up_arrow center_ptr',
}

def chunks(data):
    pos = 0
    while pos + 8 <= len(data):
        tag, size = struct.unpack_from('<4sI', data, pos)
        if pos + 8 + size > len(data):
            raise ValueError('Truncated ANI chunk')
        body = data[pos+8:pos+8+size]
        if tag == b'LIST' and body[:4] == b'fram':
            yield from chunks(body[4:])
        else:
            yield tag, body
        pos += 8 + size + size % 2

def decode_cursor(data):
    if len(data) < 22:
        raise ValueError('Truncated CUR frame')
    reserved, kind, count = struct.unpack_from('<HHH', data)
    if reserved or kind != 2 or count != 1:
        raise ValueError('Expected one CUR image per ANI frame')
    w, h, _, _, xhot, yhot, length, offset = struct.unpack_from('<BBBBHHII', data, 6)
    w, h = w or 256, h or 256
    if xhot >= w or yhot >= h or offset + length > len(data):
        raise ValueError('Invalid cursor dimensions/hotspot')
    # Decode as ICO to apply its 1-bit AND transparency mask (Pillow CUR skips it).
    ico = bytearray(data)
    struct.pack_into('<H', ico, 2, 1)
    bits = 32 if data[offset:offset+8] == b'\x89PNG\r\n\x1a\n' else struct.unpack_from('<H', data, offset+14)[0]
    struct.pack_into('<HH', ico, 10, 1, bits)
    with Image.open(io.BytesIO(ico)) as image:
        rgba = image.convert('RGBA')
    if rgba.size != (w, h):
        raise ValueError('Unexpected decoded dimensions')
    return rgba, xhot, yhot

def decode_ani(path):
    data = path.read_bytes()
    if data[:4] != b'RIFF' or data[8:12] != b'ACON':
        raise ValueError('Not an ANI file: ' + str(path))
    frames, rates, sequence, header = [], None, None, None
    for tag, body in chunks(data[12:]):
        if tag == b'anih': header = struct.unpack('<9I', body[:36])
        elif tag == b'icon': frames.append(decode_cursor(body))
        elif tag in (b'rate', b'seq '):
            values = list(struct.unpack('<' + 'I' * (len(body)//4), body))
            if tag == b'rate': rates = values
            else: sequence = values
    if not header or len(frames) != header[1] or not frames:
        raise ValueError('ANI frame count mismatch')
    count, default_rate, flags = header[2], header[7], header[8]
    sequence = sequence if flags & 2 else list(range(len(frames)))
    if not sequence or len(sequence) != count or (rates and len(rates) != count):
        raise ValueError('ANI animation sequence mismatch')
    result = []
    # Cumulative rounding preserves duration rather than drifting every frame.
    elapsed, previous = 0, 0
    for step, index in enumerate(sequence):
        if index >= len(frames): raise ValueError('Invalid ANI frame index')
        elapsed += (rates[step] if rates else default_rate) * 1000 / 60
        rounded = round(elapsed)
        delay = max(1, rounded - previous)
        previous = rounded
        result.append((*frames[index], delay))
    return result

def build(source, destination):
    if destination.exists():
        raise ValueError('Output already exists; choose a new folder.')
    destination.parent.mkdir(parents=True, exist_ok=True)
    report = {}
    with tempfile.TemporaryDirectory(prefix='.roxy-import-', dir=destination.parent) as temp:
        stage = Path(temp) / 'Roxy-Migurdia'
        cursor_dir = stage / 'cursors'
        cursor_dir.mkdir(parents=True)
        for filename, aliases in MAPPING.items():
            frames = decode_ani(source / filename)
            images = []
            for size in (32, 48, 64):
                for image, x, y, delay in frames:
                    ratio = size / image.width
                    scaled = image.resize((size, round(image.height * ratio)), Image.Resampling.NEAREST)
                    images.append((size, *scaled.size, min(size-1, round(x*ratio)), min(scaled.height-1, round(y*ratio)), delay, scaled.tobytes()))
            encoded = xcursor_bytes(images)
            for alias in aliases.split():
                (cursor_dir / alias).write_bytes(encoded)
            report[filename] = {'steps':len(frames),'duration_ms':sum(f[3] for f in frames),'hotspot':list(frames[0][1:3]),'aliases':aliases.split()}
        (stage / 'index.theme').write_text('[Icon Theme]\nName=Roxy Migurdia\nComment=Personal import of EbiEbiBeam cursor artwork\nInherits=Adwaita\n', encoding='utf-8')
        shutil.copyfile(source / '[Changelog].txt', stage / 'AUTHOR-NOTES.txt')
        (stage / 'conversion.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
        stage.rename(destination)
    return report

if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source',type=Path)
    parser.add_argument('destination',type=Path)
    args=parser.parse_args()
    report=build(args.source,args.destination)
    print(json.dumps({'theme':str(args.destination),'roles':len(report),'sizes':[32,48,64]},indent=2))
