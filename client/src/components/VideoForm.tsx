import { useState } from "react";
import type { Video } from "../api/video-library.api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface VideoFormProps {
  video?: Video;
  teamId?: string;
  onSubmit: (video: Omit<Video, "id" | "created_at">) => Promise<void>;
  onCancel: () => void;
}

export function VideoForm({ video, teamId, onSubmit, onCancel }: VideoFormProps) {
  const [formData, setFormData] = useState({
    clip_url: video?.clip_url || "",
    tags: video?.tags?.join(", ") || "",
    first: video?.first || false,
    trim: video?.trim || false,
    title: video?.title || "",
    source_platform: video?.source_platform || "",
    notes: video?.notes || "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const tags = formData.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);

      // Only include user_id, team_id, and created_by when creating (not updating)
      const videoData: any = {
        clip_url: formData.clip_url,
        tags,
        first: formData.first,
        trim: formData.trim,
        title: formData.title || undefined,
        source_platform: formData.source_platform,
        notes: formData.notes || undefined,
      };

      // Only add these fields when creating a new video (not when updating)
      if (!video) {
        videoData.user_id = teamId ? undefined : undefined; // Will be set by backend
        videoData.team_id = teamId || undefined;
        videoData.created_by = ""; // Will be set by backend
      }

      await onSubmit(videoData as Omit<Video, "id" | "created_at">);
    } catch (err: any) {
      setError(err.message || "Failed to save video");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{video ? "Edit Video" : "Add New Video"}</DialogTitle>
          <DialogDescription>
            {video ? "Update the video information below." : "Fill in the details to add a new video to your library."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="clip_url">
              Clip URL <span className="text-destructive">*</span>
            </Label>
            <Input
              id="clip_url"
              type="url"
              value={formData.clip_url}
              onChange={(e) => setFormData({ ...formData, clip_url: e.target.value })}
              required
              placeholder="https://..."
              disabled={loading}
              className="transition-all duration-200 focus:ring-2 focus:ring-primary/20 hover:border-primary/50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="source_platform">
              Source Platform <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.source_platform}
              onValueChange={(value) => setFormData({ ...formData, source_platform: value })}
              required
              disabled={loading}
            >
              <SelectTrigger id="source_platform" className="transition-all duration-200 hover:border-primary/50 hover:shadow-sm">
                <SelectValue placeholder="Select platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TikTok">TikTok</SelectItem>
                <SelectItem value="Instagram">Instagram</SelectItem>
                <SelectItem value="YouTube">YouTube</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Video title"
              disabled={loading}
              className="transition-all duration-200 focus:ring-2 focus:ring-primary/20 hover:border-primary/50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags">Tags (comma-separated)</Label>
            <Input
              id="tags"
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              placeholder="satisfying, trampoline, perfect"
              disabled={loading}
              className="transition-all duration-200 focus:ring-2 focus:ring-primary/20 hover:border-primary/50"
            />
          </div>

          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="first"
                checked={formData.first}
                onCheckedChange={(checked) => setFormData({ ...formData, first: checked as boolean })}
                disabled={loading}
              />
              <Label htmlFor="first" className="cursor-pointer transition-colors duration-200 hover:text-primary">
                First
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="trim"
                checked={formData.trim}
                onCheckedChange={(checked) => setFormData({ ...formData, trim: checked as boolean })}
                disabled={loading}
              />
              <Label htmlFor="trim" className="cursor-pointer transition-colors duration-200 hover:text-primary">
                Trim
              </Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              placeholder="Additional notes about this video..."
              disabled={loading}
              className="transition-all duration-200 focus:ring-2 focus:ring-primary/20 hover:border-primary/50"
            />
          </div>

          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={onCancel} 
              disabled={loading}
              className="transition-all duration-200 hover:bg-accent hover:border-primary/50 hover:shadow-md hover:scale-105"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
              className="transition-all duration-200 hover:shadow-lg hover:shadow-primary/30 hover:scale-105"
            >
              {loading ? "Saving..." : video ? "Update Video" : "Add Video"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

