# Messenger Figma implementation

Reference: https://www.figma.com/design/9YQqet1VEzpnD2dskZ6roQ/Facebook-Messenger-UI-Screens--Community-?node-id=0-11130

The page contains 15 screen types in two themes (375 × 812). Inspect source
layers and screenshots through the connected Figma session before implementing.
Use dynamic Dziri accounts, conversations and media in the design's data slots.
Keep the approved transparent ring logo, Consumer Inter/thmanyah fonts, EN/FR/AR,
Friends/Marketplace/staff eligibility, and shared canonical message IDs. Device
status bars and keyboards come from the OS, not exported screen pictures.

| Reference screen | Light node | Dziri binding |
| --- | --- | --- |
| Chats | 0:12903 | canonical Friends/Marketplace/team lists, unread counts, search |
| Swipe actions | 0:13065 | accessible row actions, canonical mute; no destructive shortcut |
| Chat actions | 0:13238 | composer tools, text, replies, reactions, media |
| Settings | 0:13369 | own profile, locale, appearance, shared presence/read/typing preferences |
| Intro | 0:13577 | empty conversation with actual participant identity |
| Camera | 0:13677 | device camera permission/capture, preview, explicit send |
| Audio call | 0:13725 | canonical call state; transport qualification separate |
| People | 0:13752 | current contacts and privacy-aware presence |
| Story | 0:13918 | canonical following stories, actual media and view receipts |
| Profile | 0:13940 | participant details, conversation search, shared media, mute |
| New message | 0:14071 | canonical searchUsersForChat/createDm/createGroup |
| Discover | 0:14305 | existing people/channel discovery, actual business context |
| Video call | 0:14414 | canonical call state; transport qualification separate |
| Chat | 0:14449 | canonical messages, avatars, replies/reactions, real receipt cursors |
| GIF search | 0:14648 | installed sticker catalogue; GIF provider requires a real integration |

Source-derived geometry: conversation list rows 76 high, avatars 60, search field
36 high/10 radius, list title 30/38, preview 14/20, participant header 52 excluding
OS safe area, header avatar 36, message avatar 28, body 17, bubble radius 18.
White/black canvases and incoming bubble fills (black 6% / white 20%) are Messenger
tokens. The reference's outgoing blue is superseded by the user's Consumer palette
requirement below. Original shared Inbox runtime retains
its independent native layout and shared palette.

All reference controls must map to actual capabilities or a clear unavailable
state. The existing Consumer call overlay lacks audio/video transport; do not
label call state as a connected media call. Do not copy fictional contacts,
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

Consumer palette authority is `apps/dziri/app/globals.css` and its Messenger CSS:
sent bubbles use `--mk-ink` (#1a1b17 light / #f2efea dark), with inverse text;
controls/read ticks use `--mk-accent` (#d6164a light / #ff375f dark). Monochrome
reference icons are tinted at runtime. The inherited staff runtime remains isolated.
The composer uses aligned 44px controls and a 44–120px text area, a localized
placeholder, and first-strong-letter direction for Arabic/mixed/Latin drafts.
The final requested focus treatment has no browser outline or surrounding ring.

Inspection coverage: all 15 light contexts and the dark Chat/Discover contexts
were received. The connected Figma Starter inspection quota then stopped further
dark layer reads. Dark tokens are derived from the inspected dark contexts;
the remaining dark screens have not been compared layer by layer. Calls have an
explicit unavailable state because Consumer has no qualified media transport.
The GIF provider, installed sticker library, inbox swipe actions, and Discover's
business directory are not yet wired to their reference flows. Camera, microphone,
and story publishing still require device and two-account acceptance.
