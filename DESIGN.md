---
name: Fame Music Vault
version: 1.1.0
purpose: Design and product contract for the private music vault app.
platform: Cloudflare Workers + static assets + Cloudflare R2
primary_device: tablet
domain: x.d0ll.ca
storage_binding: VAULT_BUCKET
storage_bucket: song
tone: private, personal, calm, secure, music-centered
---

# DESIGN.md

This file is the design contract for the music vault. Future changes should use this as the source of truth so the app does not drift into a dashboard, file explorer, fake luxury landing page, or technical storage skin.

The vault is private personal music software for a long-running catalog. The main objects are songs, demos, albums, playable recordings, tracklist ideas, and attached material. Files are supporting evidence, not the main product surface.

## Product Standards

1. The app must feel like software, not a website.
2. The app must feel personal and organized without corny copy.
3. The UI must make a decade-long music collection feel held, readable, and playable.
4. Songs and Demos are the primary navigation.
5. Albums are primary because they organize songs into real music projects.
6. Beats, Tracklist, and Storage are secondary utility areas.
7. Upload and sync controls live in Storage, not on Home, Songs, or Demos.
8. Every action must visibly respond: upload, save, delete, sync, play, seek, scan, error.
9. GitHub contains code only. R2 contains music files only. No `.zip` package belongs in the repository.

## Visual Direction

The interface is true-neutral silver and graphite glass. It should feel tactile, reflective, clean, and tablet-native. It must not lean green, blue, brown, beige, warm, or muddy ash.

Use contrast through material depth: brighter edge highlights, neutral graphite inner surfaces, readable white text, and compact layout. Do not solve polish by adding slogans, giant logos, fake brand symbols, or decorative tech lines.

## Color Tokens

All neutral grays must be true grayscale or intentionally equal-channel RGB. Do not use green-dominant values where `G > R` and `G > B`.

```yaml
color:
  background:
    light: "#d8d8d8"
    mid: "#b6b6b6"
    deep: "#8a8a8a"
  text:
    primary: "#fbfbfb"
    secondary: "#e0e0e0"
    muted: "#a8a8a8"
    dark: "#151515"
  surface:
    rail_top: "rgba(112,112,112,.72)"
    rail_bottom: "rgba(58,58,58,.74)"
    card_base: "rgba(88,88,88,.34)"
    card_hover: "rgba(96,96,96,.42)"
    drawer: "rgba(74,74,74,.82)"
    player_top: "rgba(142,142,142,.74)"
    player_bottom: "rgba(96,96,96,.80)"
  border:
    strong: "rgba(251,251,251,.28)"
    soft: "rgba(251,251,251,.16)"
    card: "rgba(255,255,255,.24)"
    active: "rgba(255,255,255,.42)"
  action:
    primary_bg: "#f7f7f7"
    primary_text: "#151515"
    danger: "#ff6b6b"
```

Color rules:

- No green status color.
- No olive gray.
- No blue-gray text tokens for the main vault shell.
- Tracklist may retain its iTunes-like blue inside the embedded planner because that page intentionally preserves the imported iTunes UI.
- Danger red is allowed only for destructive actions and upload errors.

## Typography

```yaml
font:
  family: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif'
  headings:
    weight: 700
    max_letter_spacing: "-0.04em"
  body:
    size: "12px-14px"
  numbers:
    font_variant_numeric: tabular-nums
```

Rules:

- Song title is the primary text inside song cards.
- Metadata must be quiet and never sit directly under the title unless it adds immediate value.
- No oversized hero type inside compact panels, cards, drawers, filters, or the player.
- No fake luxury wording or marketing copy.

## Layout

```yaml
layout:
  sidebar_width: "168px desktop"
  page_padding: "24px desktop, 14px compact"
  card_radius: "8px"
  dock_radius: "14px"
  touch_target_min: "38px"
```

Rules:

- Avoid giant empty boxes.
- Month/date grouping should be a compact shelf label and divider, not a full-width bordered container.
- Song grids should use available width with multiple cards per row.
- Filters must be compact and visually secondary.
- The header should identify the page without wasting tablet space.
- The workspace must scroll with touch momentum.

## Navigation

Sidebar dock:

- Rounded dock, not a full rectangular slab.
- Scrollable when vertical space is tight.
- Home is icon-only.
- Storage is icon-only and sits in the utility area.
- Primary nav: Songs, Demos, Albums.
- Secondary nav: Beats, Tracklist.
- Secondary nav must be quieter than Songs/Demos/Albums.

Icon rules:

- Songs, Demos, Albums, Beats, and Tracklist use icons to the left of labels.
- Home and Storage use symbols only.
- Icons must be clean and readable at tablet size.
- Do not use awkward handmade symbols that look like placeholder SVGs.

## Home

Purpose: calm collection entrance.

Required:

- Show meaningful collection overview only.
- Show Songs and Demos clearly.
- Show Albums, Beats, or Tracklist only when they have useful content.
- No fake stats.
- No zero-value cards.

Forbidden:

- Add Folder.
- Upload controls.
- Sync controls.
- Folder rules.
- Storage repair warnings.
- Selected-song homepage.
- Marketing copy or slogans.

## Songs and Demos

Purpose: the main music collection.

Required:

- Compact page header.
- Compact search/status/sort controls.
- Sort options including newest made and other useful modes.
- Date-based organization by made date.
- Compact month shelf labels.
- Multiple song cards per row on wide screens.
- One play icon button on each card.
- One info icon button on each card.
- Duration when known.
- Made date based on the main audio/project rules below.
- Album stars when a song appears in albums.

Forbidden:

- Raw file path under song title.
- Text buttons that say Play or Info.
- Giant empty rows.
- Full-width empty month containers.
- Alphabet-only organization.
- Technical bloat at the top of the page.

## Song Card

Required:

- Play button.
- Display title.
- Duration.
- Made date.
- Info button.
- Useful badges only: Instrumental, stems, visuals, projects, Audio needed.
- Album stars if the song belongs to albums.

Album-star rule:

- One star per album.
- Each star has its own tooltip with that album title.
- Do not combine album names into one tooltip.

Date rule:

1. Main audio file date.
2. Closest matching main project file such as `.flp` or `.aup3`.
3. Other audio fallback.
4. Other project fallback.
5. Never use visual files to determine song date.

Audio-needed rule:

- A song with no audio but a project file still appears as a song.
- It should show `Audio needed`, not disappear.

## Details Drawer

Purpose: requested details only.

Rules:

- No permanent right-side panel.
- Opens only from info/requested action.
- Must preserve scroll position when opening.
- Scrollable.
- Stops above the player.

Required:

- Editable display title.
- Status, project, mood, notes.
- File groups: Versions, Instrumental, Stems, Visuals, Projects, Other.
- Delete individual file.
- Delete whole song.
- Confirm destructive actions.
- Save and delete actions show feedback.

## Albums

Definition: albums are playlist-like project collections. They do not move or duplicate R2 files.

Albums page:

- Primary sidebar item below Demos.
- 1:1 album cover cards.
- Cover is a record/CD-like square art surface, not a generic empty box.
- Album title, genre, and year appear below the cover.

Album detail:

- Edit title.
- Edit genre.
- Edit year.
- Choose cover from existing visual files.
- Auto-cover may use selected songs' best cover art.
- Select existing Songs/Demos.
- Save feedback is required.

Song card album membership:

- One star appears per album containing that song.
- Each star tooltip is that exact album title.

## Beats

Purpose: secondary standalone beat/instrumental area.

Rules:

- Beats is not as visually important as Songs or Demos.
- Attached beats/instrumentals inside song folders do not become standalone Beats.
- Only standalone beat entities belong here.
- No giant reports or loud pairing dashboards.

## Tracklist

Purpose: iTunes-style tracklist and rollout planning.

Rules:

- Preserve the imported iTunes-style UI.
- Remove Browse.
- Remove Publish.
- Remove Websim dependencies.
- Remove AI tools that depend on Websim or external unavailable services.
- Keep Library.
- Keep Rollout.
- Attach audio by choosing an existing vault song/demo, not by raw file upload.
- Portrait mode may reflow but must preserve the iTunes look.
- Track tables scroll instead of crushing.

## Storage

Purpose: imports, sync, export, and storage health.

Required:

- Add Folder.
- Add Files.
- Destination selector.
- Sync.
- Scan.
- Export.
- Upload progress dock.

Upload feedback:

- Total files.
- Current file.
- Uploaded/done count.
- Skipped count.
- Failed count.
- Full scrollable error list.
- Visible no-files-selected error.
- Visible auth/API errors.
- Continue individual-file failures.
- Rebuild/sync after upload.

Storage page tone:

- Useful and calm.
- Not a scary R2 admin clone.
- Not on Home.

## Player

Purpose: real playback, not a decorative footer.

Required:

- Appears only when a song is selected or playing.
- Can be dismissed/unselected.
- Uses song cover art when an intelligent matching cover exists.
- No fake art.
- Song title only, no tacky section/time subtitle.
- Play/pause.
- Previous track.
- Next track.
- Elapsed time.
- Total time.
- Progress bar.
- Tap/click to seek.
- Touch/pointer drag to scrub.
- Volume slider.
- Mute.
- Preserve current position on pause.
- Loading and error feedback.

Layout:

- Song identity left.
- Transport centered.
- Info/dismiss actions right.
- Portrait: reserve enough height and allow internal scroll if cramped.

## Cover Art Selection

Cover art should be intelligent:

1. Prefer visual files closest to the song title.
2. Prefer names containing `cover`, `official cover`, `single art`, or similar.
3. Avoid random visuals, clutter, screenshots, PSD previews, or unrelated images when a better match exists.
4. If no confident art exists, show no fake cover.

## Responsive Rules

Tablet/portrait is primary.

Required:

- Sidebar dock scrolls.
- Workspace scrolls.
- Player never covers content without reserved space.
- Player can scroll internally in tight portrait mode.
- Drawer bottom offset matches player height.
- Upload dock avoids player controls.
- Album editor stacks on narrow screens.
- Import controls stack on narrow screens.
- Tracklist iframe gets portrait-safe sizing.
- Tables and long controls scroll instead of clipping.

## Feedback Rules

Every action needs a visible state.

Required states:

- Loading.
- Success.
- Error.
- Empty.
- Disabled/busy.
- Partial failure.

Examples:

- Upload starts immediately with a progress dock.
- Upload failure lists the file and error.
- Sync failure shows a visible error.
- Delete confirms, then toasts.
- Save toasts.
- Playback load/error toasts.

## Authentication and Security

The password screen is not security by itself. Server routes must enforce authorization when `ADMIN_TOKEN` is set.

Required:

- API routes require `ADMIN_TOKEN` when configured.
- Object/audio/art URLs must include an authorized token path because media elements cannot send authorization headers.
- Deleting the unlock screen in DevTools must not expose R2 objects without a valid token.
- Keep unlocking simple for the private tablet use case.

## Storage and Entity Rules

Canonical R2 top-level folders:

- `Official/`
- `Demos/`
- `Beats/` only for standalone beats
- `vault/`

Never create:

- `official/`
- `demos/`
- root loose audio files
- album/container folders as song names
- stems as songs
- visuals as songs
- beat folders as songs when inside a song folder

Entity rules:

- Song/demo folder equals one entity except known containers.
- Demo containers create Demo entities.
- Album/container folders such as `SUPERSTAR` and `Songs` are not songs.
- Stems attach to parent song.
- Instrumentals/beats inside song folders attach to parent song.
- Visuals/art/clutter attach to parent song.
- Repeat uploads skip duplicates.
- Uploading more files into an existing song updates that entity.
- Edited display titles do not rename R2 objects.

## Repository Rules

Required repository files/folders:

- `src/`
- `dist/`
- `scripts/`
- `reference/`
- `package.json`
- `package-lock.json`
- `worker.js`
- `wrangler.jsonc`
- `README.md`
- `DESIGN.md`
- `STORAGE_CLEANUP_FIRST.md`

Do not commit:

- `music-vault-github-upload.zip`
- local song/audio files
- local export packages
- temporary test zips

## Cloudflare Build Rules

Cloudflare settings:

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Root directory: `/`
- R2 binding: `VAULT_BUCKET -> song`

Dependency rules:

- Keep `package.json` valid JSON.
- Keep `package-lock.json` matching.
- Do not add dependencies unless absolutely needed.
- Avoid React/Vite install chains that can hang Cloudflare builds.

## Copy Rules

Allowed labels:

- Home
- Music Vault
- Songs
- Demos
- Albums
- Beats
- Tracklist
- Storage
- Add Folder
- Add Files
- Sync
- Export
- Search
- Main
- Versions
- Stems
- Visuals
- Instrumental
- Audio needed

Forbidden:

- Slogans.
- Marketing copy.
- Fake luxury phrases.
- Fake vault roleplay.
- Folder rules on Home.
- Anything that sounds like selling the user their own music.

