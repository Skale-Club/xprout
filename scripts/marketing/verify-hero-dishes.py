"""Reopen saved marketing derivatives without modifying them."""
import argparse
import json
import sys
from pathlib import Path
import bpy

parser = argparse.ArgumentParser()
parser.add_argument('--directory', required=True)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
directory = Path(args.directory)
results = []
for slug in ['picanha', 'burger', 'tiramisu']:
    file = directory / f'dish-{slug}.blend'
    bpy.ops.wm.open_mainfile(filepath=str(file))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
    assert len(meshes) == 2, 'Food and plate only'
    assert not any(obj.name.startswith('Fixed walnut') for obj in bpy.context.scene.objects)
    assert bpy.context.scene.camera.name == 'Fixed marketing camera'
    images = [image for image in bpy.data.images if image.type == 'IMAGE']
    assert all(image.packed_file or image.packed_files for image in images)
    assert all(max(image.size) <= 512 for image in images)
    root = bpy.data.objects.get('Dish turn')
    assert root and root.animation_data and root.animation_data.action
    assert all(obj.parent == root for obj in meshes)
    results.append(dict(slug=slug, reopened=True, meshes=len(meshes), packedImages=len(images),
                        frames=bpy.context.scene.frame_end, noTableGeometry=True))
(directory / 'saved-source-verification.json').write_text(json.dumps(results, indent=2))
print('HERO_SOURCE_VERIFIED ' + json.dumps(results), flush=True)
