# Main Dziri connection

Messenger web, Android and iOS use `https://dashing-orca-24.convex.cloud`, the main
Dziri project. The public origin is defined in `config/dziri-backend.json` and
included by Expo configuration; `.env.local` can deliberately override it.
No admin key, replica database, copied users or alternative password store is used.

Sign in and Create account call the existing Consumer `password` provider.
Registration sends a normalized email and name, requires explicit Terms/Privacy
consent, and records it with `core/id/cndp:acceptTerms` before showing the tabs.
Password recovery uses Consumer's `reset` and `reset-verification` flows with
`recoveryChannel: sms`, a six-digit code, new-password confirmation, the same
12–128 character policy and server breach checks. Recovery requires an account's
verified phone; the request response does not disclose whether the account exists.

Friends, Marketplace and Staff & agents render only for a signed-in, available
profile after server capabilities load. Marketplace combines buying and selling for all active signed-in users.
Store message permissions and business membership remain server authority.
A conversation appears once and carries explicit seller scope when needed. Chats and read cursors use canonical Dziri IDs and reactive
queries; changing data in either app updates subscribers of that same backend.
Changes to platform UI code still require building that platform.

`pnpm check:connection` performs anonymous read-only queries against the selected
origin. It checks installed APIs and anonymous access boundaries, not signed-in
account acceptance. `pnpm test`, `pnpm typecheck`, `pnpm lint` and
`pnpm bundle:inbox` cover the client. Native-device acceptance and a real two-account
exchange remain separate checks. No real password was changed or account created
by the verification scripts. Rails Inbox sessions and the optional support bridge
retain their separate server authorization.
