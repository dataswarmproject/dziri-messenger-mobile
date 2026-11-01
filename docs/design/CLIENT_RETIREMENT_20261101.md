# React client retirement

Standalone previously closed a memoized Convex client during effect cleanup.
React effect replay then reused the closed client. Consumer had the opposite
gap: old URL and unmounted clients were never closed. Regressions reproduce
both behaviors with the actual installed SDK and synthetic WebSocket/auth
boundaries.

The canonical hook is
`packages/convex-provider/src/use-client-retirement.ts`. Native synchronizes its
pure React implementation through `scripts/sync-client-retirement.mjs`; the
generated file imports no Consumer cookie adapter or staff authentication.
Each effect owns a client-specific lease. Retirement runs in a microtask and
closes only if the lease was not reclaimed during synchronous effect replay.
True unmounts and replacement URLs/sessions still retire their old connection.
Existing owner cancellation and subscription cleanup remain immediate. Shutdown
rejections produce a generic warning without credentials or endpoint details.

Consumer uses a keyed connected child so missing/configured URL transitions
have consistent hook order and distinct client lifetimes. Constructors remain
lazy according to the installed SDK; rendering an unused instance opens no
socket. Native preserves its session keys, storage isolation and explicit reset.

The UI follow-up restores circular plus and info glyphs rather than the free
pack's boxed variants. Their 24px presentation matches adjacent media/call
controls, while existing touch targets, labels and callbacks remain intact.
Consumer uses its installed Lucide circular-plus component; native reuses the
existing circular SVGs. The original Iconly catalogue remains unchanged.

Local SDK regressions prove effect replay, true unmount, deployment replacement,
missing/restored configuration and same-URL session retirement. They do not
establish real authenticated account-switch, physical OS recovery or deployed
acceptance. All push/deployment/provider holds remain in force.
