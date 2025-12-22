import { useState } from "react";
import "./RichTextInput.css";

export interface TextSegment {
  text: string;
  color?: string;
  fontSize?: number;
}

interface RichTextInputProps {
  value: TextSegment[];
  onChange: (segments: TextSegment[]) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
}

export function RichTextInput({
  value,
  onChange,
  placeholder = "Enter text...",
  label,
  disabled = false,
}: RichTextInputProps) {
  const [currentColor, setCurrentColor] = useState("white");
  const [currentSize, setCurrentSize] = useState(52);
  const [editingText, setEditingText] = useState("");
  const [isWordMode, setIsWordMode] = useState(false);

  // Get plain text from segments
  const getPlainText = () => {
    return value.map((seg) => seg.text).join("");
  };

  // Handle text changes - treat as single segment while typing
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setEditingText(newText);

    // In simple mode, always update (single segment)
    // This allows editing even if there are formatted segments in the background
    onChange([{ text: newText, color: currentColor, fontSize: currentSize }]);
  };

  // Apply color to entire text
  const applyColorToAll = (color: string) => {
    setCurrentColor(color);
    const text = editingText || getPlainText();
    onChange([{ text, color, fontSize: currentSize }]);
  };

  // Apply size to entire text
  const applySizeToAll = (size: number) => {
    setCurrentSize(size);
    const text = editingText || getPlainText();
    onChange([{ text, color: currentColor, fontSize: size }]);
  };

  // Split text into words for individual formatting
  const splitIntoWords = () => {
    // If we already have multiple segments (formatted), just switch to word mode
    if (value.length > 1) {
      setIsWordMode(true);
      setEditingText("");
      return;
    }

    const text = editingText || getPlainText();
    if (!text.trim()) return;

    // Split by whitespace but don't keep the whitespace segments
    const words = text.split(/\s+/).filter((word) => word.length > 0);

    const segments: TextSegment[] = [];

    words.forEach((word, index) => {
      // Add the word
      segments.push({
        text: word,
        color: "white",
        fontSize: 52,
      });

      // Add a space after each word except the last one
      if (index < words.length - 1) {
        segments.push({
          text: " ",
          color: "white",
          fontSize: 52,
        });
      }
    });

    onChange(segments);
    setEditingText("");
    setIsWordMode(true);
  };

  // Update a specific segment
  const updateSegment = (index: number, updates: Partial<TextSegment>) => {
    const newSegments = [...value];
    newSegments[index] = { ...newSegments[index], ...updates };
    onChange(newSegments);
  };

  // Go back to simple edit mode - DON'T destroy formatting!
  const backToSimpleMode = () => {
    setIsWordMode(false); // Just switch UI mode
    const fullText = getPlainText();
    setEditingText(fullText);
    // Don't call onChange - keep the segments intact for preview!
  };

  return (
    <div className="rich-text-input">
      {label && <label className="rich-text-label">{label}</label>}

      <div className="rich-text-toolbar">
        <div className="toolbar-group">
          <span className="toolbar-label">Color:</span>
          <button
            className="toolbar-btn color-btn"
            style={{ background: "white", color: "black" }}
            onClick={() => applyColorToAll("white")}
            disabled={disabled}
            title="White"
          >
            W
          </button>
          <button
            className="toolbar-btn color-btn"
            style={{ background: "#FFD700", color: "black" }}
            onClick={() => applyColorToAll("#FFD700")}
            disabled={disabled}
            title="Yellow"
          >
            Y
          </button>
          <button
            className="toolbar-btn color-btn"
            style={{ background: "#FF6B6B", color: "white" }}
            onClick={() => applyColorToAll("#FF6B6B")}
            disabled={disabled}
            title="Red"
          >
            R
          </button>
          <button
            className="toolbar-btn color-btn"
            style={{ background: "#4ECDC4", color: "black" }}
            onClick={() => applyColorToAll("#4ECDC4")}
            disabled={disabled}
            title="Cyan"
          >
            C
          </button>
          <button
            className="toolbar-btn color-btn"
            style={{ background: "#95E1D3", color: "black" }}
            onClick={() => applyColorToAll("#95E1D3")}
            disabled={disabled}
            title="Green"
          >
            G
          </button>
        </div>

        <div className="toolbar-group">
          <span className="toolbar-label">Size:</span>
          <button
            className="toolbar-btn size-btn"
            onClick={() => applySizeToAll(40)}
            disabled={disabled}
            title="Small (40px)"
          >
            S
          </button>
          <button
            className="toolbar-btn size-btn"
            onClick={() => applySizeToAll(52)}
            disabled={disabled}
            title="Medium (52px)"
          >
            M
          </button>
          <button
            className="toolbar-btn size-btn"
            onClick={() => applySizeToAll(64)}
            disabled={disabled}
            title="Large (64px)"
          >
            L
          </button>
        </div>
      </div>

      <div className="rich-text-instructions">
        💡 <strong>Tip:</strong> Type your text, then click "Split into Words"
        to format individual words with different colors/sizes
      </div>

      {!isWordMode ? (
        <>
          {/* Simple text editor mode */}
          <textarea
            className="rich-text-editor-simple"
            value={editingText || getPlainText()}
            onChange={handleTextChange}
            placeholder={placeholder}
            disabled={disabled}
          />
          <button
            className="split-words-btn"
            onClick={splitIntoWords}
            disabled={disabled || !getPlainText().trim()}
          >
            ✂️ Split into Words for Individual Formatting
          </button>
        </>
      ) : (
        <>
          {/* Word-by-word editor mode */}
          <div className="word-editor-container">
            {value
              .map((segment, index) => ({ segment, index }))
              .filter(({ segment }) => segment.text.trim().length > 0) // Hide space-only segments
              .map(({ segment, index }) => (
                <div key={index} className="word-segment">
                  <input
                    type="text"
                    className="word-input"
                    value={segment.text}
                    onChange={(e) =>
                      updateSegment(index, { text: e.target.value })
                    }
                    disabled={disabled}
                    style={{
                      color: segment.color || "white",
                      fontSize: `${((segment.fontSize || 52) / 52) * 1}rem`,
                    }}
                  />
                  <div className="word-controls">
                    <select
                      value={segment.color || "white"}
                      onChange={(e) =>
                        updateSegment(index, { color: e.target.value })
                      }
                      disabled={disabled}
                      className="word-color-select"
                    >
                      <option value="white">White</option>
                      <option value="#FFD700">Yellow</option>
                      <option value="#FF6B6B">Red</option>
                      <option value="#4ECDC4">Cyan</option>
                      <option value="#95E1D3">Green</option>
                    </select>
                    <select
                      value={segment.fontSize || 52}
                      onChange={(e) =>
                        updateSegment(index, {
                          fontSize: Number(e.target.value),
                        })
                      }
                      disabled={disabled}
                      className="word-size-select"
                    >
                      <option value={40}>Small</option>
                      <option value={52}>Medium</option>
                      <option value={64}>Large</option>
                    </select>
                  </div>
                </div>
              ))}
          </div>
          <button
            className="merge-words-btn"
            onClick={backToSimpleMode}
            disabled={disabled}
          >
            ← Back to Text Editor (keeps formatting)
          </button>
        </>
      )}

      <div className="rich-text-preview">
        {value.length === 0 || !getPlainText() ? (
          <span className="preview-placeholder">
            Preview will appear here...
          </span>
        ) : (
          <div style={{ whiteSpace: "pre-wrap" }}>
            {value.map((segment, index) => (
              <span
                key={index}
                style={{
                  color: segment.color || "white",
                  fontSize: `${(segment.fontSize || 52) / 3}px`,
                  fontFamily: "Impact, 'Arial Black', sans-serif",
                }}
              >
                {segment.text}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
