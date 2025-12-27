# Server Dockerfile
# Multi-stage build for Node.js server with FFmpeg and yt-dlp

FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Production image
FROM node:22-bookworm-slim AS production

# Install FFmpeg, yt-dlp, and required dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    python3-pip \
    python3-venv \
    wget \
    ca-certificates \
    fonts-liberation \
    fontconfig \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp via pip (more up-to-date than apt)
RUN python3 -m pip install --break-system-packages yt-dlp

# Create app directory
WORKDIR /app

# Copy node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy source code
COPY . .

# Create necessary directories
RUN mkdir -p outputs downloads

# Set environment variables
ENV NODE_ENV=production
ENV PORT=4000

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget -q --spider http://localhost:4000/api/health || exit 1

# Start the server
CMD ["npx", "tsx", "src/server.ts"]
