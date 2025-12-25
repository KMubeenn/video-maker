import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload } from "lucide-react";

interface CSVImportProps {
  onImport: (csvData: string) => Promise<void>;
  onCancel: () => void;
}

export function CSVImport({ onImport, onCancel }: CSVImportProps) {
  const [csvData, setCsvData] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setCsvData(text);
      };
      reader.readAsText(selectedFile);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvData.trim()) {
      setError("Please provide CSV data or select a file");
      return;
    }

    setError("");
    setLoading(true);

    try {
      await onImport(csvData);
    } catch (err: any) {
      setError(err.message || "Failed to import CSV");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Videos from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file or paste CSV data to import multiple videos at once.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="csv-file">Upload CSV File</Label>
            <div className="flex items-center gap-2">
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                disabled={loading}
                className="cursor-pointer"
              />
              {file && (
                <span className="text-sm text-muted-foreground">{file.name}</span>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="csv-data">Or paste CSV data</Label>
            <Textarea
              id="csv-data"
              value={csvData}
              onChange={(e) => setCsvData(e.target.value)}
              rows={10}
              placeholder="Clip URL,Tags,First,Trim,Title,Source Platform,Date Added,Notes"
              className="font-mono text-sm"
              disabled={loading}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !csvData.trim()}>
              <Upload className="mr-2 h-4 w-4" />
              {loading ? "Importing..." : "Import"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

