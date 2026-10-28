# Messenger Figma implementation

Reference: https://www.figma.com/design/9YQqet1VEzpnD2dskZ6roQ/Facebook-Messenger-UI-Screens--Community-?node-id=0-11130

The page contains 15 screen types in two themes (375 × 812). Inspect source
layers and screenshots through the connected Figma session before implementing.
Use dynamic Dziri accounts, conversations and media in the design's data slots.
Keep the approved transparent ring logo, Consumer Inter/thmanyah fonts, EN/FR/AR,
Friends/Marketplace/staff eligibility, and shared canonical message IDs. Device
status bars and keyboards come from the OS, not exported screen pictures.

| Reference screen | Light node | Dziri binding                                                            |
| ---------------- | ---------- | ------------------------------------------------------------------------ |
| Chats            | 0:12903    | canonical Friends/Marketplace/team lists, unread counts, search          |
| Swipe actions    | 0:13065    | accessible row actions, canonical mute; no destructive shortcut          |
| Chat actions     | 0:13238    | composer tools, text, replies, reactions, media                          |
| Settings         | 0:13369    | own profile, locale, appearance, shared presence/read/typing preferences |
| Intro            | 0:13577    | empty conversation with actual participant avatar; name stays in header  |
| Camera           | 0:13677    | device camera permission/capture, preview, explicit send                 |
| Audio call       | 0:13725    | explicit unavailable notice; no connected-call simulation                |
| People           | 0:13752    | current contacts and privacy-aware presence                              |
| Story            | 0:13918    | canonical following stories, actual media and view receipts              |
| Profile          | 0:13940    | participant details, conversation search, shared media, mute             |
| New message      | 0:14071    | canonical searchUsersForChat/createDm/createGroup                        |
| Discover         | 0:14305    | public active Marketplace stores and existing commerce conversations     |
| Video call       | 0:14414    | explicit unavailable notice; no connected-call simulation                |
| Chat             | 0:14449    | canonical messages, avatars, replies/reactions, real receipt cursors     |
| GIF search       | 0:14648    | superseded by requested emoji-only picker; no GIF/sticker sections       |

Source-derived geometry: conversation list rows 76 high, avatars 60, search field
36 high/10 radius, list title 30/38, preview 14/20, participant header 52 excluding
OS safe area, header avatar 36, message avatar 28, body 17, bubble radius 18.
White/black canvases and incoming bubble fills (black 6% / white 20%) are Messenger
tokens. The reference's outgoing blue is superseded by the user's Consumer palette
requirement below. Original shared Inbox runtime retains
its independent native layout and shared palette.

All reference controls must map to actual capabilities or a clear unavailable
state. Consumer has no qualified audio/video transport; do not
label a screen as a connected media call. Do not copy fictional contacts,
advertisements, Facebook relationships, keyboard/status-bar pictures, or external
mini-app integrations into production data. Source URLs are attribution, not runtime assets.

Latest message-layout adjustment: sender names remain in the conversation header,
not repeated above bubbles or in their tap details. Avatars stay beside bubbles.
The timestamp and delivery ticks share a compact row beneath each bubble; tapping
adds reply/react controls to that row and expands the date. Reply quotes retain
the original sender for context.

The user's compact typography adjustment supersedes the reference's larger text:
page heading 24/30, names and messages 15/21, search 14/20, preview 13/18,
and timestamp 11. Consumer typefaces and accessibility scaling remain unchanged.

Latest palette override: controls and selected tabs are monochrome. Sent bubbles
and primary controls use Consumer ink (#1a1b17 light / #f2efea dark), with inverse
text on filled controls. Only read ticks retain rose (#d6164a / #ff375f), as
explicitly approved by the user. Reference icons are tinted at runtime. The
inherited staff runtime remains isolated.
The composer uses aligned 44px controls and a 44–120px text area, a localized
placeholder, and first-strong-letter direction for Arabic/mixed/Latin drafts.
The final requested focus treatment has no browser outline or surrounding ring.

Inspection coverage: all 15 light contexts and the dark Chat/Discover contexts
were received. The connected Figma Starter inspection quota then stopped further
dark layer reads. Dark tokens are derived from the inspected dark contexts;
the remaining dark screens have not been compared layer by layer. Calls have an
explicit unavailable state because Consumer has no qualified media transport.
Inbox swipe actions now expose details and the canonical mute preference, with
explicit user action required to save. The emoji-only picker does not fetch a
sticker catalogue or activate a GIF provider. Camera, microphone, swipe gestures,
and story publishing still require device and two-account acceptance.

## Settings, People, Discover and profile continuation (2026-10-26)

Settings uses the source's 115px profile image, 40px icons, 60px rows and inset
dividers. The decorative Facebook Messenger Code is omitted because Dziri has
no corresponding scan capability. Profile handle/phone appear only when present
on the authenticated account, inside Profile settings alongside language.
Sign out is a full-width icon row on the main Settings screen, below Discover,
per the latest placement request. The main Settings header contains only Back. The four
shared privacy preferences have their own navigable screen; no duplicated switch
list or nonfunctional notification rows are added.

People has its own 64px compact heading, 36px search, 72px story action, 40px
contact avatars and 60px rows. Presence comes from the existing privacy-aware
reader (at most 50 contact IDs). The reference's wave artwork opens the person's
conversation; it never auto-sends a greeting. Existing DMs reuse their canonical
thread IDs. New Message keeps its centered heading, 44px recipient field, group
selection and authenticated createDm/createGroup mutations.

Discover has the reference's segmented For You/Businesses control, horizontal
recent-conversation rail, 60px business avatars and 76px business rows. It reads
up to 50 active stores through marketplace:listStores; logos resolve for mounted
logo-bearing rows through marketplace:getStoreBySlug. Search filters this bounded
directory. For You adds actual existing commerce conversations, without synthetic
personalization or fictional recent visits. Store rows open an in-app business
profile backed by the same public reader. Its explicit Message action uses
marketplaceMessages:getOrCreateConversation; the server derives both parties and
reuses their canonical store conversation. No backend schema/deployment is required.

Conversation details uses the reference's audio/video/profile/mute icon actions.
The profile action opens an in-app profile through users:getPublicProfile, which
enforces the canonical public-profile policy. Its Message action reuses an existing
DM or invokes the existing authenticated createDm. Audio/video explicitly explain their unavailability;
mute and shared-media/search retain their existing authenticated behavior.

The latest Settings icon revision replaces the mixed source silhouettes with
one bundled Lucide 0.468.0 outline family: 20px glyphs, 2-unit strokes and 40px
neutral circles. This applies to Settings, Profile settings, Privacy and Sign out.
Sign out uses the standard doorway/outward-arrow symbol. ISC notices are retained
in each SVG and `assets/settings/LICENSE`; no runtime dependency is added.
RTL mirrors row order, chevrons and back arrows; profile
photos and the ringed logo remain unmirrored. The emoji category rail has a fixed
36px height above its bounded scrolling grid. Scroll indicators are hidden on
custom Consumer lists, pickers and scroll views while scrolling remains enabled.

All settings switches now use a compact 36×20 neutral track, 16px thumb and 44px
hit target. The off state uses a medium-gray track and white thumb, giving both
the track/page and thumb/track at least 3:1 contrast in light and dark appearances.
The on state retains the contrasting Consumer ink/inverse palette.
The web variant is a real button with role=switch and aria-checked,
supporting Space/Enter; native preserves the same geometry and explicit RTL order.
Directory tabs and group-selection controls expose their state explicitly.

Web auth now uses per-tab sessionStorage through Convex Auth's existing deployment
namespace; refreshes and rebuilds preserve sign-in after the first login on this
revision. Closing the tab ends that browser session. Native remains in SecureStore.
Passwords and message bodies are not persisted. Password fields have independent
localized visibility buttons inside their input, including registration/reset.
