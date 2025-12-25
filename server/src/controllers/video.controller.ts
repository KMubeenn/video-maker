// import type { Request, Response } from "express";
// import { addTitleToVideo } from "../services/ffmpeg.service.js";

// export async function createVideo(req: Request, res: Response) {
//   if (!req.file) {
//     return res.status(400).json({ error: "No video uploaded" });
//   }

//   const { title } = req.body;

//   const outputFilename = `final-${Date.now()}.mp4`;

//   try {
//     const outputPath = await addTitleToVideo(
//       req.file.path,
//       title,
//       outputFilename
//     );

//     res.json({
//       success: true,
//       videoUrl: `http://localhost:4000/${outputPath}`,
//     });
//   } catch (err) {
//     console.error("Video processing failed:", err); // <--- IMPORTANT
//     res.status(500).json({ error: "Video processing failed" });
//   }
// }
