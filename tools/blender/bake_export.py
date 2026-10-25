"""Bakes the day and night atlases of blender/island.blend into the WebP files the site loads.

Run from the repo root:
    /Applications/Blender.app/Contents/MacOS/Blender -b blender/island.blend \
        --python tools/blender/bake_export.py -- --size 4096 --samples 1024

Outputs:
    public/textures/island/{day,night}/{first,second}_{desktop,mobile}.webp

Rules this script keeps:
- Each atlas set gets one shared UV map named "Bake". If any object lacks it, the whole set is
  unwrapped again and the .blend is saved, so later runs reuse the same layout.
- Day and night bake from the same UVs in the same run, so the two textures always line up.
"""

import argparse
import math
import shutil
import subprocess
import sys
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "blender" / "out"
TEXTURE_DIR = ROOT / "public" / "textures" / "island"

# Atlas name -> collection that holds its objects. Atlas names are also mesh-name tokens.
SETS = {"First": "Set_First", "Second": "Set_Second"}
MOBILE_MAX = 2048
BAKE_UV = "Bake"


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--size", type=int, default=4096, help="desktop atlas size in px")
    parser.add_argument("--samples", type=int, default=1024, help="Cycles samples per bake")
    return parser.parse_args(argv)


def set_objects(atlas):
    return [o for o in bpy.data.collections[SETS[atlas]].all_objects if o.type == "MESH"]


def select_only(objects):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]


def ensure_uvs(atlas):
    """Unwraps and packs the whole set into one shared layout when any object lacks the Bake map."""
    objects = set_objects(atlas)
    if all(BAKE_UV in o.data.uv_layers for o in objects):
        for obj in objects:
            obj.data.uv_layers.active = obj.data.uv_layers[BAKE_UV]
            obj.data.uv_layers[BAKE_UV].active_render = True
        return False

    for obj in objects:
        layer = obj.data.uv_layers.get(BAKE_UV) or obj.data.uv_layers.new(name=BAKE_UV)
        obj.data.uv_layers.active = layer
        layer.active_render = True

    select_only(objects)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.002)
    bpy.ops.uv.average_islands_scale()
    bpy.ops.object.mode_set(mode="OBJECT")

    # Per-object texel weight: big, plain surfaces (clouds, canopy) give pixels to the grass and props.
    # Weights are divided by the largest one so every UV stays inside the 0-1 tile; the packer
    # would otherwise put them in another UDIM tile, which wraps onto other islands.
    heaviest = max(obj.get("texel_weight", 1.0) for obj in objects)
    for obj in objects:
        scale = obj.get("texel_weight", 1.0) / heaviest
        for loop_uv in obj.data.uv_layers[BAKE_UV].data:
            loop_uv.uv *= scale

    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    # Box packing: the default concave packer takes many minutes with many islands.
    bpy.ops.uv.pack_islands(margin=0.003, rotate=True, shape_method="AABB")
    bpy.ops.object.mode_set(mode="OBJECT")
    return True


def set_lighting(mode):
    """Shows only the lights and world of one mode (day or night)."""
    bpy.data.collections["Lighting_Day"].hide_render = mode != "day"
    bpy.data.collections["Lighting_Night"].hide_render = mode != "night"
    bpy.context.scene.world = bpy.data.worlds[f"World_{mode}"]


def bake_atlas(atlas, mode, size):
    """Bakes full lighting (COMBINED, so emission glows too) for one set into one image."""
    image = bpy.data.images.new(f"{atlas}_{mode}", size, size, float_buffer=True, alpha=False)
    objects = set_objects(atlas)
    for mat in {slot.material for o in objects for slot in o.material_slots if slot.material}:
        nodes = mat.node_tree.nodes
        target = nodes.get("Bake_Target") or nodes.new("ShaderNodeTexImage")
        target.name = "Bake_Target"
        target.image = image
        nodes.active = target

    # Cycles runs one full pass per baked object, so bake a joined temporary copy in a single pass.
    select_only(objects)
    bpy.ops.object.duplicate()
    bpy.ops.object.join()
    merged = bpy.context.view_layer.objects.active
    merged.shadow_terminator_geometry_offset = max(o.shadow_terminator_geometry_offset for o in objects)
    for obj in objects:
        obj.hide_render = True
    select_only([merged])
    bpy.ops.object.bake(type="COMBINED", margin=16, use_clear=True, target="IMAGE_TEXTURES")
    for obj in objects:
        obj.hide_render = False
    bpy.data.objects.remove(merged, do_unlink=True)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    png_path = OUT_DIR / f"{atlas.lower()}_{mode}.png"
    settings = bpy.context.scene.render.image_settings
    settings.file_format = "PNG"
    settings.color_depth = "8"
    settings.color_mode = "RGB"
    image.save_render(str(png_path), scene=bpy.context.scene)
    return png_path


def write_webp(png_path, atlas, mode, size):
    """Encodes the desktop atlas and a mobile copy capped at 2048 px."""
    out_dir = TEXTURE_DIR / mode
    out_dir.mkdir(parents=True, exist_ok=True)
    stem = atlas.lower()
    subprocess.run(["cwebp", "-quiet", "-q", "85", "-m", "6", "-sharp_yuv", str(png_path),
                    "-o", str(out_dir / f"{stem}_desktop.webp")], check=True)
    mobile = min(size, MOBILE_MAX)
    subprocess.run(["cwebp", "-quiet", "-q", "82", "-m", "6", "-sharp_yuv", "-resize", str(mobile), str(mobile),
                    str(png_path), "-o", str(out_dir / f"{stem}_mobile.webp")], check=True)


def main():
    args = parse_args()
    if not shutil.which("cwebp"):
        sys.exit("cwebp is missing: brew install webp")

    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    try:
        prefs.compute_device_type = "METAL"
        prefs.get_devices()
        for device in prefs.devices:
            device.use = True
        scene.cycles.device = "GPU"
    except TypeError:
        print("Metal is not available; baking on the CPU")
    scene.cycles.samples = args.samples
    # Same view transform for both modes, so the shader's gamma step reproduces what Blender shows.
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"

    if any([ensure_uvs(atlas) for atlas in SETS]):
        print("saved new UV layout:", bpy.ops.wm.save_mainfile())

    for mode in ("day", "night"):
        set_lighting(mode)
        for atlas in SETS:
            png_path = bake_atlas(atlas, mode, args.size)
            write_webp(png_path, atlas, mode, args.size)
            print(f"baked {atlas} {mode}")



main()
