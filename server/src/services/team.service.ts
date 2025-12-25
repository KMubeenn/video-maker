import { supabaseService } from "./supabase.service.js";

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
}

export async function createTeam(team: Team) {
  const { data, error } = await supabaseService
    .from("teams")
    .insert(team)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create team: ${error.message}`);
  }

  // Add creator as admin
  await supabaseService.from("team_members").insert({
    team_id: data.id,
    user_id: team.created_by,
    role: "admin",
  });

  return data;
}

export async function getTeamsByUser(userId: string) {
  const { data, error } = await supabaseService
    .from("team_members")
    .select("team_id, teams(*)")
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to fetch teams: ${error.message}`);
  }

  return (data || []).map((item: any) => item.teams).filter(Boolean);
}

export async function getTeamById(teamId: string, userId: string) {
  // Check if user is a member
  const { data: member } = await supabaseService
    .from("team_members")
    .select("role")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .single();

  if (!member) {
    throw new Error("Access denied: Not a team member");
  }

  const { data, error } = await supabaseService
    .from("teams")
    .select("*")
    .eq("id", teamId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch team: ${error.message}`);
  }

  return { ...data, userRole: member.role };
}

export async function getTeamMembers(teamId: string, userId: string) {
  // Check if user is a member
  const { data: member, error: memberError } = await supabaseService
    .from("team_members")
    .select("role")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .maybeSingle();

  if (memberError) {
    throw new Error(`Failed to check team membership: ${memberError.message}`);
  }

  if (!member) {
    throw new Error("Access denied: Not a team member");
  }

  // Fetch team members - explicitly select columns to avoid relationship auto-detection
  const { data: members, error: membersError } = await supabaseService
    .from("team_members")
    .select("id, team_id, user_id, role, joined_at")
    .eq("team_id", teamId);

  if (membersError) {
    throw new Error(`Failed to fetch team members: ${membersError.message}`);
  }

  if (!members || members.length === 0) {
    return [];
  }

  // Fetch user profiles for all members
  const userIds = members.map((m: any) => m.user_id);
  const { data: profiles, error: profilesError } = await supabaseService
    .from("user_profiles")
    .select("id, email, full_name")
    .in("id", userIds);

  if (profilesError) {
    throw new Error(`Failed to fetch user profiles: ${profilesError.message}`);
  }

  // Combine members with their profiles
  const profilesMap = new Map((profiles || []).map((p: any) => [p.id, p]));
  
  return members.map((member: any) => ({
    ...member,
    user_profiles: profilesMap.get(member.user_id) || null,
  }));
}

export async function addTeamMember(
  teamId: string,
  newUserId: string,
  adminUserId: string
) {
  // Check if requester is admin
  const { data: admin } = await supabaseService
    .from("team_members")
    .select("role")
    .eq("team_id", teamId)
    .eq("user_id", adminUserId)
    .single();

  if (!admin || admin.role !== "admin") {
    throw new Error("Access denied: Admin role required");
  }

  // Check if member already exists
  const { data: existing } = await supabaseService
    .from("team_members")
    .select("id")
    .eq("team_id", teamId)
    .eq("user_id", newUserId)
    .single();

  if (existing) {
    throw new Error("User is already a member of this team");
  }

  const { data, error } = await supabaseService
    .from("team_members")
    .insert({
      team_id: teamId,
      user_id: newUserId,
      role: "member",
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to add team member: ${error.message}`);
  }

  return data;
}

export async function removeTeamMember(
  teamId: string,
  targetUserId: string,
  requesterUserId: string
) {
  // Check if requester is admin or removing themselves
  if (targetUserId !== requesterUserId) {
    const { data: admin } = await supabaseService
      .from("team_members")
      .select("role")
      .eq("team_id", teamId)
      .eq("user_id", requesterUserId)
      .single();

    if (!admin || admin.role !== "admin") {
      throw new Error("Access denied: Admin role required");
    }
  }

  const { error } = await supabaseService
    .from("team_members")
    .delete()
    .eq("team_id", teamId)
    .eq("user_id", targetUserId);

  if (error) {
    throw new Error(`Failed to remove team member: ${error.message}`);
  }

  return { success: true };
}

export async function updateTeamMemberRole(
  teamId: string,
  targetUserId: string,
  newRole: "admin" | "member",
  adminUserId: string
) {
  // Check if requester is admin
  const { data: admin } = await supabaseService
    .from("team_members")
    .select("role")
    .eq("team_id", teamId)
    .eq("user_id", adminUserId)
    .single();

  if (!admin || admin.role !== "admin") {
    throw new Error("Access denied: Admin role required");
  }

  const { data, error } = await supabaseService
    .from("team_members")
    .update({ role: newRole })
    .eq("team_id", teamId)
    .eq("user_id", targetUserId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update team member role: ${error.message}`);
  }

  return data;
}

export async function deleteTeam(teamId: string, userId: string) {
  // Check if user is admin
  const { data: admin } = await supabaseService
    .from("team_members")
    .select("role")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .single();

  if (!admin || admin.role !== "admin") {
    throw new Error("Access denied: Admin role required");
  }

  const { error } = await supabaseService
    .from("teams")
    .delete()
    .eq("id", teamId);

  if (error) {
    throw new Error(`Failed to delete team: ${error.message}`);
  }

  return { success: true };
}

