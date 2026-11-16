# SEO completion checkpoint

Owner instruction: finish the SEO execution plan end to end (2026-11-16).
The reviewed production release, core acceptance and Journal write/readback are
complete. Conditional onboarding and provider work remains below.
Heavy validation ran in GitHub Actions, not on the critical-memory Surface.

## Released scope

- [x] Shared identity/indexability, trusted request context and canonical host routing.
- [x] Tenant/brand metadata, language, robots, sitemap, llms and social identity.
- [x] Local SEO fields/entities, branch/dish pages, factual footers, public navigation and launch checks.
- [x] Partner branding/apex fallback and privacy/publication/plan-gated discovery.
- [x] Anonymous cache contract, Flight privacy, reviewed Cloudflare activation and live acceptance.
- [x] Full CI, production deployment and owned schemas 20→21→22.
- [x] Google markup tests, sitemap resubmission and root indexing request.
- [x] XMM-151 Journal completed and read back, including release evidence and limits.

The session model owned integration/security/release/final verification;
gpt-6.1-sol implemented delegated SEO/schema/pages/tests/documentation work.
Shared conventions `c96f258` were released separately in skaleclub-apps with their
SKA Notion record; sibling application adoption remains a separate session.

## Release evidence

| Evidence | Observed result |
| --- | --- |
| Runtime | `5ad1e9466916e788d3eb9699611cfa55638ac007`, public readiness healthy 21:43:52 UTC |
| Preserved concurrent galleries | Both `822de33` and `9977ac4`; validated rollback `9977ac4cbbb9f92897051d6f0bd9d44fff7af728` preserves 67 dishes |
| Dev CI | [43958112288](https://github.com/Skale-Club/xprout/actions/runs/43958112288), green |
| Main CI/deploy | [43960325122](https://github.com/Skale-Club/xprout/actions/runs/43960325122), green |
| Unit / browser / preview | 2,110 passed/6 environment skips; 129 passed/0 failed/0 skipped; preview 36 passed/0 failed |
| Dev mobile Lighthouse medians | Home/self/menu: 97/97/97 |
| Main pipeline (UTC) | 21:27:46→21:43:11, 15m25s |
| Deploy job (UTC) | 21:39:38→21:43:11, 3m33s |
| Origin / edge / media | 61/0; 65/0; 4/0 |
| Negative webhook probes | 8 passed, all 400/401; genuine provider delivery not established |
| Journal | [XMM-151](https://app.notion.com/p/41ab7a686121815e8753c42f20e9f60f), Done and read back |

Evidence source: `output/seo/2026-11-16/release-final.json`, with linked origin,
edge, media and webhook reports. The final record shows three active rules and
successful traffic acceptance; its separately named preactivation readback
preserves the reviewed expressions and settings.

## Schema, privacy and cache

Schema plan [43949009317](https://github.com/Skale-Club/xprout/actions/runs/43949009317)
reported exactly 3 pending/0 changed. Apply
[43952028079](https://github.com/Skale-Club/xprout/actions/runs/43952028079) applied
20→21→22 at 20:39:37 UTC after a 361,166-byte schema-only backup, SHA-256
`d77bd99fbbbdda7fab234b7788a8d932f781b102a6c4e2c491d5cca90f539738`.
Replan [43952110264](https://github.com/Skale-Club/xprout/actions/runs/43952110264)
reported 16 files/0 pending/0 changed/ready true. Applied hashes match Git LF
blobs; Windows CRLF checkout differences are line endings. No later SQL changes.

Earlier 50/51 origin acceptance exposed a real canonical-root RSC cache defect:
Next's adapter removed Flight signals before middleware. The documented
`skipProxyUrlNormalize=true` correction and canonical non-rewrite root regression
coverage now pass. Final origin acceptance is 61/0. Edge acceptance is 65/0:
HTML HIT at root, Celes, Aurora and Bella Vista; two cookies, authorization,
query parameters and all Flight variants are DYNAMIC plus private/no-store.

Three dashboard rules were compiled/read back, then enabled during 21:45–21:48
UTC and verified active at 21:48: anonymous HTML
`4086f4a40e894f59bcc37da9e8a6167f`, Next image
`135c9aeb7f55404bb871294a13d47ff8`, final bypass
`5be78f128a2544049639eb582ce71fe7`. Scope is xprout.app only. Origin TTL is
respected; absent freshness bypasses cache, raw image Vary and complete default
query keys remain. DNS-only API access still returns 403; no API version is
claimed. Media evidence: 256px WebP/PNG and 640px WebP variants MISS→HIT, plus
immutable JS MISS→HIT. Rollback disables exactly these three rules and, if needed,
restores image `9977ac4`; additive schemas can remain.

## Google evidence and limits

Code-input tests retain [home 4 valid items](https://search.google.com/test/rich-results/result?id=nRqz3oGshB4ZQQTzDGZVGA),
[branch 3 valid/0 critical](https://search.google.com/test/rich-results/result?id=bQf5aOBctH9TOCRnwa2piA)
and [dish 1 valid Breadcrumb](https://search.google.com/test/rich-results/result?id=FyNG-PjiVa6b0GrBdMV9Tg).
Branch used actual CI SSR with the final `@id`-only parent correction. MenuItem
is semantic markup, not proof of Google Product/review enhancement eligibility.

[Final live Celes](https://search.google.com/test/rich-results/result?id=j1Tz_XQXr8c8ScWQS4mCFw)
was crawled November 16 at 16:44:40 EST: 2 valid items/0 critical errors on the
final runtime. Graph SHA-256 remains unchanged:
`e97435b464487493b3dda9212bafa0d480ee2be04ad7e944a4965f0462fc9dad`.
Sitemap resubmission succeeded November 16; last-read/discovery counters still
show November 14/prior 6 URLs. The root is indexed and "Indexing requested"
confirmed priority-queue placement; neither instant recrawl nor rankings is claimed.

IndexNow and publish-effect purge remain off/unconfigured. Hreflang awaits a real
multilingual tenant. Partner DNS/email provisioning remains onboarding work; no
real partner was activated. Existing media-policy gaps and historical dish slug
redirects are not solved by this release. Stripe's pre-existing absent signing
secret remains fail-closed; negative probes do not establish genuine delivery.
