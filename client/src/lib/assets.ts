import { supabase } from "./supabase";

export interface Asset {
  id: string; // The path in storage
  bucket: string; // The bucket name
  name: string;
  url: string;
  type: "audio" | "image";
  size: number;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

const BUCKET_MAP = {
  audio: "sounds",
  image: "images",
};

/**
 * Uploads an asset to Supabase Storage.
 * Renames the file to ensure uniqueness.
 */
export async function uploadAsset(
  file: File,
  type: "audio" | "image"
): Promise<Asset> {
  const bucket = BUCKET_MAP[type];
  console.log(`[Assets] Uploading to bucket: ${bucket}`);

  // 1. Sanitize and create unique filename
  const timestamp = Date.now();
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const filePath = `${timestamp}-${sanitizedName}`;

  // 2. Upload
  const { error } = await supabase.storage.from(bucket).upload(filePath, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (error) {
    console.error(`[Assets] Upload error to ${bucket}:`, error);
    throw error;
  }

  // 3. Get Public URL
  const { data: publicUrlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(filePath);

  return {
    id: filePath,
    bucket,
    name: file.name,
    url: publicUrlData.publicUrl,
    type,
    size: file.size,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Lists assets from a specific bucket (audio -> sounds, image -> images).
 */
export async function listAssets(type: "audio" | "image"): Promise<Asset[]> {
  const bucket = BUCKET_MAP[type];
  console.log(`[Assets] Listing from bucket: ${bucket}`);

  const { data, error } = await supabase.storage.from(bucket).list("", {
    // List root of the bucket
    sortBy: { column: "created_at", order: "desc" },
  });

  if (error) {
    console.error(`[Assets] List error from ${bucket}:`, error);
    throw error;
  }

  if (!data) return [];

  return data.map((item) => {
    const filePath = item.name; // In root
    const { data: publicUrlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return {
      id: filePath,
      bucket,
      name: item.name.replace(/^\d+-/, "").replace(/_/g, " "),
      url: publicUrlData.publicUrl,
      type,
      size: item.metadata?.size || 0,
      createdAt: item.created_at,
      metadata: item.metadata,
    };
  });
}

/**
 * Deletes an asset by its path and bucket.
 */
export async function deleteAsset(bucket: string, path: string): Promise<void> {
  console.log(`[Assets] Deleting from bucket: ${bucket}, path: ${path}`);
  const { error } = await supabase.storage.from(bucket).remove([path]);

  if (error) {
    throw error;
  }
}
