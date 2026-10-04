"""Regression tests for stale bytes after an RNA C-string terminator.

Run: python3 -m unittest discover -s scripts/blender -p 'test_*.py'
The real saved SDNA buffers are checked separately by audit_file_browser_buffers.py.
"""

import importlib.util
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch


class Params:
    """Model Blender's short C-string assignment, which preserves the tail."""

    def __init__(self):
        self.buffers = {'directory': bytearray(b'/old/folder\0stale-tail\0'),
                        'filename': bytearray(b'old.blend\0stale.blend\0')}
        self.bl_rna = SimpleNamespace(properties={
            name: SimpleNamespace(length_max=len(buf)) for name, buf in self.buffers.items()})

    def __getattr__(self, name):
        value = bytes(self.buffers[name]).split(b'\0', 1)[0]
        return value if name == 'directory' else value.decode()

    def __setattr__(self, name, value):
        if name not in ('directory', 'filename'):
            object.__setattr__(self, name, value)
            return
        value = value if isinstance(value, bytes) else value.encode()
        target = self.buffers[name]
        value = value[:len(target) - 1]
        target[:len(value) + 1] = value + b'\0'


def load_helper(space):
    fake_bpy = SimpleNamespace(data=SimpleNamespace(screens=[SimpleNamespace(
        areas=[SimpleNamespace(spaces=[space])])]))
    spec = importlib.util.spec_from_file_location(
        'tested_public_metadata', Path(__file__).with_name('public_metadata.py'))
    module = importlib.util.module_from_spec(spec)
    with patch.dict(sys.modules, {'bpy': fake_bpy}):
        spec.loader.exec_module(module)
    return module


class PublicMetadataTests(unittest.TestCase):
    def assert_clean(self, params):
        self.assertEqual(params.directory, b'//')
        self.assertEqual(params.filename, '')
        for data in params.buffers.values():
            tail = data[data.index(0) + 1:]
            self.assertTrue(all(byte in (0, ord('_')) for byte in tail))

    def test_short_assignment_reproduces_the_regression(self):
        params = Params()
        params.directory = b'//'
        params.filename = ''
        for data in params.buffers.values():
            self.assertTrue(any(byte not in (0, ord('_')) for byte in data[data.index(0) + 1:]))

    def test_both_strings_in_files_and_assets_are_cleared(self):
        space = SimpleNamespace(type='FILE_BROWSER', browse_mode='ASSETS',
                                params=Params(), asset_params=Params())
        helper = load_helper(space)
        self.assertEqual(helper.clear_file_browser_state(), 4)
        self.assert_clean(space.params)
        self.assert_clean(space.asset_params)
        self.assertEqual(space.browse_mode, 'ASSETS')

    def test_uninitialized_asset_browser_and_repeat_are_safe(self):
        space = SimpleNamespace(type='FILE_BROWSER', browse_mode='FILES',
                                params=Params(), asset_params=None)
        helper = load_helper(space)
        helper.clear_file_browser_state()
        previous = {k: bytes(v) for k, v in space.params.buffers.items()}
        helper.clear_file_browser_state()
        self.assertEqual(previous, {k: bytes(v) for k, v in space.params.buffers.items()})
        self.assert_clean(space.params)
        self.assertEqual(space.browse_mode, 'FILES')

    def test_unknown_capacity_aborts_and_restores_browse_mode(self):
        space = SimpleNamespace(type='FILE_BROWSER', browse_mode='ASSETS',
                                params=Params(), asset_params=Params())
        space.params.bl_rna.properties['directory'].length_max = 0
        with self.assertRaises(RuntimeError):
            load_helper(space).clear_file_browser_state()
        self.assertEqual(space.browse_mode, 'ASSETS')


if __name__ == '__main__':
    unittest.main()
