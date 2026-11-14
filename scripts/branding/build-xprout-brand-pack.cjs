const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');
const root = path.resolve(process.argv[2] || (require('node:fs').existsSync(path.join(__dirname, 'geometry.json')) ? path.join(__dirname, '..') : path.join(__dirname, '../../output/branding/xprout/xprout-brand-pack-v1')));
sharp.concurrency(1);
const esc = value => String(value).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));

async function main() {
  const canonical = path.resolve(__dirname, '../../docs/brand/xprout/v1/geometry.json');
  await fs.mkdir(path.join(root, 'source'), {recursive:true});
  if (require('node:fs').existsSync(canonical)) await fs.copyFile(canonical, path.join(root, 'source/geometry.json'));
  const g = JSON.parse(await fs.readFile(path.join(root, 'source/geometry.json'), 'utf8'));
  if (crypto.createHash('sha256').update(g.symbol.d).digest('hex') !== g.symbolProvenance.pathSha256) throw Error('Approved symbol path mismatch');
  const dimensions = item => ({w: item.bounds[2]-item.bounds[0], h: item.bounds[3]-item.bounds[1]});
  const s = dimensions(g.symbol), w = dimensions(g.wordmark);
  const markH = 202, markW = s.w * markH / s.h;
  // Placement revision 2026-11-14: exact approved paths, lettering reduced 14%.
  const wordScale = 0.86;
  // Exact initial capital X contour cap top and baseline/body bottom. The p
  // descender is intentionally excluded from the alignment reference.
  const bodyBounds = [16.3140489858687, 193.11198629815513];
  const bodyHeight = (bodyBounds[1] - bodyBounds[0]) * wordScale;
  const wordY = (markH - bodyHeight) / 2 - (bodyBounds[0] - g.wordmark.bounds[1]) * wordScale;
  const horizontalH = Math.max(markH, wordY + w.h * wordScale);
  const layouts = {
    symbol: {w:s.w,h:s.h,symbolHeight:s.h,items:[{kind:'symbol',x:0,y:0,scale:1}]},
    wordmark: {w:w.w,h:w.h,symbolHeight:markH,items:[{kind:'wordmark',x:0,y:0,scale:1}]},
    horizontal: {w:markW+50+w.w*wordScale,h:horizontalH,symbolHeight:markH,alignment:{reference:'initial capital X contour; cap top to baseline/body bottom; descenders and diacritics excluded',sourceBodyBounds:bodyBounds},items:[{kind:'symbol',x:0,y:0,scale:markH/s.h},{kind:'wordmark',x:markW+50,y:wordY,scale:wordScale}]},
    stacked: {w:600,h:220+50+w.h*600/w.w,symbolHeight:220,items:[{kind:'symbol',x:(600-s.w*220/s.h)/2,y:0,scale:220/s.h},{kind:'wordmark',x:0,y:270,scale:600/w.w}]}
  };
  function artwork(layout, color, x=0, y=0) {
    return layout.items.map(item => {
      const shape = g[item.kind];
      return `<g transform="translate(${x+item.x} ${y+item.y}) scale(${item.scale}) translate(${-shape.bounds[0]} ${-shape.bounds[1]})"><path fill="${color}" fill-rule="evenodd" d="${shape.d}"/></g>`;
    }).join('');
  }
  function svg(kind,color,background) {
    const l=layouts[kind],p=l.symbolHeight/4;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${l.w+2*p} ${l.h+2*p}" role="img" aria-labelledby="title"><title id="title">Xprout ${esc(kind)} logo</title>${background?`<path fill="${background}" d="M0 0H${l.w+2*p}V${l.h+2*p}H0Z"/>`:''}${artwork(l,color,p,p)}</svg>\n`;
  }
  const assets=[];
  async function save(relative, bytes, meta={}) {
    const target=path.join(root,relative);
    await fs.mkdir(path.dirname(target),{recursive:true});
    await fs.writeFile(target,bytes);
    assets.push({file:relative.replaceAll('\\','/'),bytes:Buffer.byteLength(bytes),sha256:crypto.createHash('sha256').update(bytes).digest('hex'),...meta});
  }
  async function raster(relative,buffer,width) {
    const png=await sharp(buffer).resize({width,height:width,fit:'inside'}).png({compressionLevel:9}).toBuffer();
    const m=await sharp(png).metadata();
    if(png.length>g.budgets.logoRasterBytes || Math.max(m.width,m.height)>512)throw Error(`Logo budget: ${relative}`);
    await save(relative,png,{width:m.width,height:m.height,alpha:m.hasAlpha});
    return png;
  }
  for(const kind of Object.keys(layouts))for(const [name,color] of Object.entries(g.colors)) {
    const text=svg(kind,color);
    if(Buffer.byteLength(text)>(kind==='symbol'?g.budgets.symbolSvgBytes:g.budgets.outlinedLockupSvgBytes))throw Error('SVG budget');
    if(/<image|<text|<script|href=|<foreignObject/.test(text))throw Error('Non-outlined SVG');
    await save(`svg/xprout-${kind}-${name}.svg`,text,{variant:kind,color:name,transparent:true});
    for(const size of [256,512])await raster(`png/xprout-${kind}-${name}-${size}.png`,Buffer.from(text),size);
  }
  for(const kind of ['horizontal','stacked','symbol'])for(const [name,fg,bg] of [['on-ivory',g.colors.forest,g.colors.ivory],['on-forest',g.colors.ivory,g.colors.forest]]) {
    const text=svg(kind,fg,bg);
    await save(`svg/xprout-${kind}-${name}.svg`,text,{variant:kind,background:bg});
    await raster(`png/xprout-${kind}-${name}-512.png`,Buffer.from(text),512);
  }
  function icon(fg,bg,rounded=false,sw=328) {
    const sh=sw*s.h/s.w,scale=sw/s.w;
    const art=artwork({items:[{kind:'symbol',x:0,y:0,scale}]},fg,(512-sw)/2,(512-sh)/2);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Xprout"><rect width="512" height="512" rx="${rounded?112:0}" fill="${bg}"/>${art}</svg>`;
  }
  for(const [name,fg,bg]of[['forest',g.colors.ivory,g.colors.forest],['ivory',g.colors.forest,g.colors.ivory]]) {
    for(const rounded of [false,true]) {
      const key=rounded?'avatar':'app-icon'; const text=icon(fg,bg,rounded);
      await save(`icons/xprout-${key}-${name}.svg`,text);
      for(const size of rounded?[512]:[192,512])await raster(`icons/xprout-${key}-${name}-${size}.png`,Buffer.from(text),size);
    }
    const maskable=icon(fg,bg,false,288);
    await save(`icons/xprout-maskable-${name}.svg`,maskable);
    await raster(`icons/xprout-maskable-${name}-512.png`,Buffer.from(maskable),512);
  }
  // ICO uses PNG-compressed entries, preserving the exact source silhouette.
  const icoImages=[];
  for(const size of [16,32,48])icoImages.push({size,data:await sharp(Buffer.from(icon(g.colors.ivory,g.colors.forest))).resize(size,size).png({compressionLevel:9}).toBuffer()});
  const header=Buffer.alloc(6+16*icoImages.length);header.writeUInt16LE(1,2);header.writeUInt16LE(icoImages.length,4);
  let offset=header.length;
  icoImages.forEach(({size,data},i)=>{const at=6+i*16;header[at]=size;header[at+1]=size;header.writeUInt16LE(1,at+4);header.writeUInt16LE(32,at+6);header.writeUInt32LE(data.length,at+8);header.writeUInt32LE(offset,at+12);offset+=data.length;});
  const ico=Buffer.concat([header,...icoImages.map(x=>x.data)]);
  if(ico.length>g.budgets.faviconBytes)throw Error('Favicon budget');
  await save('icons/favicon.ico',ico,{sizes:[16,32,48]});
  for(const size of [16,32,48])await raster(`icons/favicon-${size}.png`,Buffer.from(icon(g.colors.ivory,g.colors.forest)),size);
  const l=layouts.horizontal,scale=980/l.w;
  const social=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="${g.colors.ivory}"/><g transform="translate(110 ${(630-l.h*scale)/2}) scale(${scale})">${artwork(l,g.colors.forest)}</g></svg>`;
  const socialWebp=await sharp(Buffer.from(social)).webp({quality:92}).toBuffer();
  if(socialWebp.length>g.budgets.previewBytes)throw Error('Social card budget');
  await save('icons/xprout-social-card-1200x630.webp',socialWebp,{width:1200,height:630});
  // Separate diagnostic proof; supplied logo exports remain unmarked.
  const proofLayout=layouts.horizontal, proofPad=markH/4;
  const proofLines=[
    ['symbol top',proofPad,'#bb6644'],
    ['cap top',proofPad+wordY,'#2266aa'],
    ['body center',proofPad+markH/2,'#aa3366'],
    ['baseline',proofPad+wordY+bodyHeight,'#2266aa'],
    ['symbol bottom',proofPad+markH,'#bb6644'],
  ].map(([label,y,color])=>`<line x1="${proofPad}" x2="${proofLayout.w+proofPad}" y1="${y}" y2="${y}" stroke="${color}" stroke-width="1.2" stroke-dasharray="5 5"/><text x="${proofPad+6}" y="${y-4}" fill="${color}" font-family="Arial,sans-serif" font-size="11">${label}</text>`).join('');
  const proof=svg('horizontal',g.colors.forest,g.colors.ivory).replace('</svg>',proofLines+'</svg>');
  await fs.mkdir(path.join(root,'evidence'),{recursive:true});
  await fs.writeFile(path.join(root,'evidence/horizontal-body-alignment-proof.svg'),proof);
  const proofPng=await sharp(Buffer.from(proof)).resize({width:1024}).png({compressionLevel:9}).toBuffer();
  if(proofPng.length>180*1024)throw Error('Alignment evidence budget exceeded');
  await fs.writeFile(path.join(root,'evidence/horizontal-body-alignment-proof.png'),proofPng);
  const lin=c=>{c/=255;return c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4;};
  const lum=hex=>{const rgb=hex.match(/[a-f0-9]{2}/ig).map(x=>parseInt(x,16));return .2126*lin(rgb[0])+.7152*lin(rgb[1])+.0722*lin(rgb[2]);};
  const contrast=(lum(g.colors.ivory)+.05)/(lum(g.colors.forest)+.05);
  await fs.writeFile(path.join(root,'source','layouts.json'),JSON.stringify(layouts,null,2));
  await fs.writeFile(path.join(root,'brand-manifest.json'),JSON.stringify({brand:'Xprout',domain:'https://xprout.app',edition:'1.1',date:g.date,colors:g.colors,contrastRatio:contrast,clearSpace:g.clearSpace,minimumSizes:g.minimumSizes,budgets:g.budgets,sourceSymbolPathSha256:g.symbolProvenance.pathSha256,assets},null,2)+'\n');
  console.log(JSON.stringify({assets:assets.length,contrastRatio:contrast,maxPngBytes:Math.max(...assets.filter(a=>a.file.endsWith('.png')).map(a=>a.bytes)),symbolUnchanged:crypto.createHash('sha256').update(g.symbol.d).digest('hex')===g.symbolProvenance.pathSha256}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});

