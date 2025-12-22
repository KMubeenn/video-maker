# Video Merger API Documentation

## Endpoints

### 1. Merge Videos from URLs

**Endpoint:** `POST /api/merge/merge`

**Description:** Downloads videos from TikTok, Instagram, or YouTube and merges them into a single video.

**Request Body:**

```json
{
  "urls": [
    "https://www.tiktok.com/@user/video/1234567890",
    "https://www.instagram.com/reel/ABCDEFG/",
    "https://youtube.com/shorts/xyz123"
  ]
}
```

**Requirements:**

- `urls`: Array of 2-4 valid video URLs
- Supported platforms: TikTok, Instagram, YouTube

**Response (Success):**

```json
{
  "success": true,
  "videoUrl": "http://localhost:4000/outputs/merged-1703234567890.mp4",
  "message": "Successfully merged 3 videos",
  "sources": [
    {
      "platform": "tiktok",
      "url": "https://www.tiktok.com/@user/video/1234567890"
    },
    {
      "platform": "instagram",
      "url": "https://www.instagram.com/reel/ABCDEFG/"
    },
    {
      "platform": "youtube",
      "url": "https://youtube.com/shorts/xyz123"
    }
  ]
}
```

**Response (Error):**

```json
{
  "error": "Failed to merge videos",
  "details": "Failed to download video 2/3: yt-dlp download failed: ..."
}
```

**Status Codes:**

- `200`: Success
- `400`: Invalid request (invalid URLs, wrong count, etc.)
- `500`: Server error (download failed, merge failed, etc.)

---

### 2. Create Video with Title (Legacy)

**Endpoint:** `POST /api/video/create`

**Description:** Adds a title overlay to an uploaded video.

**Request:** Multipart form data

- `video`: Video file (max 200MB)
- `title`: Text to overlay on the video

**Response:**

```json
{
  "success": true,
  "videoUrl": "http://localhost:4000/outputs/final-1703234567890.mp4"
}
```

---

## Error Handling

All endpoints return appropriate HTTP status codes and error messages:

- **400 Bad Request**: Invalid input (wrong URL format, missing fields, etc.)
- **500 Internal Server Error**: Processing failures (download errors, FFmpeg errors, etc.)

Error responses include:

- `error`: Short error message
- `details`: Detailed error information (when available)

---

## Notes

1. **yt-dlp Requirement**: TikTok and Instagram downloads require yt-dlp to be installed on the server
2. **Processing Time**: Video downloads and merging can take several seconds to minutes depending on:

   - Video sizes
   - Network speed
   - Number of videos
   - Server performance

3. **File Cleanup**: Downloaded source videos are automatically deleted after merging

4. **Output Location**: Merged videos are stored in the `outputs/` directory

5. **URL Formats**:
   - TikTok: `https://www.tiktok.com/@username/video/[id]` or `https://vt.tiktok.com/[shortcode]`
   - Instagram: `https://www.instagram.com/reel/[id]/` or `https://www.instagram.com/p/[id]/`
   - YouTube: `https://youtube.com/shorts/[id]` or `https://youtu.be/[id]`
