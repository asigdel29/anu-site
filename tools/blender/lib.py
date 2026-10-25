"""Shared helpers for the island Blender scripts: colours, materials and bmesh shapes.

Imported by build_blockout.py and props.py; not run on its own.
"""

import math
import random

import bmesh
import bpy
from mathutils import Matrix, Vector

rng = random.Random(29)


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
    """Matte material, so the bake holds no view-dependent shine. Emission glows in the bake."""
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


def varied(name, dark, light, scale=3.0):
    """Material whose colour drifts between two shades by noise, for a hand-painted feel."""
    mat = principled(name, dark)
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = next(n for n in nodes if n.type == "BSDF_PRINCIPLED")
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = linear(dark)
    ramp.color_ramp.elements[1].color = linear(light)
    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = scale
    links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    return mat


def strata(name, dark, light, layer=0.32):
    """Clay cliff in flat horizontal layers of two shades, like stacked toy terraces.

    Object-space height, so the joined bake copy keeps the same layers.
    """
    mat = principled(name, dark)
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = next(n for n in nodes if n.type == "BSDF_PRINCIPLED")
    coords = nodes.new("ShaderNodeTexCoord")
    split = nodes.new("ShaderNodeSeparateXYZ")
    rows = nodes.new("ShaderNodeMath")
    rows.operation = "DIVIDE"
    rows.inputs[1].default_value = layer
    snap = nodes.new("ShaderNodeMath")
    snap.operation = "FLOOR"
    noise = nodes.new("ShaderNodeTexWhiteNoise")
    noise.noise_dimensions = "1D"
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = linear(dark)
    ramp.color_ramp.elements[1].color = linear(light)
    links.new(coords.outputs["Object"], split.inputs["Vector"])
    links.new(split.outputs["Z"], rows.inputs[0])
    links.new(rows.outputs["Value"], snap.inputs[0])
    links.new(snap.outputs["Value"], noise.inputs["W"])
    links.new(noise.outputs["Value"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    return mat


# ---------------------------------------------------------------- mesh helpers


def new_collection(name):
    col = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(col)
    return col


def mesh_object(name, bm, collection, materials):
    """Turns a bmesh into a linked object with its own mesh data and material slots."""
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    for mat in materials:
        mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
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


def add_cylinder(bm, radius, depth, center=(0, 0, 0), segments=10, material=0, axis="Z"):
    """Adds a capped cylinder along an axis."""
    geom = bmesh.ops.create_cone(bm, cap_ends=True, segments=segments, radius1=radius, radius2=radius, depth=depth)
    verts = geom["verts"]
    if axis == "X":
        bmesh.ops.rotate(bm, verts=verts, matrix=Matrix.Rotation(math.radians(90), 3, "Y"))
    elif axis == "Y":
        bmesh.ops.rotate(bm, verts=verts, matrix=Matrix.Rotation(math.radians(90), 3, "X"))
    bmesh.ops.translate(bm, vec=center, verts=verts)
    for face in {f for v in verts for f in v.link_faces}:
        face.material_index = material
    return verts


def add_limb(bm, start, end, radius, material=0, segments=8):
    """Adds a round-ended stick from start to end, for the stick figure's body and limbs."""
    start, end = Vector(start), Vector(end)
    axis = end - start
    geom = bmesh.ops.create_cone(bm, cap_ends=True, segments=segments, radius1=radius, radius2=radius, depth=axis.length)
    verts = geom["verts"]
    bmesh.ops.rotate(bm, verts=verts, matrix=Vector((0, 0, 1)).rotation_difference(axis).to_matrix())
    bmesh.ops.translate(bm, vec=(start + end) / 2, verts=verts)
    for point in (start, end):
        add_sphere(bm, radius, center=point, material=material, subdivisions=1)
    for face in {f for v in verts for f in v.link_faces}:
        face.material_index = material
    return verts


def add_sphere(bm, radius, center=(0, 0, 0), material=0, subdivisions=2):
    """Adds an icosphere; subdivisions trade smoothness for triangles."""
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
