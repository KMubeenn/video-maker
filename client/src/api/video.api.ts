import axios from "axios";

const API_URL = "http://localhost:4000/api/video";
const MERGE_API_URL = "http://localhost:4000/api/merge";
const RANKING_API_URL = "http://localhost:4000/api/ranking";
const UPLOAD_API_URL = "http://localhost:4000/api/upload";

export const uploadVideoFile = async (
  file: File
): Promise<{ success: boolean; url: string; filename: string }> => {
  const formData = new FormData();
  formData.append("video", file);

  const res = await axios.post(`${UPLOAD_API_URL}/video`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return res.data;
};

export const createVideo = async (file: File, title: string) => {
  const formData = new FormData();
  formData.append("video", file);
  formData.append("title", title);

  const res = await axios.post(`${API_URL}/create`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return res.data;
};

export const mergeVideos = async (urls: string[]) => {
  const res = await axios.post(`${MERGE_API_URL}/merge`, { urls });
  return res.data;
};

// Text segment for rich formatting
export interface TextSegment {
  text: string;
  color?: string;
  fontSize?: number;
}

export interface RankingVideoInput {
  url: string;
  title: TextSegment[];
  trimStart?: number;
  trimEnd?: number;
  // Crop values (in source video pixels)
  cropX?: number;
  cropY?: number;
  cropWidth?: number;
  cropHeight?: number;
  memeSounds?: {
    file: string; // Absolute path or filename
    startTime: number; // Start time in seconds (relative to trim start)
    volume: number; // Volume multiplier
  }[];
}

export const createRankingVideo = async (
  mainTitle: TextSegment[], // Changed from string to TextSegment[]
  videos: RankingVideoInput[],
  width?: number,
  height?: number
) => {
  const res = await axios.post(`${RANKING_API_URL}/create`, {
    mainTitle,
    videos,
    width,
    height,
  });
  return res.data;
};

export interface PreviewVideoResponse {
  success: boolean;
  videoUrl: string;
  message: string;
  warnings?: {
    message: string;
    failedVideos: Array<{
      url: string;
      index: number;
      error: string;
      platform: string;
    }>;
  };
}

export const generateFullPreview = async (
  mainTitle: TextSegment[], // Changed from string to TextSegment[]
  videos: RankingVideoInput[],
  width?: number,
  height?: number,
  firstToPlay?: number | null
): Promise<PreviewVideoResponse> => {
  const res = await axios.post(`${RANKING_API_URL}/generate-preview`, {
    mainTitle,
    videos,
    width,
    height,
    firstToPlay: firstToPlay ?? undefined,
  });
  return res.data;
};

export interface PreparePreviewResponse {
  success: boolean;
  videos: Array<{
    id: number;
    url: string;
    originalUrl: string;
    duration: number;
    width: number;
    height: number;
  }>;
  warnings?: {
    message: string;
    failedVideos: Array<{
      url: string;
      index: number;
      error: string;
      platform: string;
    }>;
  };
}

export const preparePreview = async (
  videos: Array<{ url: string; id: number }>
): Promise<PreparePreviewResponse> => {
  const res = await axios.post(`${RANKING_API_URL}/prepare-preview`, {
    videos,
  });
  return res.data;
};
