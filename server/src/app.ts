import express from "express";
import cors from "cors";
import videoRoutes from "./routes/video.routes.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/video", videoRoutes);
app.use("/outputs", express.static("outputs"));

export default app;
