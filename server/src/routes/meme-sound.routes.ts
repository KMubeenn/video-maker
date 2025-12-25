import express from "express";
import { listSounds } from "../controllers/meme-sound.controller.js";

const router = express.Router();

router.get("/", listSounds);

export default router;
