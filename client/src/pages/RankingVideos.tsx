import { useState, useRef, useMemo, useCallback } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { RankingComposition } from "../remotion/RankingComposition";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  generateFullPreview,
  uploadVideoFile,
  preparePreview,
  type TextSegment,
} from "../api/video.api";
import { RichTextInput } from "../components/RichTextInput";
import { RealtimePreview } from "../components/RealtimePreview";
import { VideoEditor } from "../components/VideoEditor";
import { SortableVideoCard } from "../components/SortableVideoCard";
import { type VideoMemeSound } from "../types/timeline";
import {
  type EditedClip,
  type PreviewState,
  createEmptyEditedClip,
  VideoPreviewPanel,
} from "../features/ranking";
import { buildRenderSpec } from "../features/ranking/utils/spec-builder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  RefreshCw,
  Upload,
  Scissors,
  Database,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  videoLibraryApi,
  type Video as VideoLibraryVideo,
} from "../api/video-library.api";
import { teamApi, type Team } from "../api/team.api";
import { useAuth } from "../hooks/useAuth";
import "./RankingVideos.css";

export default function RankingVideos() {
  const { user } = useAuth();
  const [mainTitle, setMainTitle] = useState<TextSegment[]>([
    { text: "", color: "white", fontSize: 64 }, // Medium (64px) default for main title
  ]);
  const [videoCount, setVideoCount] = useState<3 | 4 | 5 | 6>(3);
  const [videos, setVideos] = useState<EditedClip[]>([
    createEmptyEditedClip("1", 1),
    createEmptyEditedClip("2", 2),
    createEmptyEditedClip("3", 3),
  ]);
  const [width, setWidth] = useState(1080);
  const [height, setHeight] = useState(1920);
  const [error, setError] = useState("");
  const [failedVideoIndices, setFailedVideoIndices] = useState<Set<number>>(
    new Set()
  );

  // Drag-and-drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Build spec for Remotion Player
  const renderSpec = useMemo(
    () => buildRenderSpec(videos, mainTitle),
    [videos, mainTitle]
  );
  const durationInFrames = useMemo(() => {
    if (renderSpec.sequence.length === 0) return 30;
    const lastItem = renderSpec.sequence[renderSpec.sequence.length - 1];
    return lastItem.startFrame + lastItem.durationInFrames;
  }, [renderSpec]);

  // Sync Logic
  const playerRef = useRef<PlayerRef>(null);

  const handlePreviewTimeUpdate = useCallback((time: number) => {
    if (playerRef.current) {
      const frame = Math.round(time * 30);
      playerRef.current.seekTo(frame);
    }
  }, []);

  const handlePreviewPlayState = useCallback((isPlaying: boolean) => {
    if (playerRef.current) {
      if (isPlaying) {
        playerRef.current.play();
      } else {
        playerRef.current.pause();
      }
    }
  }, []);

  // Single preview state
  const [previewState, setPreviewState] = useState<PreviewState>({
    isGenerating: false,
    videoUrl: null,
    error: null,
  });

  // Toggle View State
  const [previewMode, setPreviewMode] = useState<"realtime" | "export">(
    "realtime"
  );

  // Handle drag end event
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setVideos((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
      // Clear preview when order changes
      setPreviewState({ isGenerating: false, videoUrl: null, error: null });
    }
  };

  const handleVideoCountChange = (count: 3 | 4 | 5 | 6) => {
    setVideoCount(count);
    const newVideos: EditedClip[] = [];
    for (let i = 0; i < count; i++) {
      // Preserve existing video if it exists, otherwise create new with stable slotIndex
      newVideos.push(
        videos[i] || createEmptyEditedClip((i + 1).toString(), i + 1)
      );
    }
    setVideos(newVideos);
    setError("");
    setFailedVideoIndices(new Set());
    // Clear preview when changing video count
    setPreviewState({ isGenerating: false, videoUrl: null, error: null });
  };

  const handleVideoChange = (
    index: number,
    field: "url" | "title",
    value: string | TextSegment[]
  ) => {
    const newVideos = [...videos];
    if (field === "url") {
      newVideos[index] = { ...newVideos[index], src: value as string };
    } else {
      newVideos[index] = { ...newVideos[index], title: value as TextSegment[] };
    }
    setVideos(newVideos);
    setError("");

    // Clear failed state for this specific video when it's changed
    setFailedVideoIndices((prev) => {
      const newSet = new Set(prev);
      newSet.delete(index);
      return newSet;
    });

    setPreviewState({ isGenerating: false, videoUrl: null, error: null });
  };

  // Editor State
  const [editingVideoIndex, setEditingVideoIndex] = useState<number | null>(
    null
  );

  const [loadingEditorIndex, setLoadingEditorIndex] = useState<number | null>(
    null
  );
  const [editorUrl, setEditorUrl] = useState<string | null>(null);

  const handleEditClick = async (index: number) => {
    const video = videos[index];
    if (!video.src) return;

    // Check if it's a local file (playable directly)
    const isLocal =
      video.src.includes("localhost") || video.src.startsWith("blob:");

    if (isLocal) {
      setEditorUrl(video.src);
      setEditingVideoIndex(index);
    } else {
      // It's an external URL (YouTube/Instagram) - we need to download/cache it first
      setLoadingEditorIndex(index);
      try {
        // Use preparePreview logic to get a playable local URL
        const response = await preparePreview([
          {
            url: video.src,
            id: parseInt(video.id), // Legacy API expects number ID
          },
        ]);

        if (response.success && response.videos.length > 0) {
          setEditorUrl(response.videos[0].url);
          setEditingVideoIndex(index);
        } else {
          setError(
            `Could not load video for editing: ${
              response.warnings?.message || "Unknown error"
            }`
          );
        }
      } catch (err: unknown) {
        console.error("Failed to prepare video for editing:", err);
        setError("Failed to load video for editing. Please try again.");
      } finally {
        setLoadingEditorIndex(null);
      }
    }
  };

  const handleSaveEdit = (
    start: number,
    end: number,
    cropX?: number,
    cropY?: number,
    cropWidth?: number,
    cropHeight?: number,
    memeSounds?: VideoMemeSound[],
    nativeWidth?: number,
    nativeHeight?: number
  ) => {
    if (editingVideoIndex === null) return;

    const newVideos = [...videos];
    const video = newVideos[editingVideoIndex];

    // Map legacy memeSounds from editor to AudioTrack[]
    const audioTracks =
      memeSounds?.map((ms) => ({
        src: ms.file,
        start: ms.startTime,
        volume: ms.volume ?? 1.0,
      })) || [];

    newVideos[editingVideoIndex] = {
      ...video,
      trim: { start, end },
      crop:
        cropX !== undefined &&
        cropY !== undefined &&
        cropWidth !== undefined &&
        cropHeight !== undefined
          ? { x: cropX, y: cropY, width: cropWidth, height: cropHeight }
          : undefined,
      audio: audioTracks,
      resolution:
        nativeWidth && nativeHeight
          ? { width: nativeWidth, height: nativeHeight }
          : video.resolution,
    };
    setVideos(newVideos);
    // Clear preview because trimming/cropping changed
    setPreviewState({ isGenerating: false, videoUrl: null, error: null });
  };

  // Upload Logic
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = (index: number) => {
    setUploadingIndex(index);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const index = uploadingIndex;
    if (index === null || !e.target.files || e.target.files.length === 0) {
      setUploadingIndex(null);
      return;
    }

    const file = e.target.files[0];
    try {
      // Optimistic logic: In a real app we might want to show a progress bar
      const result = await uploadVideoFile(file);
      if (result.success) {
        handleVideoChange(index, "url", result.url);
      } else {
        setError("Upload failed on server");
      }
    } catch (err) {
      console.error("Upload failed", err);
      setError("Failed to upload video");
    } finally {
      setUploadingIndex(null);
    }
  };

  // Generate full preview
  const handleGeneratePreview = async () => {
    const mainTitleText = mainTitle[0]?.text || "";
    if (!mainTitleText.trim()) {
      setPreviewState({
        isGenerating: false,
        videoUrl: null,
        error: "Please enter a main title first",
      });
      return;
    }

    const emptyTitles = videos.filter((v) => !v.title![0]?.text.trim());
    if (emptyTitles.length > 0) {
      setPreviewState({
        isGenerating: false,
        videoUrl: null,
        error: "Please enter titles for all videos",
      });
      return;
    }

    const emptyUrls = videos.filter((v) => !v.src.trim());
    if (emptyUrls.length > 0) {
      setPreviewState({
        isGenerating: false,
        videoUrl: null,
        error: "Please enter URLs for all videos",
      });
      return;
    }

    setPreviewState({ isGenerating: true, videoUrl: null, error: null });

    try {
      // Build RenderSpec for deterministic timing
      const fps = 30; // FFmpeg default
      const spec = buildRenderSpec(videos, mainTitle, fps);

      const response = await generateFullPreview(
        mainTitle,
        videos.map((v) => ({
          url: v.src,
          title: v.title!,
          videoNumber: v.slotIndex, // CRITICAL: immutable slot assignment for fixed positioning
          trimStart: v.trim?.start,
          trimEnd: v.trim?.end,
          // Include crop values for export
          cropX: v.crop?.x,
          cropY: v.crop?.y,
          cropWidth: v.crop?.width,
          cropHeight: v.crop?.height,
          memeSounds: v.audio?.map((a) => ({
            id: Math.random().toString(), // Helper for legacy API
            soundId: "custom",
            file: a.src,
            startTime: a.start,
            volume: a.volume ?? 1.0,
          })),
        })),
        width,
        height,
        spec
      );
      // Extract failed video indices from warnings
      const failedIndices = new Set<number>();
      if (response.warnings?.failedVideos) {
        response.warnings.failedVideos.forEach((failure) => {
          failedIndices.add(failure.index);
        });
      }

      setFailedVideoIndices(failedIndices);
      setPreviewState({
        isGenerating: false,
        videoUrl: response.videoUrl,
        error: null,
        warnings: response.warnings,
      });
    } catch (err: unknown) {
      const error = err as {
        response?: { data?: { details?: string; error?: string } };
      };
      const errorMessage =
        error.response?.data?.details ||
        error.response?.data?.error ||
        "Failed to generate preview";
      setPreviewState({
        isGenerating: false,
        videoUrl: null,
        error: errorMessage,
        warnings: undefined,
      });
    }
  };

  // Auto-populate from database
  const [showAutoPopulateDialog, setShowAutoPopulateDialog] = useState(false);
  const [availableVideos, setAvailableVideos] = useState<VideoLibraryVideo[]>(
    []
  );
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>("all");
  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(
    new Set()
  );

  const loadAvailableVideos = async () => {
    try {
      setLoadingVideos(true);
      // Load user videos
      const userVideos = await videoLibraryApi.list();

      // Load team videos from all teams user is a member of
      let teamVideos: VideoLibraryVideo[] = [];
      if (user?.id) {
        try {
          const teams = await teamApi.list();
          const teamVideoPromises = teams
            .filter((team: Team) => team.id) // Only process teams with IDs
            .map((team: Team) =>
              videoLibraryApi.list(team.id!).catch(() => [])
            );
          const allTeamVideos = await Promise.all(teamVideoPromises);
          teamVideos = allTeamVideos.flat();
        } catch (err) {
          // If team loading fails, just use user videos
          console.warn("Failed to load team videos:", err);
        }
      }

      // Combine and deduplicate by ID
      const allVideos = [...userVideos, ...teamVideos];
      const uniqueVideos = Array.from(
        new Map(allVideos.map((v) => [v.id, v])).values()
      );

      setAvailableVideos(uniqueVideos);
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to load videos");
    } finally {
      setLoadingVideos(false);
    }
  };

  const handleOpenAutoPopulate = () => {
    setShowAutoPopulateDialog(true);
    setSelectedVideoIds(new Set());
    setSelectedTagFilter("all");
    // Load videos when dialog opens - teamId can be passed from route or context
    loadAvailableVideos();
  };

  const handleAutoPopulate = () => {
    // Filter videos by selected tag if any
    let filteredVideos = availableVideos;
    if (selectedTagFilter && selectedTagFilter !== "all") {
      filteredVideos = availableVideos.filter((v) =>
        v.tags?.some((tag) =>
          tag.toLowerCase().includes(selectedTagFilter.toLowerCase())
        )
      );
    }

    // If specific videos are selected, use those; otherwise use filtered list
    const videosToUse =
      selectedVideoIds.size > 0
        ? filteredVideos.filter((v) => v.id && selectedVideoIds.has(v.id))
        : filteredVideos.slice(0, videoCount);

    // Populate videos array
    const newVideos: EditedClip[] = [];
    for (let i = 0; i < videoCount; i++) {
      const dbVideo = videosToUse[i];
      if (dbVideo) {
        // Convert database video to EditedClip format
        const titleSegments: TextSegment[] = dbVideo.title
          ? [{ text: dbVideo.title, color: "white", fontSize: 52 }] // Small (52px) default
          : [{ text: "", color: "white", fontSize: 52 }];

        newVideos.push({
          id: (i + 1).toString(),
          slotIndex: i + 1,
          src: dbVideo.clip_url,
          duration: 0, // Unknown initially
          title: titleSegments,
          audio: [],
        });
      } else {
        // Keep existing video or create empty one
        newVideos.push(
          videos[i] || createEmptyEditedClip((i + 1).toString(), i + 1)
        );
      }
    }
    setVideos(newVideos);
    setShowAutoPopulateDialog(false);
    setError("");
  };

  // Get unique tags from available videos
  const allTags = Array.from(
    new Set(availableVideos.flatMap((v) => v.tags || []))
  ).sort();

  // Filter videos for display in dialog
  const displayVideos =
    selectedTagFilter && selectedTagFilter !== "all"
      ? availableVideos.filter((v) =>
          v.tags?.some((tag) =>
            tag.toLowerCase().includes(selectedTagFilter.toLowerCase())
          )
        )
      : availableVideos;

  return (
    <div className="ranking-container">
      <div className="ranking-content">
        {/* Header spans both columns */}
        <div className="header">
          <h1 className="title">
            <span className="gradient-text">🏆 Video Ranking Creator</span>
          </h1>
          <p className="subtitle">
            Create stunning ranking videos with custom titles and overlays
          </p>
        </div>

        {/* Left Column - Controls */}
        <div className="controls-column">
          {/* Main Title Input */}
          <div className="main-title-section">
            <RichTextInput
              label="Main Video Title"
              value={mainTitle}
              onChange={setMainTitle}
              placeholder="e.g., Top 3 Most Viral TikToks of 2024"
              disabled={false}
              mainTitle
            />
          </div>

          {/* Video Count Selector */}
          <div className="count-selector">
            <Label className="section-label">Number of Videos</Label>
            <div className="count-buttons">
              {([3, 4, 5, 6] as const).map((count) => (
                <Button
                  key={count}
                  variant={videoCount === count ? "default" : "outline"}
                  className={cn(
                    "count-btn flex flex-col h-auto py-4",
                    videoCount === count && "active"
                  )}
                  onClick={() => handleVideoCountChange(count)}
                  disabled={false}
                >
                  <span className="count-number text-xl font-bold">
                    {count}
                  </span>
                  <span className="count-label text-xs">Videos</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Video Inputs */}
          <div className="videos-section">
            <div className="flex items-center justify-between mb-2">
              <Label className="section-label">Ranking Videos</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenAutoPopulate}
                className="gap-2"
              >
                <Database className="h-4 w-4" />
                Auto-populate from Library
              </Button>
            </div>
            <div className="drag-hint text-sm text-muted-foreground mb-3">
              💡 Drag videos to reorder • Top plays first, bottom plays last
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={videos.map((v) => v.id)}
                strategy={verticalListSortingStrategy}
              >
                {videos.map((video, index) => {
                  const hasFailed = failedVideoIndices.has(index);
                  const failureInfo = previewState.warnings?.failedVideos.find(
                    (f) => f.index === index
                  );

                  return (
                    <SortableVideoCard
                      key={video.id}
                      id={video.id}
                      className={cn(
                        "video-input-group mb-4",
                        hasFailed && "has-error"
                      )}
                    >
                      <div className="flex items-center mb-2 gap-2 w-full">
                        <Badge
                          variant={hasFailed ? "destructive" : "default"}
                          className={cn(
                            "rank-badge min-w-10 h-10 text-lg font-bold flex items-center justify-center shrink-0",
                            hasFailed && "error"
                          )}
                        >
                          #{video.slotIndex}
                        </Badge>
                        <div className="video-inputs flex-1">
                          <div className="flex items-center gap-2">
                            {hasFailed && (
                              <div
                                className={cn(
                                  "input-icon flex items-center justify-center",
                                  hasFailed && "error"
                                )}
                              >
                                "⚠️"
                              </div>
                            )}
                            <Input
                              type="url"
                              className={cn(
                                "url-input flex-1",
                                hasFailed && "error border-destructive"
                              )}
                              placeholder={`Video ${video.slotIndex} URL (TikTok, Instagram, YouTube)`}
                              value={video.src}
                              onChange={(e) =>
                                handleVideoChange(index, "url", e.target.value)
                              }
                              disabled={false}
                            />
                            <Button
                              variant="outline"
                              size="icon"
                              className="upload-icon-btn h-10 w-10"
                              onClick={() => handleUploadClick(index)}
                              disabled={uploadingIndex !== null}
                              title="Upload local video"
                            >
                              {uploadingIndex === index ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Upload className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="upload-icon-btn h-10 w-10"
                              onClick={() => handleEditClick(index)}
                              disabled={
                                !video.src || loadingEditorIndex === index
                              }
                              title="Trim/Edit Video"
                            >
                              {loadingEditorIndex === index ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Scissors className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                          {hasFailed && failureInfo && (
                            <Alert
                              variant="destructive"
                              className="inline-error-message mt-2"
                            >
                              <AlertDescription className="inline-error-text">
                                {failureInfo.error}
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                      </div>
                      <RichTextInput
                        value={video.title!}
                        onChange={(segments) =>
                          handleVideoChange(index, "title", segments)
                        }
                        placeholder={`Video ${video.slotIndex} Title`}
                        disabled={false}
                        size={52}
                      />
                    </SortableVideoCard>
                  );
                })}
              </SortableContext>
            </DndContext>
          </div>

          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            accept="video/*"
            onChange={handleFileChange}
          />

          {/* Video Dimensions */}
          <div className="dimensions-section">
            <Label className="section-label">Video Dimensions</Label>
            <div className="dimension-controls">
              <Button
                variant={
                  width === 1080 && height === 1920 ? "default" : "outline"
                }
                className={cn(
                  "dimension-btn flex flex-col h-auto py-4",
                  width === 1080 && height === 1920 && "active"
                )}
                onClick={() => {
                  setWidth(1080);
                  setHeight(1920);
                }}
                disabled={false}
              >
                <span className="dimension-icon text-2xl">📱</span>
                <span>Vertical</span>
                <span className="dimension-size text-xs">1080×1920</span>
              </Button>
              <Button
                variant={
                  width === 1920 && height === 1080 ? "default" : "outline"
                }
                className={cn(
                  "dimension-btn flex flex-col h-auto py-4",
                  width === 1920 && height === 1080 && "active"
                )}
                onClick={() => {
                  setWidth(1920);
                  setHeight(1080);
                }}
                disabled={false}
              >
                <span className="dimension-icon text-2xl">🖥️</span>
                <span>Horizontal</span>
                <span className="dimension-size text-xs">1920×1080</span>
              </Button>
              <Button
                variant={
                  width === 1080 && height === 1080 ? "default" : "outline"
                }
                className={cn(
                  "dimension-btn flex flex-col h-auto py-4",
                  width === 1080 && height === 1080 && "active"
                )}
                onClick={() => {
                  setWidth(1080);
                  setHeight(1080);
                }}
                disabled={false}
              >
                <span className="dimension-icon text-2xl">⬜</span>
                <span>Square</span>
                <span className="dimension-size text-xs">1080×1080</span>
              </Button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <Alert variant="destructive" className="error-message">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Regenerate Preview Button */}
          <div className="create-button-container">
            <Button
              className="create-button w-full"
              onClick={handleGeneratePreview}
              disabled={previewState.isGenerating}
              size="lg"
            >
              {previewState.isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-5 w-5" />
                  Regenerate Export
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Right Column - Preview (sticky) */}
        <div className="preview-column">
          <div className="preview-mode-toggle flex gap-2 mb-4">
            <Button
              variant={previewMode === "realtime" ? "default" : "outline"}
              className="flex-1"
              onClick={() => setPreviewMode("realtime")}
            >
              ⚡ Realtime Preview
            </Button>
            <Button
              variant={previewMode === "export" ? "default" : "outline"}
              className="flex-1"
              onClick={() => setPreviewMode("export")}
            >
              🎬 Final Export
            </Button>
          </div>

          {previewMode === "realtime" ? (
            <RealtimePreview
              mainTitle={mainTitle}
              videos={videos}
              width={width}
              height={height}
              onTimeUpdate={handlePreviewTimeUpdate}
              onPlayStateChange={handlePreviewPlayState}
            />
          ) : (
            <VideoPreviewPanel
              mainTitle={mainTitle}
              videos={videos}
              width={width}
              height={height}
              previewState={previewState}
              onGeneratePreview={handleGeneratePreview}
            />
          )}

          {/* Remotion Verification Player */}
          <div className="mt-8 border-t pt-8">
            <h3 className="text-lg font-semibold mb-4">
              Remotion Verification (Test)
            </h3>
            <div className="aspect-[9/16] w-full max-w-[360px] mx-auto bg-black border rounded-lg overflow-hidden shadow-xl">
              <Player
                component={RankingComposition}
                inputProps={{ spec: renderSpec }}
                durationInFrames={Math.max(1, durationInFrames)}
                compositionWidth={1080}
                compositionHeight={1920}
                fps={30}
                style={{
                  width: "100%",
                  height: "100%",
                }}
                ref={playerRef}
                controls
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              This player renders the same RenderSpec as the export.
            </p>
          </div>
        </div>
      </div>

      {editingVideoIndex !== null && (
        <VideoEditor
          url={editorUrl || videos[editingVideoIndex].src}
          isOpen={true}
          onClose={() => {
            setEditingVideoIndex(null);
            setEditorUrl(null);
          }}
          onSave={handleSaveEdit}
          initialTrimStart={videos[editingVideoIndex].trim?.start}
          initialTrimEnd={videos[editingVideoIndex].trim?.end}
          initialCropX={videos[editingVideoIndex].crop?.x}
          initialCropY={videos[editingVideoIndex].crop?.y}
          initialCropWidth={videos[editingVideoIndex].crop?.width}
          initialCropHeight={videos[editingVideoIndex].crop?.height}
          initialMemeSounds={videos[editingVideoIndex].audio?.map((a) => ({
            id: Math.random().toString(36).substr(2, 9),
            soundId: "custom",
            file: a.src,
            startTime: a.start,
            volume: a.volume ?? 1.0,
          }))}
        />
      )}

      {/* Auto-populate Dialog */}
      <Dialog
        open={showAutoPopulateDialog}
        onOpenChange={setShowAutoPopulateDialog}
      >
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Auto-populate from Video Library</DialogTitle>
            <DialogDescription>
              Select videos from your library to auto-populate the ranking. You
              can filter by tags and edit them after selection.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Tag Filter */}
            <div className="space-y-2">
              <Label>Filter by Tag (optional)</Label>
              <Select
                value={selectedTagFilter}
                onValueChange={setSelectedTagFilter}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All tags" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All tags</SelectItem>
                  {allTags.map((tag) => (
                    <SelectItem key={tag} value={tag}>
                      {tag}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Videos List */}
            {loadingVideos ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2">Loading videos...</span>
              </div>
            ) : displayVideos.length === 0 ? (
              <Alert>
                <AlertDescription>
                  No videos found
                  {selectedTagFilter && selectedTagFilter !== "all"
                    ? ` with tag "${selectedTagFilter}"`
                    : ""}
                  .
                  {selectedTagFilter && selectedTagFilter !== "all" && (
                    <Button
                      variant="link"
                      className="p-0 h-auto ml-1"
                      onClick={() => setSelectedTagFilter("all")}
                    >
                      Clear filter
                    </Button>
                  )}
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                <div className="text-sm text-muted-foreground mb-2">
                  {displayVideos.length} video(s) found. Select up to{" "}
                  {videoCount} videos or click "Populate All" to use the first{" "}
                  {videoCount}.
                </div>
                {displayVideos.slice(0, 20).map((video) => (
                  <div
                    key={video.id}
                    className={cn(
                      "flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-accent transition-colors",
                      selectedVideoIds.has(video.id || "") &&
                        "bg-accent border-primary"
                    )}
                    onClick={() => {
                      if (!video.id) return;
                      setSelectedVideoIds((prev) => {
                        const newSet = new Set(prev);
                        if (newSet.has(video.id!)) {
                          newSet.delete(video.id!);
                        } else {
                          if (newSet.size < videoCount) {
                            newSet.add(video.id!);
                          }
                        }
                        return newSet;
                      });
                    }}
                  >
                    <div
                      className={cn(
                        "w-5 h-5 border-2 rounded flex items-center justify-center",
                        selectedVideoIds.has(video.id || "") &&
                          "bg-primary border-primary"
                      )}
                    >
                      {selectedVideoIds.has(video.id || "") && (
                        <Check className="h-3 w-3 text-primary-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {video.title || "Untitled"}
                      </div>
                      <div className="text-sm text-muted-foreground truncate">
                        {video.clip_url}
                      </div>
                      {video.tags && video.tags.length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {video.tags.map((tag) => (
                            <Badge
                              key={tag}
                              variant="secondary"
                              className="text-xs"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {displayVideos.length > 20 && (
                  <div className="text-sm text-muted-foreground text-center py-2">
                    Showing first 20 videos. Use tag filter to narrow results.
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setShowAutoPopulateDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAutoPopulate}
                disabled={loadingVideos || displayVideos.length === 0}
              >
                {selectedVideoIds.size > 0
                  ? `Populate Selected (${selectedVideoIds.size})`
                  : `Populate First ${videoCount}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
