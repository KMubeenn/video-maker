import { Router } from "express";
import { downloadSingleVideo } from "../controllers/download.controller.js";

const router = Router();

router.post("/video", downloadSingleVideo);

export default router;
