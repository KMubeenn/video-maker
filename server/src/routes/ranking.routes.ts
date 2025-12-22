import { Router } from "express";
import { createRanking } from "../controllers/ranking.controller.js";

const router = Router();

router.post("/create", createRanking);

export default router;
