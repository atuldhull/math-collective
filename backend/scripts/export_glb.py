"""
Export a .blend scene to a web-ready .glb.

Run headless:
  blender monument.blend --background --python export_glb.py -- out.glb

Why glTF/GLB rather than a rendered video: the browser loads the actual
geometry and materials and draws them with Three.js, so the scene stays
interactive — it can react to scroll, to the pointer, to the theme —
and it costs one download instead of tens of megabytes of frames.

What this does NOT carry across, and it matters:
  - Cycles/EEVEE lighting. glTF has no concept of Blender's renderer,
    so anything that depended on ray-traced bounce light, volumetrics or
    bloom will look flatter in the browser. The fix is to BAKE lighting
    into textures in Blender first; then the browser is just drawing the
    baked result and it looks close to the render.
  - Compositor effects (glare, colour grading). Those are post-process
    passes; the equivalent on the web is Three.js postprocessing.
"""

import sys
import bpy


def main():
    argv = sys.argv
    out = argv[argv.index("--") + 1] if "--" in argv else "//export.glb"

    # Draco compresses mesh data hard — typically 4-10x on geometry — and
    # three.js can decode it with a loader that is already tree-shaken
    # into most builds. The cost is a small CPU decode on load.
    bpy.ops.export_scene.gltf(
        filepath=out,
        export_format="GLB",
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        # Cameras and lights come across so the web scene can reuse the
        # framing that was set up in Blender rather than guessing it.
        export_cameras=True,
        export_lights=True,
        export_apply=True,          # apply modifiers
        export_yup=True,            # three.js is Y-up, Blender is Z-up
    )
    print(f"WROTE {out}")


if __name__ == "__main__":
    main()
