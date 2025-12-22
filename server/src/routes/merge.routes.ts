import { Router } from "express";
import { mergeVideosFromUrls } from "../controllers/merge.controller.js";

const router = Router();

router.post("/merge", mergeVideosFromUrls);

export default router;
