import { Router } from "express";
import {
  listUsers,
  getUser,
  updateUserAdmin,
  deleteUserController,
} from "../controllers/admin.controller.js";
import { authenticateUser, requireAdmin } from "../middleware/auth.middleware.js";

const router = Router();

// All routes require authentication and admin role
router.use(authenticateUser);
router.use(requireAdmin);

router.get("/users", listUsers);
router.get("/users/:id", getUser);
router.put("/users/:id/admin", updateUserAdmin);
router.delete("/users/:id", deleteUserController);

export default router;

