import express from "express";
import cors from "cors";
import rankingRoutes from "./routes/ranking.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import authRoutes from "./routes/auth.routes.js";
import videoLibraryRoutes from "./routes/video-library.routes.js";
import teamRoutes from "./routes/team.routes.js";
import memeSoundRoutes from "./routes/meme-sound.routes.js";
import adminRoutes from "./routes/admin.routes.js";

const app = express();

app.use(cors());
app.use(express.json());

// Auth routes (public)
app.use("/api/auth", authRoutes);

// Protected routes
app.use("/api/videos", videoLibraryRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/meme-sounds", memeSoundRoutes);

// Existing routes
app.use("/api/ranking", rankingRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/outputs", express.static("outputs"));
app.use("/uploads", express.static("uploads"));
app.use("/assets", express.static("assets"));

// Trigger server restart
console.log("Server restarting...");

export default app;
