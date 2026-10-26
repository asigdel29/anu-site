"""Builds anu's floating island and saves blender/island.blend.

Run from the repo root:
    /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
        --python tools/blender/build_blockout.py

The island is a rounded grass top on a chunky floating rock, with a cherry blossom tree and the tour props
(props.py). Units are metres, Z is up, and the grass top sits at z = 0. Clouds and the city
are not baked: src/clouds.js and src/skyline.js draw them at runtime.
"""

import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector, noise

sys.path.insert(0, str(Path(__file__).parent))
from lib import (add_limb, add_sphere, apply_modifiers, bark, canopy_gradient, layered_rock, linear,  # noqa: E402
                 mesh_object, new_collection, principled, rng, varied)
from props import build_props  # noqa: E402

BLEND_PATH = Path(__file__).resolve().parents[2] / "blender" / "island.blend"


# ---------------------------------------------------------------- scene parts


def rounded_square(radius, segments=48, wobble=0.025):
    """Outline points of a soft rounded square (a superellipse) with a gentle wave on the rim."""
    points = []
    for i in range(segments):
        angle = math.tau * i / segments
        c, s = math.cos(angle), math.sin(angle)
        r = radius / (abs(c) ** 4 + abs(s) ** 4) ** 0.25 * (1 + wobble * math.sin(angle * 7 + 1.3))
        points.append((c * r, s * r))
    return points


def build_island(col):
    """The floating island: a rounded grass top on a chunky stylized rock, with roots hanging below."""
    grass = varied("Grass", "#4FB83A", "#8AD94F", scale=2.5)
    rock = layered_rock("Rock")
    root_wood = varied("Root", "#4E3221", "#6E4A31", scale=8.0)

    # Grass top: a rounded square 0.35 m thick, its rim softened by a bevel. No underside: the
    # rock fills it.
    bm = bmesh.new()
    outline = rounded_square(3.35)
    top = [bm.verts.new((x, y, 0.0)) for x, y in outline]
    low = [bm.verts.new((x * 0.97, y * 0.97, -0.35)) for x, y in outline]
    bm.faces.new(top)
    for i in range(len(outline)):
        j = (i + 1) % len(outline)
        bm.faces.new((top[i], low[i], low[j], top[j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    rim = [e for e in bm.edges if all(v in top for v in e.verts) and len(e.link_faces) == 2]
    bmesh.ops.bevel(bm, geom=rim, offset=0.08, segments=2, affect="EDGES")
    turf = mesh_object("Grass_Top", bm, col, [grass])
    turf["texel_weight"] = 1.6

    # Rock: a big upside-down cone and two smaller lumps, pushed about by noise, terraced into
    # ledges, then remeshed into one chunky faceted mass.
    bm = bmesh.new()
    for (x, y), top_radius, depth in (((0.0, 0.0), 3.3, 6.8), ((1.2, -0.9), 1.9, 4.2), ((-1.1, 1.3), 1.7, 3.6)):
        verts = bmesh.ops.create_cone(bm, cap_ends=True, segments=20, radius1=0.25, radius2=top_radius, depth=depth)["verts"]
        bmesh.ops.translate(bm, vec=(x, y, -0.25 - depth / 2), verts=verts)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=3, use_grid_fill=True)
    for v in bm.verts:
        out = Vector((v.co.x, v.co.y, 0.0))
        if out.length > 1e-6:
            ledge = 1 + 0.1 * ((-v.co.z / 0.9) % 1.0)
            push = 1 + 0.32 * noise.fractal(v.co * 0.5, 1.0, 2.0, 3)
            v.co.xy = (out * ledge * push).xy
    # Boulders half sunk into the upper rim give it chunky ledges.
    for k in range(7):
        angle = math.tau * k / 7 + rng.uniform(-0.25, 0.25)
        reach = rng.uniform(2.3, 2.9)
        add_sphere(bm, rng.uniform(0.6, 1.0), center=(math.cos(angle) * reach, math.sin(angle) * reach, rng.uniform(-1.4, -0.7)), subdivisions=1)
    rock_mass = mesh_object("Rock", bm, col, [rock])
    fuse(rock_mass, voxel=0.2, keep=0.14, smooth=False)
    rock_mass["texel_weight"] = 0.6

    # Roots hang from the rock's upper sides, curling a little as they drop.
    bm = bmesh.new()
    for k in range(8):
        angle = math.tau * k / 8 + rng.uniform(-0.3, 0.3)
        radius = rng.uniform(2.4, 2.9)
        length = rng.uniform(1.2, 2.6)
        point = Vector((math.cos(angle) * radius, math.sin(angle) * radius, -0.45))
        for step in range(5):
            nxt = point + Vector((math.cos(angle) * 0.12 + rng.uniform(-0.1, 0.1), math.sin(angle) * 0.12 + rng.uniform(-0.1, 0.1), -length / 5))
            add_limb(bm, point, nxt, 0.1 - step * 0.016, segments=6)
            point = nxt
    roots = mesh_object("Roots", bm, col, [root_wood])
    roots["texel_weight"] = 0.4


def build_grass_details(col, keep_clear):
    """Grass tufts, small flowers and pebbles on the grass top, kept clear of the trunk and the
    props (keep_clear: Blender XY points with a clear radius each)."""
    tuft = varied("Tuft", "#3E9E2E", "#9BE35A", scale=6.0)
    stem = principled("Stem", "#3E9E2E")
    petals = [principled(f"Flower_{n}", c) for n, c in (("Pink", "#FF6FA8"), ("Yellow", "#FFD23F"), ("White", "#FFF6E8"))]
    pebble = varied("Pebble", "#8C8A93", "#B7B4BC", scale=4.0)

    def free_spot(margin):
        while True:
            x, y = rng.uniform(-2.9, 2.9), rng.uniform(-2.9, 2.9)
            if abs(x) ** 4 + abs(y) ** 4 > 3.0 ** 4:
                continue
            if all(math.hypot(x - cx, y - cy) > r + margin for cx, cy, r in keep_clear):
                return x, y

    bm = bmesh.new()
    for _ in range(46):
        x, y = free_spot(0.1)
        for blade in range(4):
            lean = Vector((rng.uniform(-0.12, 0.12), rng.uniform(-0.12, 0.12), rng.uniform(0.18, 0.32)))
            base = Vector((x + rng.uniform(-0.06, 0.06), y + rng.uniform(-0.06, 0.06), -0.01))
            verts = bmesh.ops.create_cone(bm, cap_ends=False, segments=4, radius1=0.035, radius2=0.0, depth=lean.length)["verts"]
            bmesh.ops.rotate(bm, verts=verts, matrix=Vector((0, 0, 1)).rotation_difference(lean).to_matrix())
            bmesh.ops.translate(bm, vec=base + lean / 2, verts=verts)
    for _ in range(16):
        x, y = free_spot(0.15)
        height = rng.uniform(0.14, 0.24)
        add_limb(bm, (x, y, 0.0), (x, y, height), 0.012, material=1, segments=4)
        add_sphere(bm, rng.uniform(0.045, 0.06), center=(x, y, height + 0.02), material=2 + rng.randrange(3), subdivisions=1)
    for _ in range(9):
        x, y = free_spot(0.15)
        verts = add_sphere(bm, rng.uniform(0.06, 0.12), center=(x, y, 0.0), material=5, subdivisions=1)
        for v in verts:
            v.co.z = max(v.co.z * 0.6, -0.02)
    details = mesh_object("Grass_Details", bm, col, [tuft, stem, *petals, pebble])
    details["texel_weight"] = 0.5


def fuse(obj, voxel, keep, smooth=True):
    """Remeshes overlapping parts into one closed surface, then thins it to about keep of its
    triangles. The bake would otherwise light the faces buried inside other parts, and any of
    those that show come out dark. smooth=False keeps flat facets, for chunky rock.
    """
    remesh = obj.modifiers.new("Remesh", "REMESH")
    remesh.mode = "VOXEL"
    remesh.voxel_size = voxel
    remesh.use_smooth_shade = smooth
    obj.modifiers.new("Decimate", "DECIMATE").ratio = keep
    apply_modifiers(obj)


def build_tree(col):
    """The cherry blossom tree: a skin-modifier trunk and a dome of lumpy blossom clumps."""
    trunk_bark = bark("Bark", "#5E3B26", "#9A6640")
    blossom = canopy_gradient("Blossom", "#D42F78", "#FF9CC8", 3.6, 6.8)

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
    trunk.modifiers.new("Subsurf", "SUBSURF").levels = 1
    fuse(trunk, voxel=0.04, keep=0.35)
    trunk.data.materials.append(trunk_bark)

    # Canopy in a stylized game look: a few big lobes, each a cluster of puffs, fused into one
    # mass with flat facets. Deeper pink low and inside, light pink on top (the bake adds the light).
    bm = bmesh.new()
    lobes = [(0.0, 0.0, 5.9, 1.5), (0.3, -0.6, 5.0, 1.3)] + [
        (math.cos(a) * r, math.sin(a) * r, 4.6 + rng.uniform(-0.3, 0.6), rng.uniform(1.05, 1.35))
        for a, r in ((math.tau * k / 9 + rng.uniform(-0.15, 0.15), rng.uniform(2.4, 3.4)) for k in range(9))
    ]
    for x, y, z, size in lobes:
        for _ in range(5):
            offset = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-0.3, 0.9))) * size * 0.55
            verts = add_sphere(bm, size * rng.uniform(0.42, 0.6), subdivisions=2)
            for v in verts:
                v.co.z *= 0.8
            bmesh.ops.translate(bm, vec=Vector((x, y, z)) + offset, verts=verts)
    canopy = mesh_object("Canopy", bm, col, [blossom])
    fuse(canopy, voxel=0.08, keep=0.18, smooth=False)
    # Light goes into vertex colours, not the atlas: its many small UV islands showed seams there.
    canopy["vertex_bake"] = True


def build_lighting(day_col, night_col, preview_col):
    def sun(name, color, strength, tilt, heading, col):
        data = bpy.data.lights.new(name, "SUN")
        data.color = linear(color)[:3]
        data.energy = strength
        data.angle = math.radians(8)
        obj = bpy.data.objects.new(name, data)
        obj.rotation_euler = (math.radians(tilt), 0, math.radians(heading))
        col.objects.link(obj)

    # A warm, strong sun and a cool blue sky fill: warm lit sides, cool shadows, a game look.
    sun("Sun", "#FFE2B8", 4.6, 48, 98, day_col)
    sun("Moon", "#B8C4FF", 1.8, 35, 248, night_col)

    for mode, color, strength in (("day", "#BFD6FF", 1.25), ("night", "#2A2658", 1.2)):
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
    anchors = new_collection("Anchors")
    day = new_collection("Lighting_Day")
    night = new_collection("Lighting_Night")
    preview = new_collection("Preview")

    build_island(set_first)
    build_tree(set_first)
    build_props(set_first, anchors)
    # Clear of the trunk and of each prop.
    keep_clear = [(0.0, 0.0, 0.9)] + [(a.location.x, a.location.y, 0.6) for a in anchors.objects]
    build_grass_details(set_first, keep_clear)
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
