# Audio Overlap Fix - Video Concatenation

## Problem

When concatenating multiple videos (in both ranking videos and general video merging), audio from one clip was bleeding into (overlapping with) the next clip. This created a confusing audio experience where sounds from different videos played simultaneously.

## Affected Functions

1. **`createRankingVideo()`** - Main ranking video creation with text overlays
2. **`concatenateVideos()`** - General video concatenation utility

Both functions were using the same problematic concat method.

## Root Cause

The original concatenation method used FFmpeg's **concat demuxer** with **stream copy** (`-c copy`):

```bash
ffmpeg -f concat -safe 0 -i filelist.txt -c copy output.mp4
```

**Why this caused issues:**

- `-c copy` copies video/audio streams **without re-encoding**
- This is fast but doesn't properly handle:
  - Different codec timing between videos
  - Audio/video sync boundaries
  - Timestamp discontinuities
- Result: Audio packets from one video could extend into the next video's timeline

## Solution

Switched to FFmpeg's **concat filter** with **re-encoding**:

```bash
ffmpeg -i video1.mp4 -i video2.mp4 -i video3.mp4 \
  -filter_complex "[0:v][0:a][1:v][1:a][2:v][2:a]concat=n=3:v=1:a=1[outv][outa]" \
  -map "[outv]" -map "[outa]" \
  -c:v libx264 -preset ultrafast -crf 28 \
  -c:a aac -b:a 128k \
  output.mp4
```

**How this fixes the issue:**

1. **Concat Filter**: Properly merges video and audio streams at the filter level
2. **Re-encoding**: Each clip's audio is cleanly cut and aligned to its video duration
3. **Explicit mapping**: Uses `-map "[outv]" -map "[outa]"` to ensure clean output streams
4. **Proper boundaries**: Audio from each clip ends exactly when that clip ends

## Technical Details

### Before (Concat Demuxer)

```typescript
ffmpeg()
  .input(fileListPath)
  .inputOptions(["-f concat", "-safe 0"])
  .outputOptions(["-c copy"]) // ❌ Stream copy - no re-encoding
  .output(outputPath);
```

### After (Concat Filter)

```typescript
// Build filter: [0:v][0:a][1:v][1:a]...[N:v][N:a]concat=n=N:v=1:a=1[outv][outa]
const inputCount = processedVideos.length;
let filterComplex = "";

for (let i = 0; i < inputCount; i++) {
  filterComplex += `[${i}:v][${i}:a]`;
}
filterComplex += `concat=n=${inputCount}:v=1:a=1[outv][outa]`;

const command = ffmpeg();

// Add each video as a separate input
processedVideos.forEach((videoPath) => {
  command.input(videoPath);
});

command
  .complexFilter(filterComplex)
  .outputOptions([
    "-map",
    "[outv]", // ✅ Map concatenated video
    "-map",
    "[outa]", // ✅ Map concatenated audio
    "-c:v",
    "libx264", // ✅ Re-encode video
    "-preset",
    "ultrafast",
    "-crf",
    "28",
    "-c:a",
    "aac", // ✅ Re-encode audio
    "-b:a",
    "128k",
  ])
  .output(outputPath);
```

## Performance Considerations

**Trade-off**: Re-encoding is slower than stream copy, but the difference is minimal because:

- Already using `-preset ultrafast` for fast encoding
- Higher CRF (28) for faster processing
- Audio is lightweight (128k bitrate)
- Quality is still good for preview/final output

**Benefit**: Clean, professional audio without overlaps is worth the small performance cost.

## Filter Breakdown

```
[0:v][0:a][1:v][1:a][2:v][2:a]concat=n=3:v=1:a=1[outv][outa]
```

- `[0:v]` - Video stream from first input
- `[0:a]` - Audio stream from first input
- `[1:v]` - Video stream from second input
- `[1:a]` - Audio stream from second input
- `concat=n=3` - Concatenate 3 inputs
- `:v=1` - 1 video stream output
- `:a=1` - 1 audio stream output
- `[outv]` - Output video stream label
- `[outa]` - Output audio stream label

## Testing

To verify the fix works:

1. **Create a ranking video with 3+ clips**
2. **Listen carefully at clip transitions**
3. **Verify**:
   - ✅ Audio from clip 1 stops when clip 1 ends
   - ✅ Audio from clip 2 starts cleanly when clip 2 starts
   - ✅ No overlap between clip boundaries
   - ✅ Clean transitions throughout

## Related Settings

The individual video processing already uses re-encoding with proper audio handling:

```typescript
.outputOptions([
  "-c:v libx264",
  "-preset ultrafast",
  "-crf 28",
  "-c:a aac",      // Audio codec
  "-b:a 128k",     // Audio bitrate
])
```

This ensures each processed video has clean audio before concatenation.

## Summary

✅ **Fixed**: Audio overlap between clips  
✅ **Method**: Switched from concat demuxer to concat filter  
✅ **Result**: Clean audio boundaries at every clip transition  
✅ **Cost**: Minimal performance impact due to ultrafast preset
