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
0.55m, initial orbit0°/62°, target y0.04m and vertical field of view30° are shared
across dishes. The closer camera enlarges food by about13% without changing its
real portion scale. Radius/pitch stay fixed; horizontal dragging turns the dish.
Wheel zoom, panning and tap recentering are disabled; wheel input scrolls the
page. Photo/poster native dragging and selection are disabled. Contact
shadows ground the plate on the image. A matching live model hides its poster
to avoid ghosting behind the rotating food.

The carousel advances after seven seconds only when the selected model has
loaded, the page and scene are visible, motion is enabled, and the visitor is
not hovering or focusing it. Manual controls stop automatic selection. User
camera manipulation also latches the current dish's idle animation off. Hover,
focus, offscreen state, hidden documents and system reduced motion stop dish
animation. Automatic changes do not flood the live announcement region;
manual selection announces the dish. Menu links open the real Aurora menu.

The library/model load after page load and an idle opportunity, when visible.
Reduced motion and data saving keep a static poster until explicit Explore in
3D. JavaScript-free content remains visible. Model failures/timeouts retain the
poster; Retry uses a new attempt URL to bypass the library's failed-URL cache.
The View in3D pill is always visible, including desktop and resized previews.
On supported phones/tablets it opens native AR only on tap; elsewhere it enables
the inline3D view and explains how to access phone AR. Capability detection must
not hide the entry point.
Shared launch helpers use published original GLBs for Android Scene Viewer and
USDZs for iOS Quick Look, with real-scale resizing off. No AR model or Three/WebXR
library is preloaded for this button. Six original asset URLs return200 with
correct MIME: GLBs4.72–5.27MB and USDZs9.51–9.86MB, within the existing15MiB
native-delivery budget. Published asset versions are pinned and must be updated
if those originals are removed. Phone capability detection and Android fallback
reuse the app contract. Physical camera placement requires real-device testing.
No cart action is added.

## Reused film

The former hero video now appears in a separate dark editorial section after
the menu examples. Its burger, pizza and sushi footage is presented as a food
film, not a recording of app functionality. Per owner feedback, the video and
poster are enlarged by 16% inside the existing clipped 16:9 frame, keeping the
source watermark outside the visible crop. Original media bytes are unchanged.
A lazy poster loads first; entering view starts muted inline playback in a loop.
The native player controls and floating marketing Pause/Resume button are removed;
video pointer interaction, picture-in-picture and remote playback are disabled.
Old saved Pause preferences no longer leave visitors silently paused. Playback
still suspends offscreen and in hidden documents. System reduced motion, data
saving and autoplay refusal retain a manual fallback. The source is not attached
offscreen or replaced for every loop.

The old source is retained privately. The 13.67-second clip was reduced from
17,540,180 B to1,567,618 B, silent H.264/yuv420p,1280×720,24fps, fast-start.
Its poster is1200×675 /37,116 B. The original large file is not served by the app.

## Bounded media profiles and reproducible sources

These scoped marketing profiles do not enlarge guest upload/AR allowances or
resolve the application-wide policy's existing ingestion gaps.

| Artifact | Explicit maximum | Measured output |
| --- | --- | --- |
| Dish GLB | 1.5MiB,45,000 triangles,512px texture edge; embedded resources, no decoder downloads | 970,128–1,101,144 B;19,682 triangles; five textures per model |
| Dish poster | WebP,1200px long edge,180KiB | 27,554–60,462 B;914×686 |
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
all models, hover/focus/offscreen behavior, reduced motion, data saving,
static no-JavaScript content, failed model loading and successful Retry.
Follow-up checks cover real horizontal dragging without native image drag,
scroll without zoom, latched idle stop, muted autoplay, an actual loop, native
visibility suspension/resume and reduced-motion fallback. Native URL tests cover all
three dishes and both routes; emulated-phone tests verify Quick Look image-first
anchors, selected-dish changes, no original-model preload, Android fallback and
desktop omission. Native phone camera placement was not tested.
Eight responsive page states have no horizontal overflow or page errors.
Four axe states report zero detected violations; incomplete gradient, icon,
table and silent-video-caption findings remain review limits. Nineteen focused
unit tests, TypeScript and scoped ESLint pass. No production build, Lighthouse
or physical-device audit was performed in this local design task.

The forest header and compact hero stay in place. Pricing calculations and
configured landing copy/colors remain unchanged. Publication still requires the
four explicit settings merges recorded in marketing-design-v2.md, normal CI
and live verification. Production remains5336b99, with no push or deploy here.


## Film presentation refinement (2026-11-14)

Browser checks at 390px and 1440px confirm no floating toggle or native controls,
muted inline autoplay despite an old saved Pause preference, real playback time
advancement and loop wrap, offscreen suspension, no page errors or horizontal
overflow. Reduced motion retains a lazy poster. Pizza-scene captures were reviewed
at both widths: no Veo symbol or player chrome is visible. Evidence is in
`output/film-chrome/2026-11-14`. TypeScript, scoped lint and 11 existing targeted
tests pass. No new media assets or byte budgets, production settings or release.
This presentation change is not an accessibility conformance certification.
