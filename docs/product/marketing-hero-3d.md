# Marketing hero: photographed table and 3D dishes

Status: local preview on codex/premium-marketing; not published to production.

The owner requested a fixed **photograph** of a table with changing 3D food on
top. The table is an AI-generated photographic background, not footage of an
actual Aurora restaurant. The dishes derive from the app's existing owned
Aurora models: Premium Picanha, Artisan Burger and Tiramisu. No new model or
restaurant data was written to production. The rejected all-3D table remains
private review history; no table geometry ships in the current GLBs.

## Presentation and behavior

HeroTableShowcase layers the same optimized walnut-table photo, a transparent
matching dish poster, and one active model-viewer element. Each GLB contains
only the food and plate, with an animation on the dish root. Camera radius
0.62m, orbit 0°/62°, target y0.04m and vertical field of view30° stay fixed across
all dishes. Camera bounds prevent model-dependent framing changes. Contact
shadows ground the plate on the image. A matching live model hides its poster
to avoid ghosting behind the rotating food.

The carousel advances after seven seconds only when the selected model has
loaded, the page and scene are visible, motion is enabled, and the visitor is
not hovering or focusing it. Manual controls stop automatic selection. Hover,
focus, offscreen state, hidden documents and shared Pause motion stop dish
animation. Automatic changes do not flood the live announcement region;
manual selection announces the dish. Menu links open the real Aurora menu.

The library/model load after page load and an idle opportunity, when visible.
Reduced motion and data saving keep a static poster until explicit Explore in
3D. JavaScript-free content remains visible. Model failures/timeouts retain the
poster; Retry uses a new attempt URL to bypass the library's failed-URL cache.
No AR camera launch or ordering action is added to this marketing surface.

## Reused film

The former hero video now appears in a separate dark editorial section after
the menu examples. Its burger, pizza and sushi footage is presented as a food
film, not a recording of app functionality. The existing source watermark is
retained. A lazy poster loads first; the video URL is attached only on Play.
Native controls remain available. Playback pauses when its element is
offscreen, the document becomes hidden or motion preferences switch to paused
or reduced. Explicit playback is available under reduced motion.

The old source is retained privately. The 13.67-second clip was reduced from
17,540,180 B to1,567,618 B, silent H.264/yuv420p,1280×720,24fps, fast-start.
Its poster is1200×675 /37,116 B. The original large file is not served by the app.

## Bounded media profiles and reproducible sources

These scoped marketing profiles do not enlarge guest upload/AR allowances or
resolve the application-wide policy's existing ingestion gaps.

| Artifact | Explicit maximum | Measured output |
| --- | --- | --- |
| Dish GLB | 1.5MiB,45,000 triangles,512px texture edge; embedded resources, no decoder downloads | 970,128–1,101,144 B;19,682 triangles; five textures per model |
| Dish poster | WebP,1200px long edge,180KiB | 22,782–50,294 B;914×686 |
| Table photo | WebP,1200px long edge,180KiB | 1200×900,73,360 B |
| Home film | H.264,1280px long edge,24fps,45s,5MiB, no audio | 13.67s,1,567,618 B |
| Film poster | WebP,1200px long edge,180KiB | 1200×675,37,116 B |

scripts/marketing/build-hero-dishes.py runs in isolated Blender5.2 with two
render threads and a600s process timeout, preserves originals and writes private
staging. It simplifies geometry and bounds textures before export.
verify-hero-dishes.py reopens the saved sources and checks their content.
publish-hero-assets.mjs checks actual bytes, embedded image dimensions, geometry,
animation targets and no table geometry; all derivatives pass before any local
public output is replaced. A missing/failed conversion throws rather than
publishing an original. Sharp concurrency is one. This is an offline batch,
not a guest-triggered ingestion or transformation endpoint.

capture-hero-posters.cjs captures the actual local WebGL canvas at the first
animation frame with centered4:3 framing. The publication guard also rejects
opaque subjects clipped against the poster edge. Exact hashes and measurements
are in marketing-hero-media.json. Editable
packed Blender scenes, the photograph source, encoder/build receipts and review
evidence are delivered under N:/My Drive/Xprout/Website/Hero3D.

## Verification and release boundary

Normal-motion browser tests cover real animation time, a fixed camera/photo,
automatic and manual switching, one active model, no initial eager loading of
all models, Pause, hover/focus/offscreen behavior, reduced motion, data saving,
static no-JavaScript content, failed model loading and successful Retry.
Film checks cover no video request before Play, explicit playback under reduced
motion, offscreen pause, poster retention on error and successful retry.
Eight responsive page states have no horizontal overflow or page errors.
Four axe states report zero detected violations; incomplete gradient, icon,
table and silent-video-caption findings remain review limits. Nineteen focused
unit tests, TypeScript and scoped ESLint pass. No production build, Lighthouse
or physical-device audit was performed in this local design task.

The forest header and compact hero stay in place. Pricing calculations and
configured landing copy/colors remain unchanged. Publication still requires the
four explicit settings merges recorded in marketing-design-v2.md, normal CI
and live verification. Production remains5336b99, with no push or deploy here.
