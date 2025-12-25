import { supabaseService } from "./supabase.service.js";

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  is_admin: boolean;
  created_at?: string;
}

export async function getAllUsers() {
  const { data, error } = await supabaseService
    .from("user_profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch users: ${error.message}`);
  }

  return data || [];
}

export async function getUserById(userId: string) {
  const { data, error } = await supabaseService
    .from("user_profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch user: ${error.message}`);
  }

  return data;
}

export async function updateUserAdminStatus(
  userId: string,
  isAdmin: boolean
) {
  const { data, error } = await supabaseService
    .from("user_profiles")
    .update({ is_admin: isAdmin })
    .eq("id", userId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update user: ${error.message}`);
  }

  return data;
}

export async function deleteUser(userId: string) {
  // Delete user from auth (this will cascade delete from user_profiles and other tables)
  const { error } = await supabaseService.auth.admin.deleteUser(userId);

  if (error) {
    throw new Error(`Failed to delete user: ${error.message}`);
  }

  return { success: true };
}

