"""
Export a .blend to a web-ready .glb, minus the studio rig.

  blender scene.blend --background --python export_web.py -- out.glb

A scene lit for offline rendering contains furniture that exists only to
bounce light: a giant backdrop plane, white cards either side of the
subject, maybe a floor that runs to the horizon. Blender keeps them out
of frame; glTF has no concept of "this is only for lighting", so they
export as ordinary geometry and land right in the middle of the shot.

In monument.blend that is Backdrop (150x70) and CARD_C / CARD_KEY /
CARD_M (20x20 and 24x24). Deleting them before export is the difference
between seeing the monument and seeing a grey wall.

Deletion happens in memory only — the .blend on disk is never written.
"""

import sys
import re
import bpy

# Objects whose names match any of these are lighting rig, not subject.
RIG_PATTERNS = [
    r"^Backdrop",
    r"^CARD_",
    r"^BOUNCE",
    r"^Floor_?Infinite",
]


def is_rig(name):
    return any(re.match(p, name, re.IGNORECASE) for p in RIG_PATTERNS)


def main():
    argv = sys.argv
    out = argv[argv.index("--") + 1]

    removed = []
    for obj in list(bpy.data.objects):
        if is_rig(obj.name):
            removed.append(obj.name)
            bpy.data.objects.remove(obj, do_unlink=True)

    print(f"REMOVED_RIG {removed}")

    bpy.ops.export_scene.gltf(
        filepath=out,
        export_format="GLB",
        # Draco needs a decoder shipped alongside; leave it off until the
        # scene is settled, then turn it on and add the decoder files.
        export_draco_mesh_compression_enable=False,
        export_cameras=True,
        export_lights=True,
        export_apply=True,
        export_yup=True,
    )
    print(f"WROTE {out}")


if __name__ == "__main__":
    main()
