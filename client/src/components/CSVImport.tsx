import { useState } from "react";

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
    <div style={{ maxWidth: "600px", margin: "0 auto" }}>
      <h2>Import Videos from CSV</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "15px" }}>
          <label style={{ display: "block", marginBottom: "5px" }}>
            Upload CSV File
          </label>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
          />
        </div>

        <div style={{ marginBottom: "15px" }}>
          <label style={{ display: "block", marginBottom: "5px" }}>
            Or paste CSV data
          </label>
          <textarea
            value={csvData}
            onChange={(e) => setCsvData(e.target.value)}
            rows={10}
            placeholder="Clip URL,Tags,First,Trim,Title,Source Platform,Date Added,Notes"
            style={{ width: "100%", padding: "8px", boxSizing: "border-box", fontFamily: "monospace" }}
          />
        </div>

        {error && (
          <div style={{ color: "red", marginBottom: "15px" }}>{error}</div>
        )}

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            type="submit"
            disabled={loading || !csvData.trim()}
            style={{
              padding: "10px 20px",
              backgroundColor: "#007bff",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Importing..." : "Import"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: "10px 20px",
              backgroundColor: "#6c757d",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

