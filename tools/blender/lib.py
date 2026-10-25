"""Shared helpers for the island Blender scripts: layout, colours, materials and bmesh shapes.

Imported by build_blockout.py and props.py; not run on its own.
"""

import math
import random

import bmesh
import bpy
from mathutils import Matrix, Vector

rng = random.Random(29)

# The camera looks at the island from this direction (Blender XY), so props face it.
FORWARD = Vector((math.cos(math.radians(-48)), math.sin(math.radians(-48)), 0))
RIGHT = Vector((-FORWARD.y, FORWARD.x, 0))
FACE_CAMERA = math.radians(42)


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
