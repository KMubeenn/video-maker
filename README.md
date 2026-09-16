# ShortMaker

Build ranking-style short-form videos from existing clips. Paste a handful of TikTok,
Instagram, or YouTube links, give each one a title and a rank, and ShortMaker downloads
them, burns in the text overlays, and stitches everything into a single vertical video
ready to upload.

> **Status:** working personal project. The pipeline runs end to end, but it is built
> around a local FFmpeg/yt-dlp install and a Supabase project you provide yourself.

## What it does

- **Fetch** — pulls source clips from TikTok, Instagram, and YouTube via `yt-dlp`
- **Overlay** — a main title across the whole video plus per-clip titles and rank badges,
  rendered with FFmpeg's `drawtext` (font, colour, shadow, and word wrapping configurable)
- **Merge** — normalises and concatenates the clips into one output file
- **Preview** — a live preview component so you can see the layout before rendering
- **Library** — keeps rendered videos and their source metadata, with tagging and CSV import
- **Teams & admin** — Supabase-backed auth, team membership, and an admin panel

## Stack

| Layer | Choice |
|---|---|
| Client | React 19, Vite 7, TanStack Router, Tailwind CSS 4, Radix UI |
| Server | Express 5, TypeScript, `tsx` |
| Auth & data | Supabase |
| Media | FFmpeg (via `fluent-ffmpeg`), `yt-dlp`, `@distube/ytdl-core` |

```
client/   React SPA — routes, components, API layer
server/   Express API — controllers, services, routes
```

## Prerequisites

- Node.js 20+
- **FFmpeg** on your `PATH`
- **yt-dlp** on your `PATH` — see [SETUP.md](SETUP.md) for per-platform install steps
- A Supabase project

## Getting started

```bash
git clone https://github.com/KMubeenn/video-maker.git
cd video-maker
npm run install:all
```

Create the two env files from their examples:

```bash
cp client/.env.example client/.env
cp server/.env.example server/.env
```

| File | Keys |
|---|---|
| `client/.env` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_API_URL` |
| `server/.env` | `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `PORT` |

The server key is a **secret** service-role key — it stays server-side and must never be
committed. See [ENV_SETUP.md](ENV_SETUP.md) for where to find each value.

Then run both halves together:

```bash
npm run dev
```

Client on `http://localhost:5173`, API on `http://localhost:4000`.

## API

`POST /api/merge/merge` takes 2–4 video URLs and returns the merged result. Full request
and response shapes are in [API.md](API.md). Other routes: `/api/auth`, `/api/videos`,
`/api/teams`, `/api/admin`, `/api/ranking`, `/api/upload`. Rendered files are served from
`/outputs`, uploads from `/uploads`.

## Docker

A Compose setup for both services is in [DOCKER.md](DOCKER.md).

## Further reading

| Doc | Covers |
|---|---|
| [SETUP.md](SETUP.md) | Installing yt-dlp and FFmpeg |
| [ENV_SETUP.md](ENV_SETUP.md) | Supabase keys and env vars |
| [API.md](API.md) | Endpoint reference |
| [RANKING_GUIDE.md](RANKING_GUIDE.md) | How the ranking/overlay system works |
| [RICH_TEXT_IMPLEMENTATION.md](RICH_TEXT_IMPLEMENTATION.md) | Rich text overlay internals |
| [DOWNLOAD_ERRORS_GUIDE.md](DOWNLOAD_ERRORS_GUIDE.md) | Troubleshooting failed downloads |
| [AUDIO_OVERLAP_FIX.md](AUDIO_OVERLAP_FIX.md) | Notes on the audio overlap fix |
| [VISUAL_ERROR_HIGHLIGHTING.md](VISUAL_ERROR_HIGHLIGHTING.md) | Client-side error surfacing |
| [DOCKER.md](DOCKER.md) | Containerised setup |

## A note on source material

ShortMaker downloads third-party videos. Whether you may reuse a given clip is between you
and the platform's terms of service and the original creator — the tool does not check, and
using it does not grant you any rights to the material.

## License

[MIT](LICENSE)
