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

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  is_admin: boolean;
  created_at?: string;
}

export const adminApi = {
  listUsers: async () => {
    const response = await api.get("/admin/users");
    return response.data;
  },

  getUser: async (id: string) => {
    const response = await api.get(`/admin/users/${id}`);
    return response.data;
  },

  updateUserAdmin: async (id: string, isAdmin: boolean) => {
    const response = await api.put(`/admin/users/${id}/admin`, { is_admin: isAdmin });
    return response.data;
  },

  deleteUser: async (id: string) => {
    const response = await api.delete(`/admin/users/${id}`);
    return response.data;
  },
};

