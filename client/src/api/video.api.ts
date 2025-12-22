import axios from "axios";

const API_URL = "http://localhost:4000/api/video";
const MERGE_API_URL = "http://localhost:4000/api/merge";
const RANKING_API_URL = "http://localhost:4000/api/ranking";

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
  title: TextSegment[]; // Changed from string to TextSegment[]
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
}

export const generateFullPreview = async (
  mainTitle: TextSegment[], // Changed from string to TextSegment[]
  videos: RankingVideoInput[],
  width?: number,
  height?: number
): Promise<PreviewVideoResponse> => {
  const res = await axios.post(`${RANKING_API_URL}/generate-preview`, {
    mainTitle,
    videos,
    width,
    height,
  });
  return res.data;
};
