# Docker Deployment Guide

This guide explains how to deploy the Video Maker application using Docker.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) installed
- [Docker Compose](https://docs.docker.com/compose/install/) installed

## Quick Start

### 1. Set up environment variables

**Server** (`server/.env`):

```bash
cp server/.env.example server/.env
# Edit server/.env with your Supabase credentials
```

**Client** - Environment variables are passed as build arguments. See the docker-compose.yml for how to configure them.

### 2. Build and run

```bash
# Build and start both services
docker compose up --build

# Run in detached mode (background)
docker compose up --build -d
```

### 3. Access the application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:4000

## Configuration

### Environment Variables

#### Server (`server/.env`)

| Variable              | Description                 | Required |
| --------------------- | --------------------------- | -------- |
| `SUPABASE_URL`        | Your Supabase project URL   | Yes      |
| `SUPABASE_SECRET_KEY` | Your Supabase secret key    | Yes      |
| `PORT`                | Server port (default: 4000) | No       |
| `NODE_ENV`            | Environment mode            | No       |

#### Client (Build Args in docker-compose.yml)

| Variable                        | Description                   | Required |
| ------------------------------- | ----------------------------- | -------- |
| `VITE_API_URL`                  | Backend API URL               | Yes      |
| `VITE_SUPABASE_URL`             | Your Supabase project URL     | Yes      |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Your Supabase publishable key | Yes      |

To set client environment variables, modify the `docker-compose.yml`:

```yaml
client:
  build:
    context: ./client
    dockerfile: Dockerfile
    args:
      - VITE_API_URL=http://your-server:4000/api
      - VITE_SUPABASE_URL=https://your-project.supabase.co
      - VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
```

## Included Dependencies

The Docker image includes the following video processing tools:

- **FFmpeg** - Video/audio processing
- **yt-dlp** - YouTube and social media video downloading
- **fonts-liberation** - Liberation Sans fonts for video text overlays

## Commands

### Build only

```bash
docker compose build
```

### Start services

```bash
docker compose up -d
```

### Stop services

```bash
docker compose down
```

### View logs

```bash
# All services
docker compose logs -f

# Server only
docker compose logs -f server

# Client only
docker compose logs -f client
```

### Rebuild a specific service

```bash
docker compose up --build server
docker compose up --build client
```

### Clean up

```bash
# Stop and remove containers, networks
docker compose down

# Also remove volumes
docker compose down -v

# Remove unused images
docker image prune -f
```

## Volumes

The server container mounts the following volumes for persistent data:

- `./server/outputs:/app/outputs` - Generated video outputs
- `./server/downloads:/app/downloads` - Downloaded video files

## Health Checks

Both services include health checks:

- **Server**: `GET /api/health` - Returns `{ status: "healthy", timestamp: "..." }`
- **Client**: HTTP request to port 80

## Troubleshooting

### Port conflicts

If ports 3000 or 4000 are in use, modify the ports in `docker-compose.yml`:

```yaml
ports:
  - "8080:80" # Change client port
  - "8000:4000" # Change server port
```

### Permission issues with volumes

On Linux, you may need to set appropriate permissions:

```bash
sudo chown -R 1000:1000 ./server/outputs ./server/downloads
```

### FFmpeg/yt-dlp issues

Check if the tools are properly installed in the container:

```bash
docker compose exec server ffmpeg -version
docker compose exec server yt-dlp --version
```

### Rebuilding after code changes

```bash
docker compose down
docker compose up --build -d
```
