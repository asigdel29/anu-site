"""Builds the blockout of anu's cherry blossom island and saves blender/island.blend.

Run from the repo root:
    /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
        --python tools/blender/build_blockout.py

Every object already has its final name (see props.py), so later art can replace meshes
one at a time without touching the site code. Units are metres, Z is up, and the grass
top sits at z = 0. Clouds are not baked: src/clouds.js draws and moves them at runtime.
"""

import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).parent))
from lib import (add_box, add_cylinder, add_sphere, apply_modifiers, brick_wall,  # noqa: E402
                 grass_with_petals, linear, mesh_object, new_collection, principled, rng,
                 spot, varied)
from props import build_props  # noqa: E402

BLEND_PATH = Path(__file__).resolve().parents[2] / "blender" / "island.blend"


# ---------------------------------------------------------------- scene parts


def build_island(col):
    grass = grass_with_petals("Grass")
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


def build_tree(col):
    bark = varied("Bark", "#2E2940", "#4A4362", scale=6.0)
    blossom = varied("Blossom", "#E2405F", "#FF7A93", scale=1.6, leafy=True)

    # Skeleton: base, three stems, thin branches and surface roots. Radius per vertex.
    points = [
        ((0.0, 0.0, -0.3), 0.46),  # 0 base
        ((0.0, 0.0, 0.6), 0.38),  # 1
        ((0.08, 0.05, 1.5), 0.32),  # 2 split
        ((-0.5, 0.2, 2.6), 0.22),  # 3 stem A
        ((-1.4, 0.5, 3.6), 0.15),  # 4
        ((-2.6, 0.6, 4.3), 0.08),  # 5
        ((0.5, -0.2, 2.7), 0.22),  # 6 stem B
        ((1.5, -0.4, 3.7), 0.14),  # 7
        ((2.6, -0.9, 4.4), 0.08),  # 8
        ((0.1, 0.3, 3.0), 0.2),  # 9 stem C
        ((0.3, 0.6, 4.2), 0.13),  # 10
        ((0.0, 1.3, 5.0), 0.07),  # 11
        ((-1.8, 1.6, 4.2), 0.06),  # 12 twig
        ((1.6, 0.9, 4.4), 0.06),  # 13 twig
        ((-0.8, 0.2, 4.9), 0.06),  # 14 twig
        ((-0.9, 0.5, 0.04), 0.11),  # 15 root
        ((0.6, 0.85, 0.04), 0.1),  # 16 root
        ((-0.75, -0.6, 0.04), 0.1),  # 17 root
    ]
    edges = [(0, 1), (1, 2), (2, 3), (3, 4), (4, 5), (2, 6), (6, 7), (7, 8), (2, 9), (9, 10), (10, 11),
             (4, 12), (7, 13), (10, 14), (1, 15), (1, 16), (1, 17)]
    mesh = bpy.data.meshes.new("Trunk")
    mesh.from_pydata([p for p, _ in points], edges, [])
    trunk = bpy.data.objects.new("Trunk", mesh)
    col.objects.link(trunk)
    trunk.modifiers.new("Skin", "SKIN").use_smooth_shade = True
    for vertex, (_, radius) in zip(mesh.skin_vertices[0].data, points):
        vertex.radius = (radius, radius)
    subsurf = trunk.modifiers.new("Subsurf", "SUBSURF")
    subsurf.levels = 1
    apply_modifiers(trunk)
    trunk.data.materials.append(bark)

    # Canopy: lumpy opaque clumps in a wide dome. One mesh, so the site can read its bounds.
    bm = bmesh.new()
    for _ in range(80):
        angle = rng.uniform(0, math.tau)
        reach = math.sqrt(rng.uniform(0, 1)) * 4.6
        center = (math.cos(angle) * reach, math.sin(angle) * reach,
                  4.9 + rng.uniform(-0.5, 0.8) - (reach / 4.6) ** 2 * 1.2)
        radius = rng.uniform(0.55, 0.95)
        verts = add_sphere(bm, radius, subdivisions=2)
        for v in verts:
            v.co.z *= 0.85
            v.co *= 1 + rng.uniform(-0.1, 0.1)
        bmesh.ops.translate(bm, vec=center, verts=verts)
    for face in bm.faces:
        face.smooth = True
    canopy = mesh_object("Canopy_First", bm, col, [blossom])
    canopy["texel_weight"] = 0.45
    canopy.shadow_terminator_geometry_offset = 0.8  # no dark bands on smooth low-poly clumps


def build_lantern(col, night_col):
    glow = principled("Lantern_Glow", "#FFD38A", emission="#FFB454", strength=4.0)
    metal = principled("Lantern_Cap", "#2E2940")
    bm = bmesh.new()
    add_cylinder(bm, 0.11, 0.28, center=(0, 0, 0.14), segments=8, material=0)
    add_cylinder(bm, 0.15, 0.1, center=(0, 0, 0.33), segments=8, material=1, radius_top=0.02)
    position = spot(0.6, 1.0)
    lantern = mesh_object("Lantern", bm, col, [glow, metal], location=position)
    lantern["texel_weight"] = 1.2

    light_data = bpy.data.lights.new("Lantern_Light", "POINT")
    light_data.energy = 220
    light_data.color = linear("#FFB454")[:3]
    light_data.shadow_soft_size = 0.1
    light = bpy.data.objects.new("Lantern_Light", light_data)
    light.location = (position.x, position.y, 0.2)
    night_col.objects.link(light)


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
    set_second = new_collection("Set_Second")
    day = new_collection("Lighting_Day")
    night = new_collection("Lighting_Night")
    preview = new_collection("Preview")

    build_island(set_first)
    build_tree(set_first)
    build_lantern(set_first, night)
    build_props(set_second)
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
