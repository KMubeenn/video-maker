import type { MemeSound } from "../types/timeline";
import { listAssets } from "../lib/assets";

export const memeSoundsApi = {
  list: async (): Promise<MemeSound[]> => {
    try {
      const assets = await listAssets("audio");

      return assets.map((asset) => ({
        id: asset.id,
        name: asset.name,
        filename: asset.name, // Mapping asset.name to filename
        url: asset.url,
      }));
    } catch (error) {
      console.error("Failed to fetch meme sounds from assets:", error);
      throw error;
    }
  },
};
