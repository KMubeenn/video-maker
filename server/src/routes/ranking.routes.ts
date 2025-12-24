import { Router } from "express";
import {
  createRanking,
  generateFullPreview,
  preparePreview,
} from "../controllers/ranking.controller.js";

const router = Router();

router.post("/create", createRanking);
router.post("/generate-preview", generateFullPreview);
router.post("/prepare-preview", preparePreview);

export default router;
