import axios from "axios";
import { supabase } from "../lib/supabase";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

const api = axios.create({
  baseURL: API_URL,
});

// Add auth token to requests
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

export interface Video {
  id?: string;
  clip_url: string;
  tags: string[];
  first: boolean;
  trim: boolean;
  title?: string;
  source_platform: string;
  date_added?: string;
  notes?: string;
  user_id?: string;
  team_id?: string;
  created_at?: string;
  created_by: string;
}

export const videoLibraryApi = {
  list: async (teamId?: string) => {
    const params = teamId ? { team_id: teamId } : {};
    const response = await api.get("/videos", { params });
    return response.data;
  },

  get: async (id: string) => {
    const response = await api.get(`/videos/${id}`);
    return response.data;
  },

  create: async (video: Omit<Video, "id" | "created_at">) => {
    const response = await api.post("/videos", video);
    return response.data;
  },

  update: async (id: string, updates: Partial<Video>) => {
    const response = await api.put(`/videos/${id}`, updates);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/videos/${id}`);
    return response.data;
  },

  importCSV: async (csvData: string, teamId?: string) => {
    const response = await api.post("/videos/import", { csv_data: csvData, team_id: teamId });
    return response.data;
  },
};

