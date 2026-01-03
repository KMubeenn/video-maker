import { Router } from "express";
import {
  createRanking,
  generateFullPreview,
  preparePreview,
  generateWithRemotion,
} from "../controllers/ranking.controller.js";

const router = Router();

router.post("/create", createRanking);
router.post("/generate-preview", generateFullPreview);
router.post("/prepare-preview", preparePreview);
router.post("/generate-remotion", generateWithRemotion); // NEW: Remotion endpoint

export default router;
