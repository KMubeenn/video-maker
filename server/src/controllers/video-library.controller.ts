import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import {
  getVideos,
  getVideoById,
  createVideo,
  updateVideo,
  deleteVideo,
  bulkCreateVideos,
  type Video,
} from "../services/video-library.service.js";
import Papa from "papaparse";

export async function listVideos(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const teamId = req.query.team_id as string | undefined;
    const videos = await getVideos(req.user.id, teamId);

    res.json(videos);
  } catch (error) {
    console.error("List videos error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}

export async function getVideo(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { id } = req.params;
    const video = await getVideoById(id, req.user.id);

    res.json(video);
  } catch (error) {
    console.error("Get video error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}

export async function addVideo(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const {
      clip_url,
      tags,
      first,
      trim,
      title,
      source_platform,
      notes,
      team_id,
    } = req.body;

    if (!clip_url || !source_platform) {
      return res
        .status(400)
        .json({ error: "clip_url and source_platform are required" });
    }

    const video: Video = {
      clip_url,
      tags: Array.isArray(tags) ? tags : tags ? [tags] : [],
      first: first === true || first === "true" || first === "TRUE",
      trim: trim === true || trim === "true" || trim === "TRUE",
      title: title || null,
      source_platform,
      notes: notes || null,
      user_id: team_id ? null : req.user.id,
      team_id: team_id || null,
      created_by: req.user.id,
    };

    const created = await createVideo(video);
    res.status(201).json(created);
  } catch (error) {
    console.error("Add video error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}

export async function updateVideoController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { id } = req.params;
    const updates = req.body;

    const updated = await updateVideo(id, updates, req.user.id);
    res.json(updated);
  } catch (error) {
    console.error("Update video error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}

export async function removeVideo(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { id } = req.params;
    await deleteVideo(id, req.user.id);

    res.json({ success: true });
  } catch (error) {
    console.error("Remove video error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}

export async function importCSV(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { csv_data, team_id } = req.body;

    if (!csv_data) {
      return res.status(400).json({ error: "csv_data is required" });
    }

    // Parse CSV
    const parsed = Papa.parse(csv_data, {
      header: true,
      skipEmptyLines: true,
    });

    if (parsed.errors.length > 0) {
      return res.status(400).json({
        error: "CSV parsing failed",
        details: parsed.errors,
      });
    }

    // Convert CSV rows to video objects
    const videos: Video[] = parsed.data.map((row: any) => {
      // Parse tags (comma-separated string or array)
      let tags: string[] = [];
      if (row.Tags) {
        if (typeof row.Tags === "string") {
          tags = row.Tags.split(",").map((tag: string) => tag.trim()).filter(Boolean);
        } else if (Array.isArray(row.Tags)) {
          tags = row.Tags;
        }
      }

      return {
        clip_url: row["Clip URL"] || row.clip_url,
        tags,
        first:
          row.First === "TRUE" ||
          row.First === "true" ||
          row.First === true ||
          row.first === true,
        trim:
          row.Trim === "TRUE" ||
          row.Trim === "true" ||
          row.Trim === true ||
          row.trim === true,
        title: row.Title || row.title || null,
        source_platform: row["Source Platform"] || row.source_platform || "Unknown",
        notes: row.Notes || row.notes || null,
        user_id: team_id ? null : req.user.id,
        team_id: team_id || null,
        created_by: req.user.id,
      };
    });

    // Filter out invalid videos
    const validVideos = videos.filter(
      (v) => v.clip_url && v.source_platform
    );

    if (validVideos.length === 0) {
      return res.status(400).json({ error: "No valid videos found in CSV" });
    }

    const created = await bulkCreateVideos(validVideos);
    res.status(201).json({
      message: `Imported ${created.length} videos`,
      videos: created,
    });
  } catch (error) {
    console.error("CSV import error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}

