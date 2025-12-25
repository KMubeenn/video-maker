import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import {
  getAllUsers,
  getUserById,
  updateUserAdminStatus,
  deleteUser,
} from "../services/user.service.js";

export async function listUsers(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const users = await getAllUsers();
    res.json(users);
  } catch (error) {
    console.error("List users error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}

export async function getUser(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { id } = req.params;
    const user = await getUserById(id);

    res.json(user);
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}

export async function updateUserAdmin(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { id } = req.params;
    const { is_admin } = req.body;

    if (typeof is_admin !== "boolean") {
      return res.status(400).json({ error: "is_admin must be a boolean" });
    }

    const user = await updateUserAdminStatus(id, is_admin);
    res.json(user);
  } catch (error) {
    console.error("Update user admin error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}

export async function deleteUserController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { id } = req.params;

    // Prevent self-deletion
    if (id === req.user.id) {
      return res.status(400).json({ error: "Cannot delete yourself" });
    }

    await deleteUser(id);
    res.json({ success: true });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}

