# Handling Video Download Errors

## Common Download Issues

### Instagram Age-Restricted or Private Content

**Error**: `Content is age-restricted or unavailable for certain audiences`

**Causes**:

- The video is marked as sensitive/inappropriate content
- The video requires you to be logged in to view
- The account is private
- Geographic restrictions

**Solutions**:

#### 1. Skip Problematic Videos (✅ Already Implemented)

The system now automatically skips videos that fail to download and continues with the remaining videos. You'll see:

- ⚠️ Warning messages in the console showing which videos failed
- Response includes a `warnings` object with details about failed videos
- Video creation proceeds if at least 3 videos download successfully

#### 2. Use Instagram Authentication (Optional)

If you frequently encounter authentication issues, you can configure yt-dlp with Instagram credentials:

**Create a cookies file**:

1. Install a browser extension like "Get cookies.txt LOCALLY"
2. Log into Instagram in your browser
3. Export cookies for instagram.com
4. Save as `instagram-cookies.txt` in your project root

**Update the downloader service** to use cookies:

```typescript
// In downloadWithYtDlp function, modify the command:
const command = `yt-dlp --cookies "instagram-cookies.txt" --format "best[ext=mp4]/best" --output "${outputPath}" --no-playlist "${url}"`;
```

⚠️ **Security Note**: Never commit your cookies file to version control. Add it to `.gitignore`.

#### 3. Alternative: Use Different Video URLs

- Try using videos from public accounts only
- Ensure videos are not age-restricted
- Use YouTube or TikTok videos instead if possible

## Error Response Format

When videos fail to download, the API response includes:

```json
{
  "success": true,
  "videoUrl": "http://localhost:4000/uploads/ranking-xxx.mp4",
  "message": "Successfully created ranking video with 4 videos",
  "rankings": [...],
  "warnings": {
    "message": "1 video(s) were skipped due to download errors",
    "failedVideos": [
      {
        "url": "https://www.instagram.com/p/CT5RHeVI7Ct/",
        "index": 1,
        "error": "Content is age-restricted or unavailable for certain audiences",
        "platform": "instagram"
      }
    ]
  }
}
```

## Testing Your Setup

To verify the error handling works correctly:

1. **Test with a mix of valid and invalid URLs**:

   - Include 4-5 valid public video URLs
   - Add 1 private/restricted URL
   - System should skip the problematic one and create a video with the rest

2. **Test with all invalid URLs**:
   - System should return a 400 error
   - Response will include details about all failures

## Platform-Specific Issues

### YouTube

- Usually works reliably with ytdl-core
- May fail for age-restricted content or region-locked videos

### TikTok

- Requires yt-dlp to be installed
- May fail for private accounts
- Some regions may have access restrictions

### Instagram

- Most prone to authentication/restriction issues
- Public posts from public accounts work best
- Stories and Reels may have different access rules

## Debugging

Check the server console for detailed error messages:

```
⚠️  Warning: 1 video(s) failed to download:
  - Video 2 (https://www.instagram.com/p/CT5RHeVI7Ct/): Content is age-restricted or unavailable for certain audiences

Proceeding with 4 successful downloads
```
