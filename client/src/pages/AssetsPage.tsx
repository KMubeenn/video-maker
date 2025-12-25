import { useState, useEffect, useCallback } from "react";
import {
  uploadAsset,
  listAssets,
  deleteAsset,
  type Asset,
} from "../lib/assets";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Trash2, Music, Image as ImageIcon, Loader2 } from "lucide-react";

export function AssetsPage() {
  const [activeTab, setActiveTab] = useState<"audio" | "image">("audio");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Wrap loadAssets in useCallback to fix lint warning
  const loadAssets = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listAssets(activeTab);
      setAssets(data);
    } catch (error) {
      console.error("Failed to list assets:", error);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    setUploading(true);
    const file = e.target.files[0];
    try {
      await uploadAsset(file, activeTab);
      await loadAssets();
    } catch (error) {
      console.error("Failed to upload asset:", error);
      alert("Upload failed. Please try again.");
    } finally {
      setUploading(false);
      // Reset input
      e.target.value = "";
    }
  };

  const handleDelete = async (asset: Asset) => {
    if (!confirm(`Are you sure you want to delete "${asset.name}"?`)) return;

    try {
      await deleteAsset(asset.bucket, asset.id);
      setAssets(assets.filter((a) => a.id !== asset.id));
    } catch (error) {
      console.error("Failed to delete asset:", error);
      alert("Delete failed.");
    }
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Assets Library</h1>
          <p className="text-muted-foreground mt-2">
            Manage your audio clips and images for video creation.
          </p>
        </div>
        <div className="flex gap-2">
          {/* Simple Tab Switcher */}
          <Button
            variant={activeTab === "audio" ? "default" : "outline"}
            onClick={() => setActiveTab("audio")}
            className="gap-2"
          >
            <Music size={16} /> Audio
          </Button>
          <Button
            variant={activeTab === "image" ? "default" : "outline"}
            onClick={() => setActiveTab("image")}
            className="gap-2"
          >
            <ImageIcon size={16} /> Images
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle>
              Upload {activeTab === "audio" ? "Audio" : "Image"}
            </CardTitle>
            <CardDescription>
              {activeTab === "audio"
                ? "Supported formats: MP3, WAV, OGG"
                : "Supported formats: JPG, PNG, WEBP"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Input
                id="asset-upload"
                type="file"
                accept={activeTab === "audio" ? "audio/*" : "image/*"}
                onChange={handleUpload}
                disabled={uploading}
                className="max-w-md cursor-pointer"
              />
              {uploading && (
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="animate-spin" size={16} /> Uploading...
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Assets List */}
        <div>
          {loading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="animate-spin text-primary" size={32} />
            </div>
          ) : assets.length === 0 ? (
            <div className="text-center p-12 border border-dashed rounded-lg">
              <p className="text-muted-foreground">
                No assets found. Upload one to get started.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {assets.map((asset) => (
                <Card
                  key={asset.id}
                  className="overflow-hidden group hover:border-primary/50 transition-colors"
                >
                  <CardContent className="p-4">
                    <div className="aspect-video bg-muted rounded-md mb-3 flex items-center justify-center relative overflow-hidden">
                      {asset.type === "image" ? (
                        <img
                          src={asset.url}
                          alt={asset.name}
                          className="object-cover w-full h-full"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-primary">
                          <Music size={32} />
                          <audio
                            controls
                            className="w-full mt-2 absolute bottom-0 left-0"
                          >
                            <source src={asset.url} />
                          </audio>
                        </div>
                      )}
                    </div>
                    <div className="flex justify-between items-start gap-2">
                      <div className="overflow-hidden">
                        <h4
                          className="font-medium truncate text-sm"
                          title={asset.name}
                        >
                          {asset.name}
                        </h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          {(asset.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleDelete(asset)}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
