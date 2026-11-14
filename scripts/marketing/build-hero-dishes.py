"""Build private, bounded marketing derivatives from existing owned dish GLBs.

Run with Blender --background --factory-startup --python-exit-code 1 --python
this-file -- --source-root <ar/out> --output-dir <private-staging-directory>.
No production uploads or source modifications. Validate bytes before publication.
"""
import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector, Matrix

parser = argparse.ArgumentParser()
parser.add_argument('--source-root', required=True)
parser.add_argument('--output-dir', required=True)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
source_root = Path(args.source_root)
output = Path(args.output_dir)
output.mkdir(parents=True, exist_ok=True)
receipt = []


def aim(obj, point):
    obj.rotation_euler = (Vector(point) - obj.location).to_track_quat('-Z', 'Y').to_euler()


for slug, original, plate in [('picanha', 'premium-picanha', .30), ('burger', 'artisan-burger', .30), ('tiramisu', 'tiramisu', .21)]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    source = source_root / (original + '.glb')
    bpy.ops.import_scene.gltf(filepath=str(source))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
    points = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
    lo = Vector([min(p[i] for p in points) for i in range(3)])
    hi = Vector([max(p[i] for p in points) for i in range(3)])
    scale = plate / max(hi.x - lo.x, hi.y - lo.y)
    center = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
    for obj in meshes:
        matrix = obj.matrix_world.copy()
        obj.parent = None
        obj.matrix_world = Matrix.Identity(4)
        for vertex in obj.data.vertices:
            vertex.co = (matrix @ vertex.co - center) * scale
        obj.data.update()
        bpy.context.view_layer.objects.active = obj
        if len(obj.data.polygons) > 5000:
            decimate = obj.modifiers.new('Bounded marketing geometry', 'DECIMATE')
            decimate.ratio = .22
            bpy.ops.object.modifier_apply(modifier=decimate.name)
    for image in bpy.data.images:
        if image.type == 'IMAGE' and max(image.size) > 512:
            ratio = 512 / max(image.size)
            image.scale(max(1, round(image.size[0] * ratio)), max(1, round(image.size[1] * ratio)))
            image.pack()
    dish_root = bpy.data.objects.new('Dish turn', None)
    bpy.context.scene.collection.objects.link(dish_root)
    for obj in meshes:
        obj.parent = dish_root
    for frame, degrees in [(1, 0), (121, 25), (241, 0), (361, -15), (481, 0)]:
        dish_root.rotation_euler.z = math.radians(degrees)
        dish_root.keyframe_insert(data_path='rotation_euler', frame=frame)
    dish_root.animation_data.action.name = 'Dish turn'
    all_meshes = meshes
    scene = bpy.context.scene
    scene.render.fps = 30
    scene.frame_start, scene.frame_end = 1, 481
    scene.frame_set(1)
    scene.unit_settings.system = 'METRIC'
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.threads_mode = 'FIXED'
    scene.render.threads = 2
    scene.render.resolution_x = 960
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.world = bpy.data.worlds.new('Neutral studio')
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.7, .7, .7, 1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value = .6
    scene.view_settings.view_transform = 'AgX'
    for name, location, energy, size in [('Key', (-.4, -.5, .8), 45, .7), ('Fill', (.5, .1, .6), 18, .6)]:
        light = bpy.data.lights.new(name, 'AREA')
        light.energy, light.shape, light.size = energy, 'DISK', size
        obj = bpy.data.objects.new(name, light)
        scene.collection.objects.link(obj)
        obj.location = location
        aim(obj, (0, 0, .025))
    target = Vector((0, 0, .04))
    radius, phi = .55, math.radians(62)
    bpy.ops.object.camera_add(location=target + Vector((0, -radius * math.sin(phi), radius * math.cos(phi))))
    camera = bpy.context.object
    camera.name = 'Fixed marketing camera'
    camera.data.sensor_fit = 'VERTICAL'
    camera.data.sensor_height = 24
    camera.data.lens = 24 / (2 * math.tan(math.radians(30) / 2))
    aim(camera, target)
    scene.camera = camera
    bpy.ops.object.select_all(action='DESELECT')
    for obj in all_meshes:
        obj.select_set(True)
    dish_root.select_set(True)
    glb = output / f'dish-{slug}.glb'
    bpy.ops.export_scene.gltf(filepath=str(glb), export_format='GLB', use_selection=True,
        export_image_format='JPEG', export_jpeg_quality=78, export_cameras=False,
        export_lights=False, export_apply=True, export_draco_mesh_compression_enable=False)
    triangles = sum(sum(len(p.vertices) - 2 for p in obj.data.polygons) for obj in all_meshes)
    if glb.stat().st_size > 1536 * 1024 or triangles > 45000:
        raise RuntimeError(f'Output budget failed: {slug}, {glb.stat().st_size} B / {triangles} triangles')
    blend = output / f'dish-{slug}.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.filepath = str(output / f'dish-{slug}.png')
    bpy.ops.render.render(write_still=True)
    receipt.append(dict(slug=slug, source=str(source), source_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
        output=glb.name, bytes=glb.stat().st_size, triangles=triangles,
        sha256=hashlib.sha256(glb.read_bytes()).hexdigest(), blend=blend.name,
        camera_orbit='0deg 62deg 0.55m', camera_target='0m 0.04m 0m', field_of_view='30deg',
        animation='Dish turn: food only; stationary table is a separate photograph'))
    (output / 'build-receipt.json').write_text(json.dumps(receipt, indent=2))
    print('HERO_BUILT ' + json.dumps(receipt[-1]), flush=True)
