# Marketing header and sign-in popup

The approved forest/ivory header places its reading-progress line along the
bottom edge of the sticky navigation, including when the mobile menu expands.
The mobile Start action has an 80px minimum width and retains its 44px height.
Opening sign-in closes the mobile menu first.

The embedded platform sign-in uses an ivory panel, forest typography, the
approved signature and restrained wine accent. Explicit configured logos and
primary button colours remain authoritative. Phone and Google authentication
logic and restaurant-branded sign-in retain their existing contracts.

## Loading and development origins

The identity entry verifies the configured canonical host. The development
launcher selects localhost, while earlier embedded previews used 127.0.0.1.
That alias caused a rejected iframe document whose zero-height measurement
collapsed the popup to a line beneath its backdrop.

Only in development, opening the marketing sign-in from a numeric loopback
alias returns to localhost on the same port, preserving the page/query/hash
and continuing the popup request. This does not relax the identity host check
or introduce a production redirect.

Error documents, network failures and a 15-second frame-loading deadline show
a visible recovery state. Retry reloads the frame; Close remains available.
Frame measurements have a usable minimum, respect the visible viewport and
release their ResizeObserver on replacement/unmount. The preliminary session
request is also bounded. No provider request is submitted by the UI checks.

## Evidence and release

Local checks: 29 focused unit passes, TypeScript and scoped lint (two existing
warnings), four browser regressions and actual sign-in rendering at
320/390/1440px. The actual alias-to-canonical transition, popup opening/closing,
header geometry and no-overflow states were verified. Error-document recovery
and retry are covered by tests/e2e/api/marketing-presentation.spec.ts.

Recent measured CI guidance: a normal dev/main run takes approximately
12–16 minutes including mobile Lighthouse; image deployment adds about
3–4 minutes. A prior browser-installation attempt timed out at 12 minutes and
passed when only that failed job was retried. Publication status and exact
runtime SHA belong to the Journal and readiness endpoint.
