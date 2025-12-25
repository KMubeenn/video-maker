import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import {
  createTeam,
  getTeamsByUser,
  getTeamById,
  getTeamMembers,
  addTeamMember,
  removeTeamMember,
  updateTeamMemberRole,
  deleteTeam,
} from "../services/team.service.js";
import { getUserByEmail } from "../services/user.service.js";

export async function createTeamController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Team name is required" });
    }

    const team = await createTeam({
      name,
      created_by: req.user.id,
    });

    res.status(201).json(team);
  } catch (error) {
    console.error("Create team error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}

export async function listTeams(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const teams = await getTeamsByUser(req.user.id);
    res.json(teams);
  } catch (error) {
    console.error("List teams error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}

export async function getTeam(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { id } = req.params;
    const team = await getTeamById(id, req.user.id);

    res.json(team);
  } catch (error) {
    console.error("Get team error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}

export async function listTeamMembers(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { id } = req.params;
    const members = await getTeamMembers(id, req.user.id);

    res.json(members);
  } catch (error) {
    console.error("List team members error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}

export async function addMember(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { id } = req.params;
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: "user_id is required" });
    }

    const member = await addTeamMember(id, user_id, req.user.id);
    res.status(201).json(member);
  } catch (error) {
    console.error("Add member error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}

export async function removeMember(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { id, userId } = req.params;
    await removeTeamMember(id, userId, req.user.id);

    res.json({ success: true });
  } catch (error) {
    console.error("Remove member error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}

export async function updateMemberRole(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { id, userId } = req.params;
    const { role } = req.body;

    if (!role || (role !== "admin" && role !== "member")) {
      return res
        .status(400)
        .json({ error: "role must be 'admin' or 'member'" });
    }

    const member = await updateTeamMemberRole(id, userId, role, req.user.id);
    res.json(member);
  } catch (error) {
    console.error("Update member role error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}

export async function deleteTeamController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { id } = req.params;
    await deleteTeam(id, req.user.id);

    res.json({ success: true });
  } catch (error) {
    console.error("Delete team error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}

export async function searchUserByEmail(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { email } = req.query;

    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Email query parameter is required" });
    }

    const user = await getUserByEmail(email);

    if (!user) {
      return res.status(404).json({ 
        error: "User not found with that email address. The user must be registered in the system first." 
      });
    }

    res.json(user);
  } catch (error) {
    console.error("Search user error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}

