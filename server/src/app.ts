import express from "express";
import cors from "cors";
import videoRoutes from "./routes/video.routes.js";
import mergeRoutes from "./routes/merge.routes.js";
import rankingRoutes from "./routes/ranking.routes.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/video", videoRoutes);
app.use("/api/merge", mergeRoutes);
app.use("/api/ranking", rankingRoutes);
app.use("/outputs", express.static("outputs"));

export default app;
