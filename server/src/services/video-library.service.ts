import { supabaseService } from "./supabase.service.js";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";

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

export async function getVideos(userId: string, teamId?: string) {
  let query = supabaseService
    .from("videos")
    .select("*")
    .order("created_at", { ascending: false });

  if (teamId) {
    query = query.eq("team_id", teamId);
  } else {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch videos: ${error.message}`);
  }

  return data || [];
}

export async function getVideoById(videoId: string, userId: string) {
  const { data, error } = await supabaseService
    .from("videos")
    .select("*")
    .eq("id", videoId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch video: ${error.message}`);
  }

  // Check if user has access
  if (data.user_id !== userId && data.team_id) {
    // Check team membership
    const { data: member } = await supabaseService
      .from("team_members")
      .select("user_id")
      .eq("team_id", data.team_id)
      .eq("user_id", userId)
      .single();

    if (!member) {
      throw new Error("Access denied");
    }
  } else if (data.user_id !== userId) {
    throw new Error("Access denied");
  }

  return data;
}

export async function createVideo(video: Video) {
  const { data, error } = await supabaseService
    .from("videos")
    .insert(video)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create video: ${error.message}`);
  }

  return data;
}

export async function updateVideo(
  videoId: string,
  updates: Partial<Video>,
  userId: string
) {
  // First check access
  await getVideoById(videoId, userId);

  const { data, error } = await supabaseService
    .from("videos")
    .update(updates)
    .eq("id", videoId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update video: ${error.message}`);
  }

  return data;
}

export async function deleteVideo(videoId: string, userId: string) {
  // First check access
  await getVideoById(videoId, userId);

  const { error } = await supabaseService
    .from("videos")
    .delete()
    .eq("id", videoId);

  if (error) {
    throw new Error(`Failed to delete video: ${error.message}`);
  }

  return { success: true };
}

export async function bulkCreateVideos(videos: Video[]) {
  const { data, error } = await supabaseService
    .from("videos")
    .insert(videos)
    .select();

  if (error) {
    throw new Error(`Failed to create videos: ${error.message}`);
  }

  return data || [];
}

