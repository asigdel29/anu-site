"""Bakes the day and night atlases of blender/island.blend and exports the mesh pack the site loads.

Run from the repo root:
    /Applications/Blender.app/Contents/MacOS/Blender -b blender/island.blend \
        --python tools/blender/bake_export.py -- --size 4096 --samples 1024

Outputs:
    public/models/island.bin
    public/textures/island/{day,night}/first_{desktop,mobile}.webp

Rules this script keeps:
- Each atlas set gets one shared UV map named "Bake". If any object lacks it, the whole set is
  unwrapped again and the .blend is saved, so later runs reuse the same layout.
- Day and night bake from the same UVs in the same run, so the two textures always line up.
- Export prep (joins, stripped materials) happens in memory only; the .blend is never saved after it.
"""

import argparse
import math
import shutil
import subprocess
import sys
from pathlib import Path

import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from mesh_pack import BAKE_UV, export_mesh_pack  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "blender" / "out"
MESH_PATH = ROOT / "public" / "models" / "island.bin"
TEXTURE_DIR = ROOT / "public" / "textures" / "island"

# Atlas name -> collection that holds its objects. Atlas names are also mesh-name tokens.
SETS = {"First": "Set_First"}
MOBILE_MAX = 2048


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--size", type=int, default=4096, help="desktop atlas size in px")
    parser.add_argument("--samples", type=int, default=1024, help="Cycles samples per bake")
    return parser.parse_args(argv)


def set_objects(atlas):
    """Meshes of one atlas set; meshes marked vertex_bake keep their light in vertex colours instead."""
    return [o for o in bpy.data.collections[SETS[atlas]].all_objects if o.type == "MESH" and not o.get("vertex_bake")]


def vertex_baked_objects():
    return [o for atlas in SETS for o in bpy.data.collections[SETS[atlas]].all_objects if o.get("vertex_bake")]


def bake_vertex_colours(mode):
    """Bakes full lighting into a per-vertex colour named after the mode ("Day", "Night").

    Used for the blossom canopy: its many small UV islands showed seams in an atlas, and colour
    per vertex has no seams at all.
    """
    for obj in vertex_baked_objects():
        name = mode.title()
        colours = obj.data.color_attributes
        layer = colours.get(name) or colours.new(name, "FLOAT_COLOR", "POINT")
        colours.active_color = layer
        select_only([obj])
        bpy.ops.object.bake(type="COMBINED", target="VERTEX_COLORS")


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

    # Per-object texel weight: the plain clay pillars give pixels to the grass top.
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
    # A fixed fraction keeps about 4 px between islands at 1024 px. The default margin scales
    # with island size, so small islands touched and baked black seams.
    bpy.ops.uv.pack_islands(margin=0.004, margin_method="FRACTION", rotate=True, shape_method="AABB")
    bpy.ops.object.mode_set(mode="OBJECT")
    return True


def set_lighting(mode):
    """Shows only the lights and world of one mode (day or night)."""
    bpy.data.collections["Lighting_Day"].hide_render = mode != "day"
    bpy.data.collections["Lighting_Night"].hide_render = mode != "night"
    bpy.context.scene.world = bpy.data.worlds[f"World_{mode}"]


def fill_gaps(png_path):
    """Floods every unbaked pixel of the saved PNG with the colour of the nearest baked island.

    The bake leaves the space between UV islands black (alpha 0). Lossy WebP smears that black
    into the island edges, so every UV seam would show as a dark line on the model.
    The PNG is read back from disk because the image in memory does not hold the baked colours.
    """
    loaded = bpy.data.images.load(str(png_path))
    width, height = loaded.size
    pixels = np.empty(width * height * 4, dtype=np.float32)
    loaded.pixels.foreach_get(pixels)
    bpy.data.images.remove(loaded)
    pixels = pixels.reshape(height, width, 4)
    shifts = ((1, 0), (-1, 0), (0, 1), (0, -1))
    # The outer ring of each island is shaded from points just past the triangle edges, inside
    # the mesh, so it bakes dark. Repaint it from the pixels just inside. A part too thin to
    # have an inside keeps its own pixels.
    baked = pixels[..., 3] > 0
    inside = baked & np.logical_and.reduce([np.roll(baked, shift, axis=(0, 1)) for shift in shifts])
    colour = sum(np.roll(pixels * inside[..., None], shift, axis=(0, 1)) for shift in shifts)
    count = sum(np.roll(inside, shift, axis=(0, 1)).astype(np.float32) for shift in shifts)
    ring = baked & ~inside & (count > 0)
    pixels[ring, :3] = colour[ring, :3] / count[ring, None]
    while not pixels[..., 3].all():
        # Each pass grows the baked area by one pixel, averaging the baked neighbours.
        neighbours = [np.roll(pixels, shift, axis=(0, 1)) for shift in shifts]
        total = sum(n * n[..., 3:4] for n in neighbours)
        grow = (pixels[..., 3] == 0) & (total[..., 3] > 0)
        pixels[grow, :3] = total[grow, :3] / total[grow, 3:4]
        pixels[grow, 3] = 1
    # A new image: changed pixels of a loaded image are not written back by save().
    filled = bpy.data.images.new("filled", width, height, alpha=False)
    filled.pixels.foreach_set(pixels.ravel())
    filled.filepath_raw = str(png_path)
    filled.file_format = "PNG"
    filled.save()
    bpy.data.images.remove(filled)


def bake_atlas(atlas, mode, size):
    """Bakes full lighting (COMBINED, so emission glows too) for one set into one image."""
    image = bpy.data.images.new(f"{atlas}_{mode}", size, size, float_buffer=True, alpha=True)
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
    bpy.ops.object.bake(type="COMBINED", margin=0, use_clear=True, target="IMAGE_TEXTURES")
    for obj in objects:
        obj.hide_render = False
    bpy.data.objects.remove(merged, do_unlink=True)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    png_path = OUT_DIR / f"{atlas.lower()}_{mode}.png"
    settings = bpy.context.scene.render.image_settings
    settings.file_format = "PNG"
    settings.color_depth = "8"
    settings.color_mode = "RGBA"
    image.save_render(str(png_path), scene=bpy.context.scene)
    fill_gaps(png_path)
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


def prepare_for_export():
    """Joins each atlas set into one mesh named after it, keeps only the Bake UV map and strips materials.

    In memory only: the .blend is never saved after this.
    """
    exported = []
    for atlas in SETS:
        select_only(set_objects(atlas))
        bpy.ops.object.join()
        joined = bpy.context.view_layer.objects.active
        joined.name = atlas
        joined.data.name = atlas
        exported.append(joined)

    exported += vertex_baked_objects()
    for obj in exported:
        mesh = obj.data
        for layer in [l for l in mesh.uv_layers if l.name != BAKE_UV]:
            mesh.uv_layers.remove(layer)
        mesh.materials.clear()

    select_only(exported)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return exported


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
    # Samples spread over the pixel filter; at an island edge some miss the mesh and darken the
    # edge pixels, which shows as a dark line along every UV seam. Keep them on the pixel centre.
    scene.cycles.filter_width = 0.01
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
        bake_vertex_colours(mode)

    exported = prepare_for_export()
    export_mesh_pack(exported, MESH_PATH, bpy.data.collections["Anchors"].objects)
    print(f"exported {MESH_PATH} ({MESH_PATH.stat().st_size // 1024} KB)")


main()
