import type { Request, Response } from "express";
import fs from "fs";
import path from "path";

const ASSETS_DIR = path.join(process.cwd(), "assets", "sounds");

export const listSounds = async (req: Request, res: Response) => {
  try {
    if (!fs.existsSync(ASSETS_DIR)) {
      // Create if it doesn't exist
      fs.mkdirSync(ASSETS_DIR, { recursive: true });
    }

    const files = await fs.promises.readdir(ASSETS_DIR);

    // Filter for audio files only
    const soundFiles = files.filter((file) =>
      /\.(mp3|wav|ogg|m4a)$/i.test(file)
    );

    const sounds = soundFiles.map((file) => ({
      id: file,
      name: file.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "), // Readable name
      filename: file,
      url: `http://localhost:4000/assets/sounds/${file}`,
    }));

    res.json(sounds);
  } catch (error) {
    console.error("Error listing sounds:", error);
    res.status(500).json({ error: "Failed to list sounds" });
  }
};
