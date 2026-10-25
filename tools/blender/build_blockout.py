"""Builds anu's floating island (a grass slab on brick pillars) and saves blender/island.blend.

Run from the repo root:
    /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
        --python tools/blender/build_blockout.py

The island is empty on purpose: the New York skyline around it is the scene. Units are
metres, Z is up, and the grass top sits at z = 0. Clouds and the city are not baked:
src/clouds.js and src/skyline.js draw them at runtime.
"""

import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).parent))
from lib import add_box, brick_wall, linear, mesh_object, new_collection, rng, varied  # noqa: E402

BLEND_PATH = Path(__file__).resolve().parents[2] / "blender" / "island.blend"


# ---------------------------------------------------------------- scene parts


def build_island(col):
    grass = varied("Grass", "#6DB55B", "#8FD27A", scale=2.5)
    brick = brick_wall("Brick")

    bm = bmesh.new()
    add_box(bm, (6.1, 6.1, 0.3), center=(0, 0, -0.15), bevel=0.05)
    top = mesh_object("Grass_Top", bm, col, [grass])
    top["texel_weight"] = 1.6

    # Brick pillars hang under the grass in a 6x6 grid, each a different length.
    # One mesh keeps the bake fast; the brick texture draws the rows.
    bm = bmesh.new()
    cell = 1.0
    for ix in range(6):
        for iy in range(6):
            border = ix in (0, 5) or iy in (0, 5)
            depth = rng.uniform(1.6, 4.8) if border else rng.uniform(1.0, 3.4)
            x = -2.5 + cell * ix
            y = -2.5 + cell * iy
            add_box(bm, (cell - 0.06, cell - 0.06, depth), center=(x, y, -0.3 - depth / 2), bevel=0.05)
    pillars = mesh_object("Brick_Pillars", bm, col, [brick])
    pillars["texel_weight"] = 0.5


def build_lighting(day_col, night_col, preview_col):
    def sun(name, color, strength, tilt, heading, col):
        data = bpy.data.lights.new(name, "SUN")
        data.color = linear(color)[:3]
        data.energy = strength
        data.angle = math.radians(8)
        obj = bpy.data.objects.new(name, data)
        obj.rotation_euler = (math.radians(tilt), 0, math.radians(heading))
        col.objects.link(obj)

    sun("Sun", "#FFF1DC", 3.5, 40, 98, day_col)
    sun("Moon", "#B8C4FF", 1.8, 35, 248, night_col)

    for mode, color, strength in (("day", "#A9D6F2", 1.0), ("night", "#2A2658", 1.2)):
        world = bpy.data.worlds.new(f"World_{mode}")
        world.use_fake_user = True  # the night world has no users and would be dropped on save
        world.use_nodes = True
        background = world.node_tree.nodes["Background"]
        background.inputs["Color"].default_value = linear(color)
        background.inputs["Strength"].default_value = strength

    camera_data = bpy.data.cameras.new("Preview_Camera")
    camera_data.lens = 50
    camera = bpy.data.objects.new("Preview_Camera", camera_data)
    camera.location = (16, -18, 7)
    direction = Vector((0, 0, 2.2)) - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    preview_col.objects.link(camera)
    bpy.context.scene.camera = camera


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"

    set_first = new_collection("Set_First")
    day = new_collection("Lighting_Day")
    night = new_collection("Lighting_Night")
    preview = new_collection("Preview")

    build_island(set_first)
    build_lighting(day, night, preview)

    scene.world = bpy.data.worlds["World_day"]
    night.hide_render = True
    scene.render.engine = "CYCLES"
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 800

    BLEND_PATH.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
    print(f"saved {BLEND_PATH} with {len(bpy.data.objects)} objects")


main()
