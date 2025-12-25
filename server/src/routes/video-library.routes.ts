import { Router } from "express";
import {
  listVideos,
  getVideo,
  addVideo,
  updateVideoController,
  removeVideo,
  importCSV,
} from "../controllers/video-library.controller.js";
import { authenticateUser } from "../middleware/auth.middleware.js";

const router = Router();

// All routes require authentication
router.use(authenticateUser);

router.get("/", listVideos);
router.get("/:id", getVideo);
router.post("/", addVideo);
router.put("/:id", updateVideoController);
router.delete("/:id", removeVideo);
router.post("/import", importCSV);

export default router;

