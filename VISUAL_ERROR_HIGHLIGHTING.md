# Visual Error Highlighting for Failed Video Downloads

## Feature Overview

When a video fails to download (e.g., Instagram age-restricted content), the frontend now provides **immediate visual feedback** by highlighting the problematic video field in red, making it easy to identify and replace the failed video.

## Visual Indicators

### 1. **Red Border & Background**

- The entire video input group gets a red border
- Subtle red background tint
- Pulse animation on first appearance to draw attention

### 2. **Error Badge**

- Rank badge (#1, #2, etc.) turns **red with white text**
- Instead of the normal green styling

### 3. **Warning Icon**

- Platform icon (🎵, 📸, ▶️) is replaced with **⚠️ warning emoji**
- Also displayed in red

### 4. **Red URL Input Field**

- URL input border becomes red
- Light red background tint
- Red focus state when clicked

### 5. **Inline Error Message**

- **Below the URL input**, an inline error box appears
- Shows the specific error message from the backend
- Examples:
  - "Content is age-restricted or unavailable for certain audiences"
  - "Content is private and requires authentication"
  - "Video not available or has been removed"

## User Flow

### Before Fix (❌ Old Behavior)

1. User adds 5 video URLs
2. Video #2 is age-restricted
3. **Entire process fails** with generic error
4. User doesn't know which video caused the problem

### After Fix (✅ New Behavior)

1. User adds 5 video URLs
2. Video #2 is age-restricted
3. System generates video with 4 videos (#1, #3, #4, #5)
4. **Video #2 field is highlighted in red** with specific error message
5. User can immediately see which URL to replace
6. **When user updates the URL**, red highlighting automatically clears
7. User clicks "Regenerate Preview" to try again

## Error State Lifecycle

```
User generates preview
    ↓
API returns warnings with failed video indices
    ↓
Frontend stores failed indices in state
    ↓
Failed video fields render with red styling
    ↓
User modifies the URL or title of that video
    ↓
Error state for that specific field clears immediately
    ↓
Red highlighting removed
    ↓
User can regenerate preview
```

## Automatic Error Clearing

The error state **automatically clears** when:

- User changes the URL for that video
- User changes the title for that video
- User changes the number of videos
- User regenerates the preview

## CSS Classes Applied

When a video has an error:

- `.video-input-group.has-error` - Container
- `.rank-badge.error` - Rank badge
- `.input-icon.error` - Platform icon
- `.url-input.error` - URL input field
- `.inline-error-message` - Error message box

## Example Scenarios

### Scenario 1: Instagram Age-Restricted Video

**URL**: `https://www.instagram.com/p/CT5RHeVI7Ct/`  
**Error Message**: "Content is age-restricted or unavailable for certain audiences"  
**Visual**: Video #2 field highlighted in red with inline error message

### Scenario 2: Multiple Failures

If videos #2 and #4 both fail:

- Both fields show red highlighting
- Each shows its own specific error message
- User can fix them one at a time
- As each is fixed, its red highlighting disappears

### Scenario 3: All Videos Fail

- All fields show red
- Preview area shows "All video downloads failed" error
- User must fix at least 3 videos before generating

## Benefits

✅ **Clear Visual Feedback** - Immediately see which video failed  
✅ **Specific Error Messages** - Know exactly why it failed  
✅ **Easy to Fix** - Just replace the problematic URL  
✅ **Smart State Management** - Errors clear when you fix them  
✅ **No Manual Tracking** - System remembers which videos failed  
✅ **Professional UX** - Smooth animations and clear indicators
