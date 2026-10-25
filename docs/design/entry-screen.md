# Consolidated messenger navigation

The 25 October 2026 owner clarification replaces the account-type chooser with
one signed-in shell. Friends is always visible. Customers requires a published
product in an active shop with current message access. Staff & agents requires
current owner/admin/editor membership of an active Dziri Business profile;
invited staff are included per the owner's explicit answer.

Sold-out products carrying a publication timestamp retain Customers. Drafts,
suspension, archival, revocation, ambiguous grants and guest accounts do not
unlock business tabs. Unpublishing the last eligible product removes Customers.
These are navigation rules; canonical conversation permissions still apply.

One authenticated backend query drives the tabs. Capability loss falls back to
Friends during rendering. A changed tenant scope remounts the navigator and
closes stale business details. Buyers keep their shop conversations in Friends.
Seller conversations carry explicit store context and existing send retry IDs.
Native support-queue credentials are scoped to the Dziri user and origin.

Header and both sign-in screens use the existing approved transparent
assets/dziri-ring.svg with theme-aware tint. Its embedded PNG has actual alpha
(0..255, transparent corners); the canonical bytes/hashes are unchanged. No
background tile, generated logo or blend-mode approximation is used. Arabic
reverses layout and input alignment, never the ring orientation.

This is a Dziri adaptation using the shared Inbox palette. Custom app text now
matches Consumer's Inter/thmanyah Sans pairing. Original thmanyah v1.003 OTF
files are bundled unchanged for all platforms. Upstream native screens/fonts
remain unchanged. Locale-aware text/input wrappers set direction, alignment and
weight consistently; a left-to-right layout root prevents double mirroring of
the explicitly reversed Arabic rows. Document language/direction follow the
selected locale on web. The personal login is bounded to 420px and fits
a 390px viewport. Device visuals remain unverified. See VERIFICATION.md for the
coordinated backend rollout gate; this checkpoint is not a live business-tab claim.
