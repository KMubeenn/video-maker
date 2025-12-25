import { Router } from "express";
import {
  signup,
  login,
  getCurrentUser,
  logout,
} from "../controllers/auth.controller.js";
import { authenticateUser } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/signup", signup);
router.post("/login", login);
router.get("/me", authenticateUser, getCurrentUser);
router.post("/logout", authenticateUser, logout);

export default router;

