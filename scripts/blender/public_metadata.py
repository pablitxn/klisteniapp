"""Clear Blender's saved file-selector buffers without editing model content."""

import bpy


def clear_file_browser_state():
    """Overwrite complete RNA string capacities before assigning public values.

    Assigning a shorter string alone leaves old bytes after its NUL terminator
    in the saved .blend. Embedded NULs cannot clear those bytes through RNA, so
    use a neutral filler first. audit_file_browser_buffers.py checks for only
    that filler or NUL after the final string. Preserve the original mode.
    """
    cleared = 0
    for screen in bpy.data.screens:
        for area in screen.areas:
            for space in area.spaces:
                if space.type != 'FILE_BROWSER':
                    continue
                previous = space.browse_mode
                try:
                    for mode in ('FILES', 'ASSETS'):
                        space.browse_mode = mode
                        params = (space.params if mode == 'FILES' else
                                  getattr(space, 'asset_params', None) or space.params)
                        if params is None:
                            continue
                        for name, final in (('directory', b'//'), ('filename', '')):
                            prop = params.bl_rna.properties.get(name)
                            if prop is None or prop.length_max < 3:
                                raise RuntimeError('Unsupported file-selector string capacity')
                            current = getattr(params, name)
                            filler = b'_' if isinstance(current, bytes) else '_'
                            if isinstance(current, bytes) != isinstance(final, bytes):
                                raise RuntimeError('Unsupported file-selector string type')
                            setattr(params, name, filler * (prop.length_max - 1))
                            setattr(params, name, final)
                            if getattr(params, name) != final:
                                raise RuntimeError('File-selector metadata clearing failed')
                            cleared += 1
                finally:
                    space.browse_mode = previous
    return cleared
