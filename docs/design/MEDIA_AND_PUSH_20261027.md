# Media and push preparation

Canonical implementation and evidence: `E:/CodexWorktrees/messenger-tabs/tawasool-mmogram/tasks/messenger-meta-parity/media-and-push.md`.

Media classification, link handling, upload transport, 25 MB uploads and two-minute recordings share the checked `messenger-media` contract. Native file selection uses the installed Expo file-system package; web uses the system browser picker. Marketplace remains image-only. Cancel is available during upload, before message submission. No send is retried with a different storage receipt or original message ID.

Push registration reuses Consumer's existing coordinator through `push-registration.generated.ts`. Sync and check with `node scripts/sync-push-registration.mjs --source E:/CodexWorktrees/messenger-tabs/tawasool-mmogram`. This check also runs before export.

The user chose disabled push preparation. `PERSONAL_PUSH_CONFIGURED` is false and no SDK adapter is installed. The runtime therefore performs no permission request, device-token read, provider subscription or registration call. Settings tells the user background notifications are unavailable. A future adapter must return null until permission is already granted and must never use staff credentials/subscriptions.

Activation requires a reviewed build with DM's registered Android/iOS application, real SDK adapter and permission UX, native channels, token/session/logout checks, authenticated notification destinations, separate APNs topic qualification, and real-device delivery evidence. Editing the flag alone does not make push work. No provider, backend, store, or production deployment occurred in this checkpoint.
