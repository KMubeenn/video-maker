import { Router } from "express";
import multer from "multer";
import { createVideo } from "../controllers/video.controller.js";

const router = Router();

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
});

router.post("/create", upload.single("video"), createVideo);

export default router;
