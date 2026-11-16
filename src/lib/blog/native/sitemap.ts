import type {MetadataRoute} from 'next'
import {ownedAdminTransaction} from '../../data/admin-menus-runtime'
import {PLATFORM_BASE} from '../../seo'
import {requireNativeBlogConfiguration} from './selected'
import {readNativePublishedPosts,readNativeBlogTags,readNativeBlogArchive} from './public-data'
type Entries=MetadataRoute.Sitemap
async function blogEntries():Promise<Entries>{
 return ownedAdminTransaction(false,async query=>{
  const posts=await readNativePublishedPosts(query,null,1000)
  if(!posts.length)return []
  const entries:Entries=[{url:`${PLATFORM_BASE}/blog`,changeFrequency:'weekly',priority:0.7}]
  const [tags,archive]=await Promise.all([readNativeBlogTags(query,null),readNativeBlogArchive(query,null)])
  for(const tag of tags)entries.push({url:`${PLATFORM_BASE}/blog/tag/${tag.slug}`,changeFrequency:'weekly',priority:0.5})
  for(const year of new Set(archive.map(row=>row.year)))entries.push({url:`${PLATFORM_BASE}/blog/archive/${year}`,changeFrequency:'monthly',priority:0.4})
  for(const row of archive)entries.push({url:`${PLATFORM_BASE}/blog/archive/${row.year}/${String(row.month).padStart(2,'0')}`,changeFrequency:'monthly',priority:0.3})
  for(const post of posts)entries.push({url:`${PLATFORM_BASE}/blog/${post.slug}`,lastModified:post.published_at?new Date(post.published_at):undefined,changeFrequency:'monthly',priority:0.6})
  return entries
 })
}
/** Platform pages only (restaurants have their own sitemaps). A failing blog
 * read costs only that block; the static entries are always returned. */
export async function nativePlatformSitemap():Promise<Entries>{
 const entries:Entries=[{url:PLATFORM_BASE,changeFrequency:'weekly',priority:1},{url:`${PLATFORM_BASE}/pricing`,changeFrequency:'monthly',priority:0.8}]
 try{requireNativeBlogConfiguration()}catch{return entries}
 try{entries.push(...await blogEntries())}catch{}
 return entries
}
