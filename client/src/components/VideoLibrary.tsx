import { useState, useEffect } from "react";
import { videoLibraryApi, type Video } from "../api/video-library.api";
import { VideoForm } from "./VideoForm";
import { CSVImport } from "./CSVImport";
import { useAuth } from "../hooks/useAuth";

interface VideoLibraryProps {
  teamId?: string;
}

export function VideoLibrary({ teamId }: VideoLibraryProps) {
  const { user } = useAuth();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showCSVImport, setShowCSVImport] = useState(false);
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [selectedTags, setSelectedTags] = useState<string>("");

  useEffect(() => {
    loadVideos();
  }, [teamId]);

  const loadVideos = async () => {
    try {
      setLoading(true);
      const data = await videoLibraryApi.list(teamId);
      setVideos(data);
    } catch (err: any) {
      setError(err.message || "Failed to load videos");
    } finally {
      setLoading(false);
    }
  };

  const handleAddVideo = async (video: Omit<Video, "id" | "created_at" | "created_by">) => {
    await videoLibraryApi.create(video);
    setShowForm(false);
    await loadVideos();
  };

  const handleUpdateVideo = async (video: Omit<Video, "id" | "created_at" | "created_by">) => {
    if (!editingVideo?.id) return;
    await videoLibraryApi.update(editingVideo.id, video);
    setEditingVideo(null);
    await loadVideos();
  };

  const handleDeleteVideo = async (id: string) => {
    if (!confirm("Are you sure you want to delete this video?")) return;
    try {
      await videoLibraryApi.delete(id);
      await loadVideos();
    } catch (err: any) {
      setError(err.message || "Failed to delete video");
    }
  };

  const handleCSVImport = async (csvData: string) => {
    await videoLibraryApi.importCSV(csvData, teamId);
    setShowCSVImport(false);
    await loadVideos();
  };

  // Get all unique tags
  const allTags = Array.from(
    new Set(videos.flatMap((v) => v.tags || []))
  ).sort();

  // Filter videos by tags
  const filteredVideos = selectedTags
    ? videos.filter((v) =>
        v.tags?.some((tag) =>
          tag.toLowerCase().includes(selectedTags.toLowerCase())
        )
      )
    : videos;

  if (showForm || editingVideo) {
    return (
      <VideoForm
        video={editingVideo || undefined}
        teamId={teamId}
        onSubmit={editingVideo ? handleUpdateVideo : handleAddVideo}
        onCancel={() => {
          setShowForm(false);
          setEditingVideo(null);
        }}
      />
    );
  }

  if (showCSVImport) {
    return (
      <CSVImport
        onImport={handleCSVImport}
        onCancel={() => setShowCSVImport(false)}
      />
    );
  }

  return (
    <div style={{ padding: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h1>{teamId ? "Team Videos" : "My Videos"}</h1>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={() => setShowForm(true)}
            style={{
              padding: "10px 20px",
              backgroundColor: "#007bff",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Add Video
          </button>
          <button
            onClick={() => setShowCSVImport(true)}
            style={{
              padding: "10px 20px",
              backgroundColor: "#28a745",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Import CSV
          </button>
        </div>
      </div>

      {error && (
        <div style={{ color: "red", marginBottom: "15px", padding: "10px", backgroundColor: "#f8d7da", borderRadius: "4px" }}>
          {error}
        </div>
      )}

      <div style={{ marginBottom: "15px" }}>
        <label style={{ display: "block", marginBottom: "5px" }}>
          Filter by Tag
        </label>
        <input
          type="text"
          value={selectedTags}
          onChange={(e) => setSelectedTags(e.target.value)}
          placeholder="Enter tag to filter..."
          style={{ width: "300px", padding: "8px", boxSizing: "border-box" }}
        />
      </div>

      {loading ? (
        <div>Loading videos...</div>
      ) : filteredVideos.length === 0 ? (
        <div>No videos found</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px" }}>
          {filteredVideos.map((video) => (
            <div
              key={video.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: "4px",
                padding: "15px",
              }}
            >
              <h3 style={{ marginTop: 0 }}>
                {video.title || video.clip_url.substring(0, 50)}
              </h3>
              <p>
                <strong>Platform:</strong> {video.source_platform}
              </p>
              <p>
                <strong>URL:</strong>{" "}
                <a href={video.clip_url} target="_blank" rel="noopener noreferrer">
                  {video.clip_url.substring(0, 50)}...
                </a>
              </p>
              {video.tags && video.tags.length > 0 && (
                <p>
                  <strong>Tags:</strong> {video.tags.join(", ")}
                </p>
              )}
              <p>
                <strong>First:</strong> {video.first ? "Yes" : "No"} |{" "}
                <strong>Trim:</strong> {video.trim ? "Yes" : "No"}
              </p>
              {video.notes && (
                <p>
                  <strong>Notes:</strong> {video.notes}
                </p>
              )}
              <div style={{ marginTop: "10px", display: "flex", gap: "10px" }}>
                <button
                  onClick={() => setEditingVideo(video)}
                  style={{
                    padding: "5px 10px",
                    backgroundColor: "#ffc107",
                    color: "black",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={() => video.id && handleDeleteVideo(video.id)}
                  style={{
                    padding: "5px 10px",
                    backgroundColor: "#dc3545",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

