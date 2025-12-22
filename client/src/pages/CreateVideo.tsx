import { useState } from "react";
import { createVideo } from "../api/video.api";

export default function CreateVideo() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [videoUrl, setVideoUrl] = useState("");

  const handleSubmit = async () => {
    if (!file || !title) return alert("Select file and title");
    const result = await createVideo(file, title);
    setVideoUrl(result.videoUrl);
  };

  return (
    <div className="p-8">
      <h1>Create Video</h1>
      <input
        type="file"
        onChange={(e) => e.target.files && setFile(e.target.files[0])}
      />
      <input
        type="text"
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <button onClick={handleSubmit}>Create Video</button>

      {videoUrl && (
        <div>
          <h2>Output</h2>
          <video src={videoUrl} controls width={400} />
          <a href={videoUrl} download>
            Download
          </a>
        </div>
      )}
    </div>
  );
}
