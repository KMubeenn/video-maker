/**
 * Fetches metadata for a video URL.
 * Used to populate duration and resolution for Ranking videos.
 */
export async function getVideoMetadata(
  url: string
): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";

    const onLoadedMetadata = () => {
      resolve({
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
      });
      cleanup();
    };

    const onError = () => {
      reject(new Error(`Failed to load video metadata for ${url}`));
      cleanup();
    };

    const cleanup = () => {
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("error", onError);
      video.remove();
      video.src = "";
    };

    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("error", onError);
    video.src = url;
  });
}
