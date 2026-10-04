"""Synthetic SDNA regressions; no actual Blender assets or private metadata."""

import struct
import unittest
from unittest.mock import patch

from audit_file_browser_buffers import check_file_browser_buffers


def synthetic_blend(sdna_index=0, directory_tail=b''):
    """Small valid legacy container with two fixed-capacity file-selector fields."""
    def padded(data):
        return data + b'\0' * (-len(data) % 4)

    def strings(marker, values):
        return marker + struct.pack('<I', len(values)) + padded(b''.join(
            value + b'\0' for value in values))

    dna = (b'SDNA' + strings(b'NAME', [b'dir[16]', b'file[16]']) +
           strings(b'TYPE', [b'char', b'FileSelectParams']) +
           b'TLEN' + struct.pack('<HH', 1, 32) +
           b'STRC' + struct.pack('<IHHHHHH', 1, 1, 2, 0, 0, 0, 1))

    def block(code, data, index=0, count=1):
        return struct.pack('<4sIQII', code, len(data), 0, index, count) + data

    directory = b'//\0' + directory_tail
    params = directory.ljust(16, b'\0') + b'\0' * 16
    return (b'BLENDER-v500' + block(b'DATA', params, sdna_index) +
            block(b'DNA1', dna) + block(b'ENDB', b'', count=0))


class FileBrowserBufferAuditTests(unittest.TestCase):
    def inspect(self, data):
        with patch('audit_file_browser_buffers.decoded', return_value=data):
            return check_file_browser_buffers('synthetic.blend')

    def test_valid_structure_index_checks_both_capacities(self):
        report = self.inspect(synthetic_blend())
        self.assertTrue(report['passed'])
        self.assertEqual(report['bufferCount'], 2)
        self.assertEqual({item['field'] for item in report['buffers']}, {'dir', 'file'})

    def test_invalid_structure_index_fails_instead_of_reporting_no_buffers(self):
        for index in (1, 100):
            with self.subTest(index=index):
                with self.assertRaisesRegex(RuntimeError, 'Invalid Blender block SDNA index'):
                    self.inspect(synthetic_blend(sdna_index=index))

    def test_valid_structure_with_residual_bytes_does_not_pass(self):
        report = self.inspect(synthetic_blend(directory_tail=b'synthetic'))
        self.assertFalse(report['passed'])
        self.assertEqual(report['bufferCount'], 2)
        self.assertGreater(sum(item['unexpectedBytesAfterNul'] for item in report['buffers']), 0)


if __name__ == '__main__':
    unittest.main()
