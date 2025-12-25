import { useState } from "react";
import type { Video } from "../api/video-library.api";

interface VideoFormProps {
  video?: Video;
  teamId?: string;
  onSubmit: (video: Omit<Video, "id" | "created_at" | "created_by">) => Promise<void>;
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

      await onSubmit({
        clip_url: formData.clip_url,
        tags,
        first: formData.first,
        trim: formData.trim,
        title: formData.title || undefined,
        source_platform: formData.source_platform,
        notes: formData.notes || undefined,
        user_id: teamId ? undefined : undefined, // Will be set by backend
        team_id: teamId || undefined,
      });
    } catch (err: any) {
      setError(err.message || "Failed to save video");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: "600px", margin: "0 auto" }}>
      <div style={{ marginBottom: "15px" }}>
        <label style={{ display: "block", marginBottom: "5px" }}>
          Clip URL *
        </label>
        <input
          type="url"
          value={formData.clip_url}
          onChange={(e) => setFormData({ ...formData, clip_url: e.target.value })}
          required
          style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
        />
      </div>

      <div style={{ marginBottom: "15px" }}>
        <label style={{ display: "block", marginBottom: "5px" }}>
          Source Platform *
        </label>
        <select
          value={formData.source_platform}
          onChange={(e) => setFormData({ ...formData, source_platform: e.target.value })}
          required
          style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
        >
          <option value="">Select platform</option>
          <option value="TikTok">TikTok</option>
          <option value="Instagram">Instagram</option>
          <option value="YouTube">YouTube</option>
          <option value="Other">Other</option>
        </select>
      </div>

      <div style={{ marginBottom: "15px" }}>
        <label style={{ display: "block", marginBottom: "5px" }}>
          Tags (comma-separated)
        </label>
        <input
          type="text"
          value={formData.tags}
          onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
          placeholder="satisfying, trampoline, perfect"
          style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
        />
      </div>

      <div style={{ marginBottom: "15px" }}>
        <label style={{ display: "block", marginBottom: "5px" }}>
          Title
        </label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
        />
      </div>

      <div style={{ marginBottom: "15px", display: "flex", gap: "20px" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <input
            type="checkbox"
            checked={formData.first}
            onChange={(e) => setFormData({ ...formData, first: e.target.checked })}
          />
          First
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <input
            type="checkbox"
            checked={formData.trim}
            onChange={(e) => setFormData({ ...formData, trim: e.target.checked })}
          />
          Trim
        </label>
      </div>

      <div style={{ marginBottom: "15px" }}>
        <label style={{ display: "block", marginBottom: "5px" }}>
          Notes
        </label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3}
          style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
        />
      </div>

      {error && (
        <div style={{ color: "red", marginBottom: "15px" }}>{error}</div>
      )}

      <div style={{ display: "flex", gap: "10px" }}>
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "10px 20px",
            backgroundColor: "#007bff",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Saving..." : video ? "Update" : "Add Video"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: "10px 20px",
            backgroundColor: "#6c757d",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

