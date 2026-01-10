import { Router } from "express";
import {
  createRanking,
  generateFullPreview,
} from "../controllers/ranking.controller.js";

const router = Router();

router.post("/create", createRanking);
router.post("/generate-preview", generateFullPreview);

export default router;
