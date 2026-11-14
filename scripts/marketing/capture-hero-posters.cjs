const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const staging=process.argv[2];const base=process.argv[3]||'http://127.0.0.1:3255/';
if(!staging||!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Usage: capture-hero-posters.cjs <private-staging> [loopback-preview-URL]');
(async()=>{const b=await chromium.launch({headless:true});const receipt=[];try{
const p=await b.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:2,reducedMotion:'reduce'});await p.goto(base);
await p.getByRole('button',{name:'Explore in 3D',exact:true}).click();
for(const [slug,name]of[['picanha','Premium Picanha'],['burger','Artisan Burger'],['tiramisu','Tiramisu']]){
 await p.getByRole('button',{name:'Show '+name,exact:true}).click();
 await p.waitForFunction(slug=>{const v=document.querySelector('.mk-table-viewer');return v?.loaded&&v.src.endsWith('dish-'+slug+'.glb')&&getComputedStyle(v).opacity==='1'},slug,{timeout:30000});
 const capture=await p.locator('.mk-table-viewer').evaluate(async el=>{el.constructor.minimumRenderScale=1;el.pause();el.currentTime=0;el.jumpCameraToGoal();await el.updateComplete;await new Promise(r=>setTimeout(r,600));const blob=await el.toBlob({mimeType:'image/png',idealAspect:false});const data=Array.from(new Uint8Array(await blob.arrayBuffer()));const meta={orbit:el.getCameraOrbit(),target:el.getCameraTarget(),fov:el.getFieldOfView(),animations:el.availableAnimations};return{data,meta}});
 const raw=Buffer.from(capture.data);const rm=await sharp(raw).metadata();const width=Math.min(rm.width,Math.floor(rm.height*4/3));const bytes=await sharp(raw).extract({left:Math.floor((rm.width-width)/2),top:0,width,height:rm.height}).png().toBuffer();const target=path.join(staging,'dish-'+slug+'.png');if(!fs.existsSync(target.replace('.png','-blender.png')))fs.copyFileSync(target,target.replace('.png','-blender.png'));fs.writeFileSync(target,bytes);const m=await sharp(bytes).metadata();receipt.push({slug,source:'Actual local model-viewer WebGL canvas, dish only, static animation frame 0; centered 4:3 framing',width:m.width,height:m.height,...capture.meta});
}
fs.writeFileSync(path.join(staging,'webgl-poster-receipt.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
}finally{await b.close();}})().catch(e=>{console.error(e.message);process.exitCode=1});
