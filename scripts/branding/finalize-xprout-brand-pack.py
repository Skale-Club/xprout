"""Verify exact brand artwork, package exports, and optionally deliver to the owner's Drive."""
import argparse, hashlib, json, re, shutil, zipfile
from pathlib import Path
import xml.etree.ElementTree as ET
from pypdf import PdfReader
from PIL import Image
from fontTools.pens.boundsPen import BoundsPen
from fontTools.svgLib.path import parse_path

parser = argparse.ArgumentParser()
parser.add_argument('--deliver', action='store_true')
args = parser.parse_args()
r = Path(__file__).resolve().parents[2]
p = r/'output/branding/xprout/xprout-brand-pack-v1'
c = r/'docs/brand/xprout/v1'
# Publish generated masters locally only after the generator has completed.
for kind in ['horizontal','stacked','symbol','wordmark']:
    for color in ['forest','ivory']: shutil.copy2(p/f'svg/xprout-{kind}-{color}.svg',c/f'xprout-{kind}-{color}.svg')
shutil.copy2(p/'source/layouts.json',c/'layouts.json')
for source,target in [('build-xprout-brand-pack.cjs','build-assets.cjs'),('build-xprout-brand-manual.py','build-manual.py')]:
    shutil.copy2(r/'scripts/branding'/source,p/'source'/target)
(p/'source/history').mkdir(exist_ok=True)
for prior in (c/'history').glob('layouts-*.json'): shutil.copy2(prior,p/'source/history'/prior.name)
shutil.copy2(p/'source/palette-swatches.svg',c/'palette-swatches.svg')
manual = PdfReader(p/'manual/xprout-brand-manual.pdf')
manual_text = '# Xprout brand manual\n\nVersion 1.2 - 14 November 2026\n\n' + '\n'.join(f'## Page {i:02d}\n\n{page.extract_text().strip()}\n' for i,page in enumerate(manual.pages,1))
for target in [p/'manual/xprout-brand-manual.md',c/'brand-manual.md']: target.write_text(manual_text,encoding='utf-8')
g = json.loads((c/'geometry.json').read_text())
l = json.loads((c/'layouts.json').read_text())['horizontal']
sha = lambda b: hashlib.sha256(b).hexdigest()
centers = []
for item in l['items']:
    shape = g[item['kind']]
    pen = BoundsPen(None); parse_path(shape['d'], pen)
    assert list(pen.bounds) == shape['bounds']
    centers.append(item['y']+(pen.bounds[3]-pen.bounds[1])*item['scale']/2)
body_bounds=l['alignment']['sourceBodyBounds']
contour_bounds=[]
for contour in re.findall(r'M[^M]+',g['wordmark']['d']):
    pen=BoundsPen(None);parse_path(contour,pen);contour_bounds.append(pen.bounds)
capital_x=min(contour_bounds,key=lambda bounds:bounds[0])
assert [capital_x[1],capital_x[3]]==body_bounds
word=l['items'][1]
body_center=word['y']+((body_bounds[0]+body_bounds[1])/2-g['wordmark']['bounds'][1])*word['scale']
assert abs(centers[0]-body_center) < 1e-9
assert centers[1] > body_center # p descender must not control alignment
assert l['items'][1]['scale'] == .86
assert sha(g['symbol']['d'].encode()) == g['symbolProvenance']['pathSha256']
m = json.loads((p/'brand-manifest.json').read_text())
palette=json.loads((c/'palette.json').read_text())
assert palette['version']=='1.2' and palette['colors']['wine']=='#602021' and palette['colors']['rosewood']=='#57373B'
assert m['colors']==g['colors'] and m['supportPalette']==palette
swatch=p/'source/palette-swatches.svg'
assert swatch.stat().st_size<=palette['swatchBudget']['maxBytes']
assert max(map(float,ET.fromstring(swatch.read_bytes()).attrib['viewBox'].split()[2:]))<=palette['swatchBudget']['maxSide']
assert (p/'source/palette.json').read_bytes()==(c/'palette.json').read_bytes()
for a in m['assets']:
    file=p/a['file']; data=file.read_bytes()
    assert len(data)==a['bytes'] and sha(data)==a['sha256']
    if file.suffix=='.svg':
        paths=[e.attrib['d'] for e in ET.fromstring(data).iter() if e.tag.endswith('path')]
        if 'horizontal' in file.name:
            assert g['symbol']['d'] in paths and g['wordmark']['d'] in paths
    if file.suffix=='.png':
        with Image.open(file) as im: assert max(im.size)<=512 and len(data)<=40960
for file,count in [('manual/xprout-brand-manual.pdf',10),('print/xprout-vector-masters.pdf',4)]:
    pdf=PdfReader(p/file); assert len(pdf.pages)==count
    if file.startswith('print'): assert all('/XObject' not in page['/Resources'] for page in pdf.pages)
for k in ['horizontal','stacked','symbol','wordmark']:
    for color in ['forest','ivory']: assert (p/f'svg/xprout-{k}-{color}.svg').read_bytes()==(c/f'xprout-{k}-{color}.svg').read_bytes()
(p/'README.md').write_text((c/'README.md').read_text(encoding='utf-8'),encoding='utf-8')
report={'revision':'2026-11-14 horizontal placement','symbolPathSha256':sha(g['symbol']['d'].encode()),'wordmarkPathSha256':sha(g['wordmark']['d'].encode()),'fullInkCenters':centers,'symbolAndTypographicBodyCenters':[centers[0],body_center],'bodyBounds':body_bounds,'wordmarkY':word['y'],'symbolHeight':202,'wordmarkHeight':(g['wordmark']['bounds'][3]-g['wordmark']['bounds'][1])*.86,'wordmarkScale':.86,'assetsVerified':len(m['assets']),'pdfPages':[10,4],'visualReview':'Parent agent reviews regenerated forest and ivory signatures separately.'}
(p/'evidence/horizontal-placement-verification.json').write_text(json.dumps(report,indent=2)+'\n')
archive=p.parent/'xprout-brand-pack-v1.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for f in sorted(p.rglob('*')):
        if f.is_file(): z.write(f,Path(p.name)/f.relative_to(p))
with zipfile.ZipFile(archive) as z: assert z.testzip() is None
out=r/'output/pdf';out.mkdir(exist_ok=True)
shutil.copy2(p/'manual/xprout-brand-manual.pdf',out/'xprout-brand-manual-v1.pdf')
if args.deliver:
    dest=Path('N:/My Drive/Xprout/Brand'); assert dest.is_dir()
    shutil.copytree(p,dest/p.name,dirs_exist_ok=True)
    deliveries=[(archive,dest/archive.name),(p/'manual/xprout-brand-manual.pdf',dest/'xprout-brand-manual-v1.pdf'),(p/'print/xprout-vector-masters.pdf',dest/'xprout-vector-masters.pdf')]
    for f in (r/'public/brand/xprout/v1').iterdir():
        if f.is_file(): deliveries.append((f,dest/'Runtime-v1'/f.name))
    report['deliveries']=[]
    for source,target in deliveries:
        target.parent.mkdir(exist_ok=True,parents=True);shutil.copy2(source,target)
        assert sha(source.read_bytes())==sha(target.read_bytes())
        report['deliveries'].append({'file':str(target),'bytes':target.stat().st_size,'sha256':sha(target.read_bytes())})
    for f in p.rglob('*'):
        if f.is_file(): assert sha(f.read_bytes())==sha((dest/p.name/f.relative_to(p)).read_bytes())
(r/'output/branding/xprout/horizontal-placement-verification.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
