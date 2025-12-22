import axios from "axios";

const API_URL = "http://localhost:4000/api/video";
const MERGE_API_URL = "http://localhost:4000/api/merge";

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
