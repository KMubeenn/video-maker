import { useState, useEffect } from "react";
import { videoLibraryApi, type Video } from "../api/video-library.api";
import { VideoForm } from "./VideoForm";
import { CSVImport } from "./CSVImport";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  FileUp,
  Edit,
  Trash2,
  ExternalLink,
  CheckSquare,
  Square,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

interface VideoLibraryProps {
  teamId?: string;
}

export function VideoLibrary({ teamId }: VideoLibraryProps) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showCSVImport, setShowCSVImport] = useState(false);
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [selectedTags, setSelectedTags] = useState<string>("");
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);

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

  const handleAddVideo = async (video: Omit<Video, "id" | "created_at">) => {
    await videoLibraryApi.create(video);
    setShowForm(false);
    await loadVideos();
  };

  const handleUpdateVideo = async (video: Omit<Video, "id" | "created_at">) => {
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
      setSelectedVideos(new Set());
    } catch (err: any) {
      setError(err.message || "Failed to delete video");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedVideos.size === 0) return;
    if (
      !confirm(
        `Are you sure you want to delete ${selectedVideos.size} video(s)?`
      )
    )
      return;

    try {
      const deletePromises = Array.from(selectedVideos).map((id) =>
        videoLibraryApi.delete(id).catch((err) => {
          console.error(`Failed to delete video ${id}:`, err);
          return null;
        })
      );
      await Promise.all(deletePromises);
      await loadVideos();
      setSelectedVideos(new Set());
      setIsSelectMode(false);
    } catch (err: any) {
      setError(err.message || "Failed to delete videos");
    }
  };

  const handleToggleSelect = (videoId: string) => {
    const newSelected = new Set(selectedVideos);
    if (newSelected.has(videoId)) {
      newSelected.delete(videoId);
    } else {
      newSelected.add(videoId);
    }
    setSelectedVideos(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedVideos.size === filteredVideos.length) {
      setSelectedVideos(new Set());
    } else {
      setSelectedVideos(
        new Set(filteredVideos.filter((v) => v.id).map((v) => v.id!))
      );
    }
  };

  const handleCSVImport = async (csvData: string) => {
    await videoLibraryApi.importCSV(csvData, teamId);
    setShowCSVImport(false);
    await loadVideos();
  };

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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold tracking-tight">
          {teamId ? "Team Videos" : "My Videos"}
        </h1>
        <div className="flex gap-2">
          {isSelectMode ? (
            <>
              <Button
                onClick={handleSelectAll}
                variant="outline"
                className="transition-all duration-200 hover:bg-accent hover:border-primary/50 hover:shadow-md hover:scale-105"
              >
                {selectedVideos.size === filteredVideos.length ? (
                  <CheckSquare className="mr-2 h-4 w-4" />
                ) : (
                  <Square className="mr-2 h-4 w-4" />
                )}
                Select All
              </Button>
              <Button
                onClick={handleBulkDelete}
                variant="destructive"
                disabled={selectedVideos.size === 0}
                className="transition-all duration-200 hover:bg-destructive/90 hover:shadow-md hover:scale-105"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Selected ({selectedVideos.size})
              </Button>
              <Button
                onClick={() => {
                  setIsSelectMode(false);
                  setSelectedVideos(new Set());
                }}
                variant="outline"
                className="transition-all duration-200 hover:bg-accent hover:border-primary/50 hover:shadow-md hover:scale-105"
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={() => setIsSelectMode(true)}
                variant="outline"
                className="transition-all duration-200 hover:bg-accent hover:border-primary/50 hover:shadow-md hover:scale-105"
              >
                <CheckSquare className="mr-2 h-4 w-4" />
                Select
              </Button>
              <Button
                onClick={() => setShowForm(true)}
                className="transition-all duration-200 hover:shadow-lg hover:shadow-primary/30 hover:scale-105"
              >
                <Plus className="mr-2 h-4 w-4 transition-transform duration-200 group-hover:rotate-90" />
                Add Video
              </Button>
              <Button
                onClick={() => setShowCSVImport(true)}
                variant="outline"
                className="transition-all duration-200 hover:bg-accent hover:border-primary/50 hover:shadow-md hover:scale-105"
              >
                <FileUp className="mr-2 h-4 w-4 transition-transform duration-200 hover:translate-y-[-2px]" />
                Import CSV
              </Button>
            </>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="tag-filter">Filter by Tag</Label>
        <Input
          id="tag-filter"
          type="text"
          value={selectedTags}
          onChange={(e) => setSelectedTags(e.target.value)}
          placeholder="Enter tag to filter..."
          className="max-w-sm"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredVideos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">No videos found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredVideos.map((video) => (
            <Card
              key={video.id}
              className={cn(
                "transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-1 hover:border-primary/50 relative",
                isSelectMode &&
                  selectedVideos.has(video.id || "") &&
                  "border-primary border-2",
                isSelectMode && "cursor-pointer"
              )}
              onClick={() =>
                isSelectMode && video.id && handleToggleSelect(video.id)
              }
            >
              {isSelectMode && (
                <div className="absolute top-3 left-3 z-10">
                  <Checkbox
                    checked={selectedVideos.has(video.id || "")}
                    onCheckedChange={() => {
                      if (video.id) {
                        handleToggleSelect(video.id);
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-background shadow-md"
                  />
                </div>
              )}
              <CardHeader>
                <CardTitle className="line-clamp-2 transition-colors duration-200 hover:text-primary">
                  {video.title || video.clip_url.substring(0, 50)}
                </CardTitle>
                <CardDescription className="flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className="transition-all duration-200 hover:scale-105 hover:shadow-sm"
                  >
                    {video.source_platform}
                  </Badge>
                  {video.first && (
                    <Badge
                      variant="outline"
                      className="transition-all duration-200 hover:scale-105 hover:shadow-sm"
                    >
                      First
                    </Badge>
                  )}
                  {video.trim && (
                    <Badge
                      variant="outline"
                      className="transition-all duration-200 hover:scale-105 hover:shadow-sm"
                    >
                      Trim
                    </Badge>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <a
                    href={video.clip_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-1 transition-all duration-200 hover:text-primary/80 hover:gap-2"
                  >
                    View URL{" "}
                    <ExternalLink className="h-3 w-3 transition-transform duration-200 hover:scale-110" />
                  </a>
                </div>
                {video.tags && video.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {video.tags.map((tag, idx) => (
                      <Badge
                        key={idx}
                        variant="outline"
                        className="text-xs transition-all duration-200 hover:scale-105 hover:bg-accent hover:border-primary/50 cursor-default"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
                {video.notes && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    <strong>Notes:</strong> {video.notes}
                  </p>
                )}
                {!isSelectMode && (
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingVideo(video);
                      }}
                      className="flex-1 transition-all duration-200 hover:bg-primary hover:text-primary-foreground hover:border-primary hover:shadow-md hover:scale-105"
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        video.id && handleDeleteVideo(video.id);
                      }}
                      className="flex-1 transition-all duration-200 hover:bg-destructive/90 hover:shadow-md hover:scale-105"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
