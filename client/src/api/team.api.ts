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

export interface Team {
  id?: string;
  name: string;
  created_at?: string;
  created_by: string;
}

export interface TeamMember {
  id?: string;
  team_id: string;
  user_id: string;
  role: "admin" | "member";
  joined_at?: string;
  user_profiles?: {
    email: string;
    full_name?: string;
  };
}

export const teamApi = {
  create: async (name: string) => {
    const response = await api.post("/teams", { name });
    return response.data;
  },

  list: async () => {
    const response = await api.get("/teams");
    return response.data;
  },

  get: async (id: string) => {
    const response = await api.get(`/teams/${id}`);
    return response.data;
  },

  getMembers: async (id: string) => {
    const response = await api.get(`/teams/${id}/members`);
    return response.data;
  },

  addMember: async (teamId: string, userId: string) => {
    const response = await api.post(`/teams/${teamId}/members`, { user_id: userId });
    return response.data;
  },

  removeMember: async (teamId: string, userId: string) => {
    const response = await api.delete(`/teams/${teamId}/members/${userId}`);
    return response.data;
  },

  updateMemberRole: async (teamId: string, userId: string, role: "admin" | "member") => {
    const response = await api.put(`/teams/${teamId}/members/${userId}/role`, { role });
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/teams/${id}`);
    return response.data;
  },
};

