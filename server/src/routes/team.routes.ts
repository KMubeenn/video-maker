import { Router } from "express";
import {
  createTeamController,
  listTeams,
  getTeam,
  listTeamMembers,
  addMember,
  removeMember,
  updateMemberRole,
  deleteTeamController,
  searchUserByEmail,
} from "../controllers/team.controller.js";
import { authenticateUser } from "../middleware/auth.middleware.js";

const router = Router();

// All routes require authentication
router.use(authenticateUser);

router.post("/", createTeamController);
router.get("/", listTeams);
router.get("/search-user", searchUserByEmail);
router.get("/:id", getTeam);
router.get("/:id/members", listTeamMembers);
router.post("/:id/members", addMember);
router.delete("/:id/members/:userId", removeMember);
router.put("/:id/members/:userId/role", updateMemberRole);
router.delete("/:id", deleteTeamController);

export default router;

