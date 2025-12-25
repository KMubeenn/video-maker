import type { MemeSound } from "../types/timeline";

const API_URL = "http://localhost:4000/api/meme-sounds";

export const memeSoundsApi = {
  list: async (): Promise<MemeSound[]> => {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error("Failed to fetch meme sounds");
    }
    return response.json();
  },
};
