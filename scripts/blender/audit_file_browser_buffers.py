"""Check full SDNA file-selector string capacities, without exposing their values.

python3 scripts/blender/audit_file_browser_buffers.py assets/blender/anatomy.blend

Supports plain/gzip/zstd .blend files. Zstd requires the zstd executable on PATH.
This is a narrow stale-buffer check, not a general secret or metadata scanner.
Expected visible strings are directory='//' and filename=''; all bytes after
their first NUL must be NUL or the sanitizer's neutral '_' filler.
"""

import argparse
from functools import lru_cache
import gzip
import json
from pathlib import Path
import re
import shutil
import struct
import subprocess


def decoded(path):
    data = path.read_bytes()
    if data.startswith(b'\x1f\x8b'):
        return gzip.decompress(data)
    if data.startswith(b'\x28\xb5\x2f\xfd'):
        executable = shutil.which('zstd')
        if not executable:
            raise RuntimeError('Install zstd to inspect compressed Blender data')
        result = subprocess.run([executable, '-dc', str(path)], check=True,
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return result.stdout
    return data


def check_file_browser_buffers(path):
    data = decoded(Path(path))
    if data[:7] != b'BLENDER':
        raise RuntimeError('Unsupported Blender file header')
    modern = data[7:9] == b'17'
    pointer_marker = data[9:10] if modern else data[7:8]
    endian_marker = data[12:13] if modern else data[8:9]
    if pointer_marker not in (b'-', b'_') or endian_marker not in (b'v', b'V'):
        raise RuntimeError('Unsupported Blender architecture header')
    pointer_size = 8 if pointer_marker == b'-' else 4
    endian = '<' if endian_marker == b'v' else '>'
    if modern and (pointer_size != 8 or data[9:12] != b'-01'):
        raise RuntimeError('Unsupported modern Blender block format')
    header = struct.Struct(endian + ('4sIQQQ' if modern else
                                    '4sI' + ('Q' if pointer_size == 8 else 'I') + 'II'))
    blocks = []
    cursor = 17 if modern else 12
    while cursor + header.size <= len(data):
        values = header.unpack_from(data, cursor)
        code, sdna, _address, size, count = values if modern else (
            values[0], values[3], values[2], values[1], values[4])
        cursor += header.size
        if cursor + size > len(data):
            raise RuntimeError('Truncated Blender block')
        blocks.append((code, sdna, cursor, size, count))
        cursor += size
        if code == b'ENDB':
            break
    if not blocks or blocks[-1][0] != b'ENDB':
        raise RuntimeError('Missing Blender end block')
    dna_blocks = [b for b in blocks if b[0] == b'DNA1']
    if len(dna_blocks) != 1:
        raise RuntimeError('Expected exactly one SDNA block')
    _, _, offset, length, _ = dna_blocks[0]
    raw = data[offset:offset + length]
    position = 0

    def marker(expected):
        nonlocal position
        if raw[position:position + 4] != expected:
            raise RuntimeError('Invalid SDNA section')
        position += 4

    def strings():
        nonlocal position
        count = struct.unpack_from(endian + 'I', raw, position)[0]
        position += 4
        result = []
        for _ in range(count):
            end = raw.index(b'\0', position)
            result.append(raw[position:end].decode('ascii'))
            position = end + 1
        position = (position + 3) & ~3
        return result

    marker(b'SDNA')
    marker(b'NAME')
    names = strings()
    marker(b'TYPE')
    types = strings()
    marker(b'TLEN')
    lengths = struct.unpack_from(endian + str(len(types)) + 'H', raw, position)
    position = (position + 2 * len(types) + 3) & ~3
    marker(b'STRC')
    count = struct.unpack_from(endian + 'I', raw, position)[0]
    position += 4
    structures = []
    for _ in range(count):
        type_index, field_count = struct.unpack_from(endian + 'HH', raw, position)
        position += 4
        fields = []
        offset = 0
        for _ in range(field_count):
            field_type, field_name = struct.unpack_from(endian + 'HH', raw, position)
            position += 4
            name = names[field_name]
            repeat = 1
            for size in re.findall(r'\[(\d+)\]', name):
                repeat *= int(size)
            pointer = '*' in name
            size = (pointer_size if pointer else lengths[field_type]) * repeat
            fields.append((types[field_type], name, offset, size, pointer, repeat))
            offset += size
        if offset != lengths[type_index]:
            raise RuntimeError('Unrecognized SDNA padding; cannot prove buffer coverage')
        structures.append((types[type_index], lengths[type_index], fields))
    by_name = {s[0]: s for s in structures}

    @lru_cache(maxsize=None)
    def targets(structure_name):
        _, _, fields = by_name[structure_name]
        result = []
        for field_type, name, offset, size, pointer, repeat in fields:
            if pointer:
                continue
            if structure_name == 'FileSelectParams' and field_type == 'char' and (
                    name.startswith('dir[') or name.startswith('file[')):
                result.append((name.split('[')[0], offset, size))
            elif field_type in by_name:
                for index in range(repeat):
                    for child_name, child_offset, child_size in targets(field_type):
                        result.append((child_name, offset + index * by_name[field_type][1] +
                                       child_offset, child_size))
        return tuple(result)

    buffers = []
    for code, sdna, offset, size, count in blocks:
        if code in (b'DNA1', b'ENDB'):
            continue
        if sdna >= len(structures):
            raise RuntimeError('Invalid Blender block SDNA index; cannot prove buffer coverage')
        name, stride, _ = structures[sdna]
        selected = targets(name)
        if not selected:
            continue
        if not stride or size != count * stride:
            raise RuntimeError('Unexpected file-selector block size')
        for index in range(count):
            for field, field_offset, capacity in selected:
                begin = offset + index * stride + field_offset
                value = data[begin:begin + capacity]
                terminator = value.find(b'\0')
                expected = b'//' if field == 'dir' else b''
                valid_visible = terminator >= 0 and value[:terminator] == expected
                unexpected_tail = sum(byte not in (0, ord('_')) for byte in value[terminator + 1:])
                buffers.append({'structure': name, 'field': field, 'capacity': capacity,
                                'visibleValueAllowed': valid_visible,
                                'unexpectedBytesAfterNul': unexpected_tail,
                                'passed': valid_visible and unexpected_tail == 0})
    # A missing editor is safe, but absence of its known SDNA schema is not.
    if 'FileSelectParams' not in by_name or len(targets('FileSelectParams')) != 2:
        raise RuntimeError('Expected directory and filename SDNA capacities')
    return {'schemaVersion': 1, 'structuresChecked': len(structures),
            'bufferCount': len(buffers), 'buffers': buffers,
            'passed': all(item['passed'] for item in buffers)}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path)
    args = parser.parse_args()
    report = check_file_browser_buffers(args.input)
    print(json.dumps(report, indent=2))
    raise SystemExit(0 if report['passed'] else 1)
