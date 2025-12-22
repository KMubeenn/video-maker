# Video Merger - Setup Instructions

## Prerequisites

This application requires **yt-dlp** to be installed on your system for downloading videos from TikTok and Instagram.

### Installing yt-dlp on Windows

#### Option 1: Using Winget (Recommended)

```bash
winget install yt-dlp
```

#### Option 2: Using Chocolatey

```bash
choco install yt-dlp
```

#### Option 3: Manual Installation

1. Download the latest release from: https://github.com/yt-dlp/yt-dlp/releases
2. Download `yt-dlp.exe`
3. Place it in a directory that's in your PATH (e.g., `C:\Windows\System32`)

### Verify Installation

After installation, verify yt-dlp is working:

```bash
yt-dlp --version
```

## Installation

### Server

```bash
cd server
npm install
```

### Client

```bash
cd client
npm install
```

## Running the Application

### Start the Server

```bash
cd server
npm run dev
```

Server runs on: http://localhost:4000

### Start the Client

```bash
cd client
npm run dev
```

Client runs on: http://localhost:5173

## Features

- **Download videos** from TikTok, Instagram, and YouTube shorts
- **Merge 2-4 videos** into a single combined video
- **Beautiful UI** with modern design
- **Real-time processing** feedback

## Supported Platforms

- ✅ YouTube Shorts
- ✅ TikTok Videos
- ✅ Instagram Reels

## How to Use

1. Select how many videos you want to merge (2, 3, or 4)
2. Paste the URLs of your videos
3. Click "Merge Videos"
4. Wait for processing
5. Download your merged video!

## Troubleshooting

### "yt-dlp is not installed" error

- Make sure yt-dlp is installed and available in your PATH
- Restart your terminal/IDE after installation
- Run `yt-dlp --version` to verify

### Video download fails

- Check if the URL is valid and accessible
- Make sure the video is public
- Some platforms may have rate limiting

### FFmpeg errors

- Make sure FFmpeg is installed on your system
- Windows: Download from https://ffmpeg.org/download.html
- Or install via Chocolatey: `choco install ffmpeg`

## Tech Stack

### Backend

- Express.js
- FFmpeg (for video processing)
- ytdl-core (YouTube downloads)
- yt-dlp (TikTok & Instagram downloads)

### Frontend

- React
- TypeScript
- Vite
- Axios
