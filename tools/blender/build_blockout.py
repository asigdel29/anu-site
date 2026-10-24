"""Builds the blockout of anu's cherry blossom island and saves blender/island.blend.

Run from the repo root:
    /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
        --python tools/blender/build_blockout.py

Every object already has its final name (see the scene contract in the plan), so later
art can replace meshes one at a time without touching the site code.
Units are metres, Z is up, and the grass top sits at z = 0.
"""

import math
import random
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]
BLEND_PATH = ROOT / "blender" / "island.blend"
FONT_PATH = ROOT / "blender" / "fonts" / "SpaceGrotesk-Bold.ttf"

rng = random.Random(29)

# The camera looks at the island from this direction (Blender XY), so props face it.
FORWARD = Vector((math.cos(math.radians(-48)), math.sin(math.radians(-48)), 0))
RIGHT = Vector((-FORWARD.y, FORWARD.x, 0))
FACE_CAMERA = math.radians(42)
# Props are drawn larger than life so they read and click well at island scale.
PROP_SCALE = 1.5


def spot(forward, right):
    """Island position from camera-relative offsets, so the layout reads well from the start view."""
    return FORWARD * forward + RIGHT * right


def linear(hex_color):
    """Converts an sRGB hex colour to the linear RGBA that Blender sockets expect."""
    hex_color = hex_color.lstrip("#")
    srgb = [int(hex_color[i : i + 2], 16) / 255 for i in (0, 2, 4)]
    return (
        *[c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb],
        1.0,
    )


# ---------------------------------------------------------------- materials


def principled(name, color, roughness=0.9, emission=None, strength=0.0):
    """Matte material, so the bake holds no view-dependent shine."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = linear(color)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Specular IOR Level"].default_value = 0.15
    if emission:
        bsdf.inputs["Emission Color"].default_value = linear(emission)
        bsdf.inputs["Emission Strength"].default_value = strength
    return mat


def varied(name, dark, light, scale=3.0, per_object=False, leafy=False):
    """Material whose colour drifts between two shades, by object or by noise, for a hand-painted feel."""
    mat = principled(name, dark)
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = next(n for n in nodes if n.type == "BSDF_PRINCIPLED")
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = linear(dark)
    ramp.color_ramp.elements[1].color = linear(light)
    if per_object:
        info = nodes.new("ShaderNodeObjectInfo")
        links.new(info.outputs["Random"], ramp.inputs["Fac"])
    else:
        noise = nodes.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = scale
        links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    if leafy:
        voronoi = nodes.new("ShaderNodeTexVoronoi")
        voronoi.inputs["Scale"].default_value = 9.0
        bump = nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.6
        links.new(voronoi.outputs["Distance"], bump.inputs["Height"])
        links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def pixel_block(name, dark, light):
    """Chunky pixel noise in two shades (object space, so a joined bake copy keeps it): no game assets."""
    mat = principled(name, dark)
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = next(n for n in nodes if n.type == "BSDF_PRINCIPLED")
    coords = nodes.new("ShaderNodeTexCoord")
    grow = nodes.new("ShaderNodeVectorMath")
    grow.operation = "MULTIPLY"
    grow.inputs[1].default_value = (12, 12, 12)  # about 8 pixels across the 0.75 m block
    snap = nodes.new("ShaderNodeVectorMath")
    snap.operation = "FLOOR"
    noise = nodes.new("ShaderNodeTexWhiteNoise")
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = linear(dark)
    ramp.color_ramp.elements[1].color = linear(light)
    links.new(coords.outputs["Object"], grow.inputs[0])
    links.new(grow.outputs["Vector"], snap.inputs[0])
    links.new(snap.outputs["Vector"], noise.inputs["Vector"])
    links.new(noise.outputs["Value"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    return mat


def brick_wall(name):
    """Pink brick rows that wrap around each pillar, with per-brick colour drift from the Brick texture."""
    mat = principled(name, "#D24E68")
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = next(n for n in nodes if n.type == "BSDF_PRINCIPLED")
    coords = nodes.new("ShaderNodeTexCoord")
    split = nodes.new("ShaderNodeSeparateXYZ")
    around = nodes.new("ShaderNodeMath")
    around.operation = "ADD"
    wall = nodes.new("ShaderNodeCombineXYZ")
    brick = nodes.new("ShaderNodeTexBrick")
    brick.offset = 0.5
    brick.inputs["Color1"].default_value = linear("#C24260")
    brick.inputs["Color2"].default_value = linear("#E46A83")
    brick.inputs["Mortar"].default_value = linear("#8E2E48")
    brick.inputs["Scale"].default_value = 1.0
    brick.inputs["Mortar Size"].default_value = 0.03
    brick.inputs["Brick Width"].default_value = 0.94
    brick.inputs["Row Height"].default_value = 0.6
    links.new(coords.outputs["Object"], split.inputs["Vector"])
    links.new(split.outputs["X"], around.inputs[0])
    links.new(split.outputs["Y"], around.inputs[1])
    links.new(around.outputs["Value"], wall.inputs["X"])
    links.new(split.outputs["Z"], wall.inputs["Y"])
    links.new(wall.outputs["Vector"], brick.inputs["Vector"])
    links.new(brick.outputs["Color"], bsdf.inputs["Base Color"])
    return mat


def grass_with_petals(name):
    """Grass with fallen petals painted in, so the petals cost no geometry or UV space."""
    mat = varied(name, "#6DB55B", "#8FD27A", scale=2.5)
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = next(n for n in nodes if n.type == "BSDF_PRINCIPLED")
    grass_color = bsdf.inputs["Base Color"].links[0].from_socket
    cells = nodes.new("ShaderNodeTexVoronoi")
    cells.inputs["Scale"].default_value = 8.0
    near = nodes.new("ShaderNodeMath")
    near.operation = "LESS_THAN"
    near.inputs[1].default_value = 0.28
    sparse = nodes.new("ShaderNodeMath")
    sparse.operation = "GREATER_THAN"
    sparse.inputs[1].default_value = 0.7
    mask = nodes.new("ShaderNodeMath")
    mask.operation = "MULTIPLY"
    mix = nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    sockets = {s.identifier: s for s in mix.inputs}
    sockets["B_Color"].default_value = linear("#F0647E")
    links.new(cells.outputs["Distance"], near.inputs[0])
    links.new(cells.outputs["Color"], sparse.inputs[0])
    links.new(near.outputs["Value"], mask.inputs[0])
    links.new(sparse.outputs["Value"], mask.inputs[1])
    links.new(mask.outputs["Value"], sockets["Factor_Float"])
    links.new(grass_color, sockets["A_Color"])
    links.new(next(s for s in mix.outputs if s.identifier == "Result_Color"), bsdf.inputs["Base Color"])
    return mat


# ---------------------------------------------------------------- mesh helpers


def new_collection(name):
    col = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(col)
    return col


def mesh_object(name, bm, collection, materials, location=(0, 0, 0), rotation_z=0.0):
    """Turns a bmesh into a linked object with its own mesh data and material slots."""
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    for mat in materials:
        mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    obj.location = location
    obj.rotation_euler.z = rotation_z
    collection.objects.link(obj)
    return obj


def add_box(bm, size, center=(0, 0, 0), material=0, bevel=0.0):
    """Adds a box of full size (x, y, z) around center."""
    geom = bmesh.ops.create_cube(bm, size=1.0)
    verts = geom["verts"]
    bmesh.ops.scale(bm, vec=size, verts=verts)
    bmesh.ops.translate(bm, vec=center, verts=verts)
    faces = {f for v in verts for f in v.link_faces}
    for face in faces:
        face.material_index = material
    if bevel:
        edges = list({e for f in faces for e in f.edges})
        bmesh.ops.bevel(bm, geom=edges, offset=bevel, segments=1, affect="EDGES")
    return verts


def add_cylinder(bm, radius, depth, center=(0, 0, 0), segments=10, material=0, axis="Z", radius_top=None):
    """Adds a cylinder (or cone) along an axis."""
    geom = bmesh.ops.create_cone(
        bm,
        cap_ends=True,
        segments=segments,
        radius1=radius,
        radius2=radius if radius_top is None else radius_top,
        depth=depth,
    )
    verts = geom["verts"]
    if axis == "X":
        bmesh.ops.rotate(bm, verts=verts, matrix=Matrix.Rotation(math.radians(90), 3, "Y"))
    elif axis == "Y":
        bmesh.ops.rotate(bm, verts=verts, matrix=Matrix.Rotation(math.radians(90), 3, "X"))
    bmesh.ops.translate(bm, vec=center, verts=verts)
    for face in {f for v in verts for f in v.link_faces}:
        face.material_index = material
    return verts


def add_sphere(bm, radius, center=(0, 0, 0), material=0, subdivisions=2):
    geom = bmesh.ops.create_icosphere(bm, subdivisions=subdivisions, radius=radius)
    verts = geom["verts"]
    bmesh.ops.translate(bm, vec=center, verts=verts)
    for face in {f for v in verts for f in v.link_faces}:
        face.material_index = material
    return verts


def apply_modifiers(obj):
    """Bakes the modifier stack into the mesh, so UVs and the export see the final shape."""
    depsgraph = bpy.context.evaluated_depsgraph_get()
    mesh = bpy.data.meshes.new_from_object(obj.evaluated_get(depsgraph))
    obj.modifiers.clear()
    old = obj.data
    obj.data = mesh
    mesh.name = obj.name
    bpy.data.meshes.remove(old)


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


def build_clouds(col):
    cloud = principled("Cloud", "#F4F6FA", roughness=1.0)
    placements = [(10, 10.5, 2.0), (80, 11.5, -2.5), (150, 10.0, 1.0), (200, 12.0, -4.5), (250, 9.5, 3.2)]
    bm = bmesh.new()
    for angle, reach, height in placements:
        center = Vector((math.cos(math.radians(angle)) * reach, math.sin(math.radians(angle)) * reach, height))
        along = Vector((-math.sin(math.radians(angle)), math.cos(math.radians(angle)), 0))
        for _ in range(5):
            offset = center + along * rng.uniform(-1.4, 1.4) + Vector((0, 0, rng.uniform(-0.2, 0.4)))
            verts = add_sphere(bm, rng.uniform(0.8, 1.3), center=offset, subdivisions=2)
            for v in verts:
                v.co.z = max(v.co.z, offset.z - 0.35)
    for face in bm.faces:
        face.smooth = True
    clouds = mesh_object("Clouds", bm, col, [cloud])
    clouds["texel_weight"] = 0.25
    clouds.shadow_terminator_geometry_offset = 0.8


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


def build_props(col):
    """Interactive props; names follow the scene contract the site code reads."""
    clay = principled("Figure_Clay", "#D8C3A8")
    phone_body = principled("Phone_Body", "#22252E")
    phone_screen = principled("Phone_Screen_Glow", "#7FE3D2", emission="#5EEAD4", strength=4.0)
    paper = principled("Paper", "#FAF7F0")
    cover = principled("Notebook_Cover", "#3A3450")
    book = principled("Book_Cover", "#1F4E5F")
    metal = principled("Robot_Metal", "#9AA3AE", roughness=0.8)
    card = principled("Card", "#FFFFFF")
    stone = varied("Stone", "#7F8796", "#A3AAB8", per_object=True)
    dirt = pixel_block("Block_Dirt", "#7A5536", "#94693F")
    turf = pixel_block("Block_Turf", "#5FA84E", "#7CC16A")
    letter = principled("Letter", "#F7F2EA")

    # Phone leans on the trunk; the screen face is its own material so it can glow at night.
    bm = bmesh.new()
    add_box(bm, (0.26, 0.045, 0.52), center=(0, 0, 0.26), bevel=0.02)
    for face in bm.faces:
        if face.normal.y < -0.9:
            face.material_index = 1
    phone = mesh_object("Phone_Second_Raycaster_Pointer_Hover", bm, col, [phone_body, phone_screen],
                        location=spot(0.55, -0.3))
    phone.rotation_euler = (math.radians(-12), 0, FACE_CAMERA)

    # ANU letters by the roots.
    for index, (char, right) in enumerate((("A", -0.85), ("N", 0.0), ("U", 0.85)), start=1):
        curve = bpy.data.curves.new(f"Letter_{char}", "FONT")
        curve.body = char
        curve.font = bpy.data.fonts.load(str(FONT_PATH), check_existing=True)
        curve.size = 0.85
        curve.extrude = 0.07
        curve.bevel_depth = 0.01
        curve.align_x = "CENTER"
        text = bpy.data.objects.new("text_tmp", curve)
        col.objects.link(text)
        depsgraph = bpy.context.evaluated_depsgraph_get()
        mesh = bpy.data.meshes.new_from_object(text.evaluated_get(depsgraph))
        bpy.data.objects.remove(text)
        mesh.transform(Matrix.Rotation(math.radians(90), 4, "X"))
        mesh.transform(Matrix.Translation((0, 0, 0.01)))
        mesh.materials.clear()
        mesh.materials.append(letter)
        name = f"Name_Letter_{index}_Second_Raycaster_Pointer_Hover"
        mesh.name = name
        obj = bpy.data.objects.new(name, mesh)
        obj.location = spot(1.6, right)
        obj.rotation_euler.z = FACE_CAMERA
        col.objects.link(obj)

    # Lying figure (placeholder clay until the likeness pass): head toward the trunk, looking up.
    bm = bmesh.new()
    add_cylinder(bm, 0.17, 0.62, center=(-0.1, 0, 0.17), axis="X")
    add_cylinder(bm, 0.075, 0.85, center=(0.62, 0.09, 0.08), axis="X")
    add_cylinder(bm, 0.075, 0.85, center=(0.62, -0.09, 0.08), axis="X")
    add_sphere(bm, 0.14, center=(-0.6, 0, 0.17))
    add_cylinder(bm, 0.05, 0.42, center=(-0.48, 0.2, 0.12), axis="X")
    add_cylinder(bm, 0.05, 0.42, center=(-0.48, -0.2, 0.12), axis="X")
    mesh_object("Anu_Figure_Second_Raycaster_Pointer_Hover", bm, col, [clay],
                location=spot(1.1, 1.8), rotation_z=FACE_CAMERA)

    # Paper airplane, solid enough to render from both sides.
    bm = bmesh.new()
    verts = [bm.verts.new(co) for co in ((0.4, 0, 0.06), (-0.3, 0, 0.06), (-0.3, 0.26, 0.13), (-0.3, -0.26, 0.13), (-0.3, 0, -0.04))]
    for a, b, c in ((0, 1, 2), (0, 3, 1), (0, 4, 1)):
        bm.faces.new((verts[a], verts[b], verts[c]))
    bmesh.ops.translate(bm, vec=(0, 0, 0.04), verts=bm.verts)
    bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.012)
    mesh_object("Paper_Airplane_Second_Raycaster_Pointer_Hover", bm, col, [paper],
                location=spot(2.2, 1.6), rotation_z=FACE_CAMERA + math.radians(30))

    # Open notebook and the Neuromancer paperback (spine text comes with the final art).
    bm = bmesh.new()
    add_box(bm, (0.78, 0.5, 0.015), center=(0, 0, 0.0075), material=1)
    left = add_box(bm, (0.37, 0.46, 0.035), center=(-0.19, 0, 0.03))
    bmesh.ops.rotate(bm, verts=left, cent=(0, 0, 0.015), matrix=Matrix.Rotation(math.radians(7), 3, "Y"))
    right = add_box(bm, (0.37, 0.46, 0.035), center=(0.19, 0, 0.03))
    bmesh.ops.rotate(bm, verts=right, cent=(0, 0, 0.015), matrix=Matrix.Rotation(math.radians(-7), 3, "Y"))
    mesh_object("Writing_Notebook_Second_Raycaster_Pointer_Hover", bm, col, [paper, cover],
                location=spot(1.9, -1.6), rotation_z=FACE_CAMERA + math.radians(15))

    bm = bmesh.new()
    add_box(bm, (0.32, 0.48, 0.07), center=(0, 0, 0.035), bevel=0.01)
    mesh_object("Writing_Book_Second_Raycaster_Pointer_Hover", bm, col, [book],
                location=spot(1.5, -2.2), rotation_z=FACE_CAMERA - math.radians(25))

    # Robotic hand holding a playing card.
    bm = bmesh.new()
    add_cylinder(bm, 0.09, 0.25, center=(0, 0, 0.125))
    add_box(bm, (0.28, 0.1, 0.26), center=(0, 0, 0.38), bevel=0.015)
    for x in (-0.1, -0.035, 0.035, 0.1):
        add_cylinder(bm, 0.034, 0.2, center=(x, 0.0, 0.6), segments=8)
    add_cylinder(bm, 0.034, 0.18, center=(-0.19, 0.0, 0.42), segments=8, axis="X")
    add_box(bm, (0.24, 0.008, 0.34), center=(0, -0.06, 0.74), material=1)
    mesh_object("Robot_Hand_Second_Raycaster_Pointer_Hover", bm, col, [metal, card],
                location=spot(-0.3, 2.2), rotation_z=FACE_CAMERA)

    # Stepping stones toward the front corner: github, linkedin, x.
    for name, (forward, right) in (("GitHub", (3.3, 0.0)), ("LinkedIn", (2.75, -0.35)), ("X", (2.25, 0.25))):
        bm = bmesh.new()
        verts = add_cylinder(bm, 0.36, 0.1, center=(0, 0, 0.05), segments=12)
        bmesh.ops.scale(bm, vec=(1, 0.8, 1), verts=verts)
        mesh_object(f"Stone_{name}_Second_Raycaster_Pointer_Hover", bm, col, [stone],
                    location=spot(forward, right), rotation_z=rng.uniform(0, math.tau))

    # Voxel block: turf on top, dirt on the sides.
    bm = bmesh.new()
    add_box(bm, (0.5, 0.5, 0.5), center=(0, 0, 0.25))
    for face in bm.faces:
        if face.normal.z > 0.9:
            face.material_index = 1
    mesh_object("Minecraft_Block_Second_Raycaster_Pointer_Hover", bm, col, [dirt, turf],
                location=spot(-0.6, -2.1), rotation_z=math.radians(20))


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
    build_clouds(set_first)
    build_lantern(set_first, night)
    build_props(set_second)
    # Props read better a bit larger than life; scaling the mesh keeps scale (1,1,1) and the base origin.
    for obj in set_second.objects:
        obj.data.transform(Matrix.Scale(PROP_SCALE, 4))
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
