/** Verify private build output before placing optimized assets in public/. */
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import sharp from 'sharp'

const staging = process.argv[2]
if (!staging) throw Error('Usage: node scripts/marketing/publish-hero-assets.mjs <private-staging> [--write]')
const write = process.argv.includes('--write')
const destination = path.resolve('public/marketing/v3')
const rows = []
const pending = []
sharp.concurrency(1)
const photo = await fs.readFile(path.join(destination,'table-photo.webp'))
const photoMeta = await sharp(photo).metadata()
if (photoMeta.format !== 'webp' || photo.length > 180 * 1024 || Math.max(photoMeta.width,photoMeta.height) > 1200) throw Error('Table photo budget')
for (const slug of ['picanha', 'burger', 'tiramisu']) {
  const file = `dish-${slug}`
  const model = await fs.readFile(path.join(staging, `${file}.glb`))
  if (model.readUInt32LE(0) !== 0x46546c67 || model.readUInt32LE(4) !== 2 || model.readUInt32LE(8) !== model.length) throw Error('Invalid GLB')
  if (model.length > 1536 * 1024) throw Error('GLB byte budget')
  const jsonLength = model.readUInt32LE(12)
  const data = JSON.parse(model.subarray(20, 20 + jsonLength).toString())
  if (data.buffers.some(b => b.uri) || data.images.some(i => i.uri)) throw Error('External GLB dependency')
  if (data.nodes.some(node => node.name?.startsWith('Fixed walnut'))) throw Error('Hero table must be a separate photograph, not 3D geometry')
  if ((data.extensionsRequired ?? []).some(x => /draco|meshopt/i.test(x))) throw Error('Unapproved decoder dependency')
  if (data.animations?.length !== 1 || data.animations[0].channels.some(channel => data.nodes[channel.target.node].name !== 'Dish turn' || channel.target.path !== 'rotation')) throw Error('Only the dish may animate; table must stay fixed')
  const triangles = data.meshes.reduce((sum, mesh) => sum + mesh.primitives.reduce((value, primitive) => value + data.accessors[primitive.indices].count / 3, 0), 0)
  if (triangles > 45000) throw Error('Geometry budget')
  const binaryStart = 20 + jsonLength + 8
  for (const image of data.images) {
    const view = data.bufferViews[image.bufferView]
    const bytes = model.subarray(binaryStart + (view.byteOffset ?? 0), binaryStart + (view.byteOffset ?? 0) + view.byteLength)
    const meta = await sharp(bytes).metadata()
    if (Math.max(meta.width, meta.height) > 512) throw Error('Texture dimension budget')
  }
  let poster
  for (const quality of [82, 72, 60, 48]) {
    poster = await sharp(path.join(staging, `${file}.png`)).resize({width:960,height:720,fit:'inside',withoutEnlargement:true}).webp({quality}).toBuffer()
    if (poster.length <= 180 * 1024) break
  }
  if (poster.length > 180 * 1024) throw Error('Poster byte budget')
  const metadata = await sharp(poster).metadata()
  if (!metadata.hasAlpha) throw Error('Dish poster must be transparent')
  const alpha = await sharp(poster).ensureAlpha().extractChannel('alpha').raw().toBuffer()
  let minX=metadata.width,minY=metadata.height,maxX=-1,maxY=-1
  for(let y=0;y<metadata.height;y++) for(let x=0;x<metadata.width;x++) if(alpha[y*metadata.width+x]>200){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y)}
  if(maxX<0 || minX<3 || minY<3 || maxX>=metadata.width-3 || maxY>=metadata.height-3) throw Error('Dish poster is empty or clips its opaque subject')
  rows.push({slug,model:`${file}.glb`,bytes:model.length,triangles,textures:data.images.length,maxTextureEdge:512,sha256:crypto.createHash('sha256').update(model).digest('hex'),poster:`${file}.webp`,posterBytes:poster.length,posterWidth:metadata.width,posterHeight:metadata.height,posterSha256:crypto.createHash('sha256').update(poster).digest('hex')})
  pending.push({file:`${file}.glb`,bytes:model},{file:`${file}.webp`,bytes:poster})
}
// Validate every artifact before replacing any public derivative.
if (write) {
  await fs.mkdir(destination,{recursive:true})
  for (const artifact of pending) await fs.writeFile(path.join(destination,artifact.file),artifact.bytes)
}
await fs.writeFile(path.join(staging,'delivery-verification.json'),JSON.stringify({scope:'Owned dish-only marketing derivatives; table is a separate photograph',budget:{glbBytes:1536*1024,triangles:45000,maxTextureEdge:512,posterBytes:180*1024,maxPosterEdge:1200},tablePhoto:{bytes:photo.length,width:photoMeta.width,height:photoMeta.height,sha256:crypto.createHash('sha256').update(photo).digest('hex')},publishedToLocalPublic:write,rows},null,2))
console.log(JSON.stringify({publishedToLocalPublic:write,rows}))
