"""
Prepares a generated dish model (e.g. from Hyper3D Rodin) for the menu's AR
viewer, headless in Blender, keeping a .blend in the middle so anything can be
fixed by hand in Blender before the final export.

  # 1. raw model -> editable .blend (+ files and a preview)
  blender -b --factory-startup --python scripts/ar/prepare-dish-model.py -- \
      --in raw.glb --save-blend dish.blend \
      (--width-cm 22 | --height-cm 19) [--plate-cm 28] \
      [--out-glb dish.glb] [--out-usdz dish.usdz] [--preview preview.png]

  # 2. after editing dish.blend in Blender (or through the Blender MCP):
  blender -b --factory-startup --python scripts/ar/prepare-dish-model.py -- \
      --from-blend dish.blend --out-glb dish.glb --out-usdz dish.usdz [--preview preview.png] \
      [--fit-width-cm 34 | --fit-height-cm 19] [--save-blend dish.blend]

  --fit-width-cm / --fit-height-cm resize the whole dish (plate included) about
  its bottom centre so its largest horizontal side / height is that size,
  keeping every manual edit. Usually driven by scripts/ar/publish-dish.mjs from
  the sizes in scripts/ar/dishes/<tenant>.json.

Step 1 (see docs/product/augmented-reality.md, "Model guidelines"):
  * keeps only mesh objects and applies their transforms;
  * scales the food to its real size: --width-cm is its largest horizontal
    side, --height-cm its height (useful for glasses);
  * puts the origin at the bottom centre, so the dish sits on the table;
  * --plate-cm adds a round dark stoneware plate of that diameter under the
    food (image-to-3D tools often drop a dark plate from the photo);
  * --bowl-cm (+ --bowl-height-cm) draws a stoneware bowl instead and sets the
    food in it, its top just under the rim, pulled inside the walls;
  * decimates above --max-tris triangles, shrinks textures above --max-texture.
Step 2 exports the scene as it is (only the size limits are enforced again).

Exports: a GLB for Android (no Draco/meshopt, JPEG textures, Y-up) and a USDZ
for iPhone AR Quick Look (metres, Y-up, 1024 px textures). The real size is
baked into the files, so the dish's product_ar_models row uses scale 1.
Prints one JSON line (PREPARED ...) with the measured size, triangles and bytes.
"""
import argparse
import json
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

PLATE_NAME = 'plate'


def parse_args():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    parser = argparse.ArgumentParser()
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument('--in', dest='src')
    source.add_argument('--from-blend')
    parser.add_argument('--save-blend')
    parser.add_argument('--out-glb')
    parser.add_argument('--out-usdz')
    parser.add_argument('--width-cm', type=float)
    parser.add_argument('--height-cm', type=float)
    parser.add_argument('--plate-cm', type=float)
    # A drawn bowl instead of a plate (Rodin drops bowls too): rim diameter and
    # outside height. The food is placed with its top just under the rim.
    parser.add_argument('--bowl-cm', type=float)
    parser.add_argument('--bowl-height-cm', type=float, default=8.0)
    parser.add_argument('--fit-width-cm', type=float)
    parser.add_argument('--fit-height-cm', type=float)
    parser.add_argument('--replace-plate', action='store_true')
    # dark: Aurora's near-black glossy glaze. cream: Bella Vista's speckled cream
    # stoneware with a brown rim, matching its menu photos.
    parser.add_argument('--plate-glaze', choices=sorted(GLAZES), default='dark')
    parser.add_argument('--food-contrast', type=float)    # e.g. 1.15; from the original texture each time
    parser.add_argument('--food-saturation', type=float)  # e.g. 1.10
    parser.add_argument('--food-sharpen', type=float)     # unsharp-mask amount, e.g. 0.8 (0 = off)
    parser.add_argument('--max-tris', type=int, default=90000)
    parser.add_argument('--max-texture', type=int, default=2048)
    parser.add_argument('--preview')
    args = parser.parse_args(argv)
    if args.src and bool(args.width_cm) == bool(args.height_cm):
        parser.error('--in needs exactly one of --width-cm or --height-cm')
    if args.fit_width_cm and args.fit_height_cm:
        parser.error('use only one of --fit-width-cm or --fit-height-cm')
    if (args.fit_width_cm or args.fit_height_cm) and not args.from_blend:
        parser.error('--fit-* resizes an existing .blend: use it with --from-blend')
    if args.plate_cm and args.bowl_cm:
        parser.error('use only one of --plate-cm or --bowl-cm')
    return args


def fit_to_size(args):
    """Scales every mesh about the bottom centre (the origin) to the requested size."""
    meshes = mesh_objects()
    lo, hi = world_bounds(meshes)
    size = hi - lo
    factor = (args.fit_width_cm / 100.0) / max(size.x, size.y) if args.fit_width_cm else (args.fit_height_cm / 100.0) / size.z
    if abs(factor - 1) < 1e-4:
        return
    for obj in meshes:
        obj.matrix_world = obj.matrix_world.copy()
        obj.location = obj.location * factor
        obj.scale = obj.scale * factor
    bpy.ops.object.select_all(action='DESELECT')
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)


def mesh_objects():
    return [obj for obj in bpy.data.objects if obj.type == 'MESH']


def world_bounds(objects):
    points = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    lo = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
    hi = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
    return lo, hi


def triangle_count(objects):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    total = 0
    for obj in objects:
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        mesh.calc_loop_triangles()
        total += len(mesh.loop_triangles)
        evaluated.to_mesh_clear()
    return total


def import_and_normalise(args):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=args.src)
    for obj in list(bpy.data.objects):
        if obj.type != 'MESH':
            for child in obj.children:  # keep the meshes' world placement
                matrix = child.matrix_world.copy()
                child.parent = None
                child.matrix_world = matrix
            bpy.data.objects.remove(obj, do_unlink=True)
    food = mesh_objects()
    if not food:
        raise SystemExit('no mesh in ' + args.src)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in food:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = food[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    lo, hi = world_bounds(food)
    size = hi - lo
    factor = (args.width_cm / 100.0) / max(size.x, size.y) if args.width_cm else (args.height_cm / 100.0) / size.z
    centre = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
    if args.bowl_cm:
        place_in_bowl(food, centre, factor, size, args.bowl_cm / 100.0, args.bowl_height_cm / 100.0, args.plate_glaze)
        return
    lift = add_plate(args.plate_cm / 100.0, args.plate_glaze) if args.plate_cm else 0.0
    for obj in food:
        for vertex in obj.data.vertices:
            vertex.co = (vertex.co - centre) * factor + Vector((0, 0, lift))
        obj.data.update()


PLATE_BASE_TOP = 0.008  # height of the plate's flat centre, where the food rests


def smoothstep(edge0, edge1, x):
    t = min(1.0, max(0.0, (x - edge0) / (edge1 - edge0)))
    return t * t * (3 - 2 * t)


def plate_profile(radius):
    """(r, z) from the centre out along the top, round the lip, back along the underside."""
    base_top, thickness = PLATE_BASE_TOP, 0.0045
    rim_top = base_top + max(0.010, radius * 0.10)
    well, lip = radius * 0.66, radius - thickness / 2  # the rounded lip ends exactly at the radius
    top = [(0.0, base_top), (well * 0.5, base_top), (well, base_top)]
    for i in range(1, 13):  # the plate's wall: a soft S-curve up to the rim
        r = well + (lip - well) * i / 12
        top.append((r, base_top + (rim_top - base_top) * smoothstep(well, lip, r)))
    lip_radius = thickness / 2
    centre = (lip, rim_top - lip_radius)
    lip_arc = [(centre[0] + lip_radius * math.sin(a), centre[1] + lip_radius * math.cos(a))
               for a in [math.radians(d) for d in range(30, 181, 30)]]
    under = []
    for i in range(12, 0, -1):  # underside follows the wall, one thickness below
        r = well + (lip - well) * i / 12
        under.append((r - thickness * 0.3, base_top - thickness + (rim_top - base_top) * smoothstep(well, lip, r)))
    foot_out, foot_in = radius * 0.50, radius * 0.44
    under += [(well, base_top - thickness), (foot_out + 0.002, 0.0022), (foot_out, 0.0), (foot_in, 0.0),
              (foot_in - 0.0015, 0.0022), (0.0, 0.0025)]
    return top + lip_arc + under


GLAZES = {
    # Linear RGB. dark/light are the mottled glaze, edge the lip where it thins,
    # speck the clay flecks with their density (share of pixels), rough the base gloss.
    'dark': {'dark': (0.010, 0.010, 0.011), 'light': (0.022, 0.021, 0.021), 'edge': (0.060, 0.056, 0.052),
             'speck': (0.20, 0.19, 0.17), 'speck_share': 0.0015, 'rough': 0.20},
    'cream': {'dark': (0.62, 0.56, 0.47), 'light': (0.74, 0.69, 0.60), 'edge': (0.30, 0.20, 0.12),
              'speck': (0.16, 0.10, 0.06), 'speck_share': 0.012, 'rough': 0.32},
}


def plate_textures(glaze='dark', size=1024, seed=7):
    """Speckled stoneware glaze (GLAZES) with a thinner lip, as base-colour and roughness images."""
    spec = GLAZES[glaze]
    import numpy as np
    rng = np.random.default_rng(seed)

    def noise(cells):
        grid = rng.random((cells + 1, cells + 1))
        axis = np.linspace(0, cells, size)
        rows = np.array([np.interp(axis, np.arange(cells + 1), row) for row in grid])
        return np.array([np.interp(axis, np.arange(cells + 1), col) for col in rows.T]).T

    mottle = 0.5 * noise(6) + 0.3 * noise(18) + 0.2 * noise(60)
    yy, xx = np.mgrid[0:size, 0:size]
    r = np.hypot(xx - (size - 1) / 2, yy - (size - 1) / 2) / (size / 2)  # 1 at the plate's edge
    # Only the very lip shows the glaze thinning: a slightly lighter charcoal,
    # never brown (a wide bronze band read as burnt on the phone).
    lip = np.clip((r - 0.955) / 0.04, 0, 1)
    lip = lip * lip * (3 - 2 * lip) * (0.7 + 0.3 * noise(40))
    dark = np.array(spec['dark'])
    light = np.array(spec['light'])
    edge = np.array(spec['edge'])
    colour = dark + (light - dark) * mottle[..., None]
    colour = colour + (edge - colour) * lip[..., None]
    specks = rng.random((size, size))
    colour[specks > 1 - spec['speck_share']] = spec['speck']   # flecks in the clay
    rough = spec['rough'] + 0.10 * noise(24) + 0.20 * lip   # glossy glaze: highlights give depth

    def image(name, rgb, non_colour):
        img = bpy.data.images.new(name, size, size, alpha=False, float_buffer=False)
        if non_colour:
            img.colorspace_settings.name = 'Non-Color'
        else:
            rgb = np.where(rgb <= 0.0031308, rgb * 12.92, 1.055 * np.power(rgb, 1 / 2.4) - 0.055)  # linear -> sRGB
        rgba = np.dstack([rgb, np.ones((size, size))]).astype(np.float32)
        img.pixels.foreach_set(rgba.ravel())
        img.pack()
        return img

    return image('plate_basecolor', colour, False), image('plate_roughness', np.dstack([rough] * 3), True)


def add_plate(diameter, glaze='dark'):
    """A round stoneware plate (lathed profile, foot ring, speckled glaze); returns the food's resting height."""
    lathe_stoneware(plate_profile(diameter / 2), diameter, glaze)
    return PLATE_BASE_TOP - 0.002  # food bottoms are uneven: sink them 2 mm into the plate


BOWL_THICKNESS = 0.005
BOWL_BASE_IN = 0.010  # height of the bowl's inside bottom


def bowl_wall(radius, height, s):
    """Outside wall at s in [0, 1], from the foot (s=0) up to the rim (s=1): (r, z)."""
    foot = radius * 0.42
    return foot + (radius - foot) * math.sin(s * math.pi / 2), height * s ** 1.35


def bowl_profile(radius, height):
    """(r, z) from the inside centre up the inside wall, round the lip, down the outside, under the foot."""
    t = BOWL_THICKNESS
    steps = 20
    inside = [(0.0, BOWL_BASE_IN)]
    for i in range(steps + 1):
        r, z = bowl_wall(radius, height, i / steps)
        inside.append((max(0.004, r - t), max(BOWL_BASE_IN, min(height, z + t * 0.6))))
    centre = (radius - t / 2, height)
    lip = [(centre[0] + t / 2 * math.cos(a), centre[1] + t / 2 * math.sin(a)) for a in [math.radians(d) for d in range(150, -1, -30)]]
    outside = [bowl_wall(radius, height, i / steps) for i in range(steps, -1, -1)]
    foot = radius * 0.42
    under = [(foot - 0.004, 0.0), (foot - 0.0055, 0.002), (0.0, 0.0025)]
    return inside + lip + outside + under


def inner_radius_at(radius, height, z):
    """The bowl's inside radius at height z (the inside wall rises monotonically)."""
    t = BOWL_THICKNESS
    zs, rs = [], []
    for i in range(41):
        r, zz = bowl_wall(radius, height, i / 40)
        zs.append(max(BOWL_BASE_IN, zz + t * 0.6))
        rs.append(r - t)
    if z <= zs[0]:
        return rs[0]
    for i in range(1, len(zs)):
        if z <= zs[i]:
            f = (z - zs[i - 1]) / max(1e-9, zs[i] - zs[i - 1])
            return rs[i - 1] + (rs[i] - rs[i - 1]) * f
    return rs[-1]


def place_in_bowl(food, centre, factor, size, diameter, height, glaze):
    """Draws a bowl and sets the food in it: food top just under the rim, nothing through the walls."""
    radius = diameter / 2
    lathe_stoneware(bowl_profile(radius, height), diameter, glaze, arc_uv=True)
    top = height - 0.008
    food_height = size.z * factor
    room = top - (BOWL_BASE_IN + 0.002)
    z_factor = factor * min(1.0, room / food_height) if food_height > 0 else factor
    bottom = top - size.z * z_factor
    for obj in food:
        for vertex in obj.data.vertices:
            x = (vertex.co.x - centre.x) * factor
            y = (vertex.co.y - centre.y) * factor
            z = bottom + (vertex.co.z - centre.z) * z_factor
            limit = inner_radius_at(radius, height, z) - 0.001
            r = math.hypot(x, y)
            if r > limit > 0:  # pull food that would show through the wall back inside
                x, y = x * limit / r, y * limit / r
            vertex.co = Vector((x, y, z))
        obj.data.update()


def arc_texture_radii(profile):
    """Texture radius per profile point for tall shapes (bowls): the glaze circle is laid
    along the surface, centre (0) up the inside to the lip (0.97), then back to 0.52
    down the outside, so walls are not smeared the way a top-down projection smears them."""
    lengths = [0.0]
    for (r0, z0), (r1, z1) in zip(profile, profile[1:]):
        lengths.append(lengths[-1] + math.hypot(r1 - r0, z1 - z0))
    lip = max(range(len(profile)), key=lambda i: profile[i][1])
    end = lengths[-1]
    return [0.97 * lengths[i] / lengths[lip] if i <= lip else 0.97 - 0.45 * (lengths[i] - lengths[lip]) / (end - lengths[lip])
            for i in range(len(profile))]


def lathe_stoneware(profile, diameter, glaze='dark', arc_uv=False):
    """Spins a (r, z) profile into a speckled stoneware object named PLATE_NAME (the food grade skips it)."""
    mesh = bpy.data.meshes.new(PLATE_NAME)
    bm = bmesh.new()
    verts = [bm.verts.new((r, 0.0, z)) for r, z in profile]
    edges = [bm.edges.new((verts[i], verts[i + 1])) for i in range(len(verts) - 1)]
    bmesh.ops.spin(bm, geom=verts + edges, cent=(0, 0, 0), axis=(0, 0, 1), angle=math.radians(360), steps=128)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    uv = bm.loops.layers.uv.new('UVMap')
    radii = arc_texture_radii(profile) if arc_uv else None
    bm.verts.index_update()
    tex = {}
    for vert in bm.verts:
        x, y, z = vert.co
        if radii is None:  # top-down projection: the texture's circle is the plate
            tex[vert.index] = (x / diameter + 0.5, y / diameter + 0.5)
            continue
        r = math.hypot(x, y)
        nearest = min(range(len(profile)), key=lambda i: (profile[i][0] - r) ** 2 + (profile[i][1] - z) ** 2)
        k = radii[nearest] / 2 / r if r > 1e-6 else 0.0
        tex[vert.index] = (0.5 + x * k, 0.5 + y * k)
    for face in bm.faces:
        for loop in face.loops:
            loop[uv].uv = tex[loop.vert.index]
    bm.to_mesh(mesh)
    bm.free()
    mesh.shade_smooth()
    plate = bpy.data.objects.new(PLATE_NAME, mesh)
    bpy.context.scene.collection.objects.link(plate)

    base_image, rough_image = plate_textures(glaze)
    material = bpy.data.materials.new('stoneware')
    material.use_nodes = True
    nodes, links = material.node_tree.nodes, material.node_tree.links
    shader = nodes['Principled BSDF']
    shader.inputs['Metallic'].default_value = 0.0
    base = nodes.new('ShaderNodeTexImage')
    base.image = base_image
    rough = nodes.new('ShaderNodeTexImage')
    rough.image = rough_image
    links.new(base.outputs['Color'], shader.inputs['Base Color'])
    links.new(rough.outputs['Color'], shader.inputs['Roughness'])
    mesh.materials.append(material)
    return plate


def box_blur(channels, radius):
    """Separable box blur (H x W x C) with edge padding."""
    import numpy as np
    size = 2 * radius + 1
    for axis in (0, 1):
        pad = [(0, 0)] * channels.ndim
        pad[axis] = (radius + 1, radius)
        summed = np.cumsum(np.pad(channels, pad, mode='edge'), axis=axis, dtype=np.float64)
        upper = np.take(summed, range(size, summed.shape[axis]), axis=axis)
        lower = np.take(summed, range(0, summed.shape[axis] - size), axis=axis)
        channels = ((upper - lower) / size).astype(np.float32)
    return channels


def grade_food(contrast=None, saturation=None, sharpen=None):
    """Sharpen (unsharp mask), contrast and saturation on the food's base-colour textures, always
    from the untouched original (kept in the .blend as '<image>__orig'), so running it again does
    not compound. A setting left out keeps the value of the last grade."""
    import numpy as np
    images = set()
    for obj in mesh_objects():
        if obj.name.startswith((PLATE_NAME, 'board')):  # only the food, never the plate or board
            continue
        for slot in obj.material_slots:
            if not slot.material or not slot.material.use_nodes:
                continue
            for node in slot.material.node_tree.nodes:
                # Lit (Principled 'Base Color') or unlit scans (Emission 'Color').
                if node.type == 'TEX_IMAGE' and node.image and not node.image.name.endswith('__orig') and any(
                        link.to_socket.name == 'Base Color'
                        or (link.to_node.type == 'EMISSION' and link.to_socket.name == 'Color')
                        for link in node.outputs['Color'].links):
                    images.add(node.image)
    for image in images:
        original = bpy.data.images.get(image.name + '__orig')
        if original is None:
            original = image.copy()
            original.name = image.name + '__orig'
            original.use_fake_user = True
        last = dict(image.get('grade_params', {}))
        c = contrast if contrast is not None else last.get('contrast', 1.0)
        s = saturation if saturation is not None else last.get('saturation', 1.0)
        k = sharpen if sharpen is not None else last.get('sharpen', 0.0)
        width, height = original.size
        pixels = np.empty(width * height * 4, dtype=np.float32)
        original.pixels.foreach_get(pixels)
        rgba = pixels.reshape(height, width, 4)
        rgb = rgba[..., :3]
        if k > 0:  # unsharp mask, ~2 px radius at 2048 px (two box passes approximate a gaussian)
            blurred = box_blur(box_blur(rgb, 1), 1)
            rgb = rgb + (rgb - blurred) * k
        rgb = (rgb - 0.5) * c + 0.5
        luma = (rgb @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32))[..., None]
        rgba[..., :3] = np.clip(luma + (rgb - luma) * s, 0, 1)
        image.scale(width, height)
        image.pixels.foreach_set(rgba.ravel())
        image.pack()
        image['grade_params'] = {'contrast': c, 'saturation': s, 'sharpen': k}
        image['grade'] = f'contrast {c}, saturation {s}, sharpen {k}'


def replace_plate(glaze='dark'):
    """Swaps the plate of an existing .blend for the current design, at the same diameter."""
    old = [obj for obj in mesh_objects() if obj.name.startswith(PLATE_NAME)]
    if not old:
        raise SystemExit('--replace-plate: this .blend has no plate object')
    lo, hi = world_bounds(old)
    diameter = max(hi.x - lo.x, hi.y - lo.y)
    for obj in old:
        mesh = obj.data
        bpy.data.objects.remove(obj, do_unlink=True)
        if mesh.users == 0:
            bpy.data.meshes.remove(mesh)
    for material in [m for m in bpy.data.materials if m.users == 0]:
        bpy.data.materials.remove(material)
    add_plate(diameter, glaze)


def enforce_limits(args):
    meshes = mesh_objects()
    tris = triangle_count(meshes)
    if tris > args.max_tris:
        ratio = args.max_tris / tris
        for obj in meshes:
            if obj.name.startswith(PLATE_NAME):
                continue
            modifier = obj.modifiers.new('decimate', 'DECIMATE')
            modifier.ratio = ratio
            bpy.context.view_layer.objects.active = obj
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        tris = triangle_count(meshes)
    for image in bpy.data.images:
        width, height = image.size
        if max(width, height) > args.max_texture:
            scale = args.max_texture / max(width, height)
            image.scale(max(1, round(width * scale)), max(1, round(height * scale)))
    return tris


def export(args):
    if args.out_glb:
        # JPEG drops alpha: keep PNG when a texture drives a material's alpha (drinks).
        alpha_textures = any(
            m.use_nodes and any(link.to_socket.name == 'Alpha' and link.from_node.type == 'TEX_IMAGE'
                                for link in m.node_tree.links)
            for m in bpy.data.materials if m.users)
        bpy.ops.export_scene.gltf(
            filepath=args.out_glb, export_format='GLB', use_selection=False, export_yup=True,
            export_apply=True, export_image_format='AUTO' if alpha_textures else 'JPEG', export_jpeg_quality=85,
            export_draco_mesh_compression_enable=False, export_animations=False,
            export_cameras=False, export_lights=False,
        )
    if args.out_usdz:
        bpy.ops.wm.usd_export(
            filepath=args.out_usdz, selected_objects_only=False, export_materials=True,
            export_textures_mode='NEW', generate_preview_surface=True, export_animation=False,
            export_lights=False, export_cameras=False, convert_world_material=False,
            convert_orientation=True, export_global_forward_selection='NEGATIVE_Z',
            export_global_up_selection='Y', convert_scene_units='METERS',
            # Quick Look downloads the whole file before showing anything; 1024 px
            # textures match the back office's own USDZ export.
            usdz_downscale_size='1024',
        )


def render_preview(path, size):
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x = scene.render.resolution_y = 768
    world = scene.world or bpy.data.worlds.new('preview')
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (0.9, 0.9, 0.9, 1)
    sun = bpy.data.objects.new('preview-sun', bpy.data.lights.new('preview-sun', 'SUN'))
    sun.data.energy = 3.0
    sun.rotation_euler = (math.radians(45), 0, math.radians(30))
    scene.collection.objects.link(sun)
    camera = bpy.data.objects.new('preview-camera', bpy.data.cameras.new('preview-camera'))
    scene.collection.objects.link(camera)
    scene.camera = camera
    target = Vector((0, 0, size.z / 3))
    camera.location = target + Vector((0, -1.0, 0.8)).normalized() * max(size.x, size.y, size.z) * 1.9
    camera.rotation_euler = (target - camera.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def main():
    args = parse_args()
    if args.from_blend:
        bpy.ops.wm.open_mainfile(filepath=args.from_blend)
        for obj in list(bpy.data.objects):  # cameras/lights of earlier previews
            if obj.type in ('CAMERA', 'LIGHT'):
                bpy.data.objects.remove(obj, do_unlink=True)
        if args.replace_plate:
            replace_plate(args.plate_glaze)
        if args.food_contrast or args.food_saturation or args.food_sharpen is not None:
            grade_food(args.food_contrast, args.food_saturation, args.food_sharpen)
        if args.fit_width_cm or args.fit_height_cm:
            fit_to_size(args)
    else:
        import_and_normalise(args)
    tris = enforce_limits(args)
    if args.save_blend:
        bpy.ops.file.pack_all()  # the .blend carries its textures
        bpy.ops.wm.save_as_mainfile(filepath=args.save_blend, compress=True)
    export(args)
    lo, hi = world_bounds(mesh_objects())
    size = hi - lo
    if args.preview:
        render_preview(args.preview, size)
    print('PREPARED ' + json.dumps({
        'width_cm': round(max(size.x, size.y) * 100, 1), 'depth_cm': round(min(size.x, size.y) * 100, 1),
        'height_cm': round(size.z * 100, 1), 'triangles': tris,
        'glb_bytes': os.path.getsize(args.out_glb) if args.out_glb else None,
        'usdz_bytes': os.path.getsize(args.out_usdz) if args.out_usdz else None,
    }))


if __name__ == '__main__':
    main()
