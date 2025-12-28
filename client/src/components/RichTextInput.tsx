import { useState, useRef } from "react";
import "./RichTextInput.css";
import { EmojiPickerButton } from "./EmojiPickerButton";

export interface TextSegment {
  text: string;
  color?: string;
  fontSize?: number;
  hasBorder?: boolean; // Enable yellow border around text
}

interface RichTextInputProps {
  value: TextSegment[];
  onChange: (segments: TextSegment[]) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  mainTitle?: boolean;
}

export function RichTextInput({
  value,
  onChange,
  placeholder = "Enter text...",
  label,
  disabled = false,
  mainTitle = false,
}: RichTextInputProps) {
  const [currentColor, setCurrentColor] = useState("white");
  const [currentSize, setCurrentSize] = useState(64); // Default to Medium (64px)
  const [currentBorder, setCurrentBorder] = useState(true); // Enable border by default
  const [editingText, setEditingText] = useState("");
  const [isWordMode, setIsWordMode] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    onChange([
      {
        text: newText,
        color: currentColor,
        fontSize: currentSize,
        hasBorder: currentBorder,
      },
    ]);
  };

  // Apply color to entire text
  const applyColorToAll = (color: string) => {
    setCurrentColor(color);
    const text = editingText || getPlainText();
    onChange([
      { text, color, fontSize: currentSize, hasBorder: currentBorder },
    ]);
  };

  // Apply size to entire text
  const applySizeToAll = (size: number) => {
    setCurrentSize(size);
    const text = editingText || getPlainText();
    onChange([
      { text, color: currentColor, fontSize: size, hasBorder: currentBorder },
    ]);
  };

  // Toggle border on/off
  const toggleBorder = () => {
    const newBorder = !currentBorder;
    setCurrentBorder(newBorder);
    const text = editingText || getPlainText();
    onChange([
      {
        text,
        color: currentColor,
        fontSize: currentSize,
        hasBorder: newBorder,
      },
    ]);
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
        fontSize: 64, // Default to Medium
        hasBorder: currentBorder,
      });

      // Add a space after each word except the last one
      if (index < words.length - 1) {
        segments.push({
          text: " ",
          color: "white",
          fontSize: 64, // Default to Medium
          hasBorder: currentBorder,
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

  // Handle emoji insertion at cursor position
  const handleEmojiInsert = (emoji: string) => {
    const textarea = textareaRef.current;
    const currentText = editingText || getPlainText();

    let newText: string;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      newText = currentText.slice(0, start) + emoji + currentText.slice(end);

      // Restore cursor position after emoji
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + emoji.length, start + emoji.length);
      }, 0);
    } else {
      newText = currentText + emoji;
    }

    setEditingText(newText);
    onChange([
      {
        text: newText,
        color: currentColor,
        fontSize: currentSize,
        hasBorder: currentBorder,
      },
    ]);
  };

  return (
    <div className="rich-text-input w-full">
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
            style={{
              background: "black",
              color: "white",
              border: "1px solid #666",
            }}
            onClick={() => applyColorToAll("black")}
            disabled={disabled}
            title="Black"
          >
            B
          </button>
          <button
            className="toolbar-btn color-btn"
            style={{ background: "#FFC700", color: "black" }}
            onClick={() => applyColorToAll("#FFC700")}
            disabled={disabled}
            title="Yellow"
          >
            Y
          </button>
          <button
            className="toolbar-btn color-btn"
            style={{ background: "#E63946", color: "white" }}
            onClick={() => applyColorToAll("#E63946")}
            disabled={disabled}
            title="Red"
          >
            R
          </button>
          <button
            className="toolbar-btn color-btn"
            style={{ background: "#06AED5", color: "white" }}
            onClick={() => applyColorToAll("#06AED5")}
            disabled={disabled}
            title="Cyan"
          >
            C
          </button>
          <button
            className="toolbar-btn color-btn"
            style={{ background: "#2D9E6D", color: "white" }}
            onClick={() => applyColorToAll("#2D9E6D")}
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
            onClick={() => applySizeToAll(52)}
            disabled={disabled}
            title="Small (52px)"
          >
            S
          </button>
          <button
            className="toolbar-btn size-btn"
            onClick={() => applySizeToAll(64)}
            disabled={disabled}
            title="Medium (64px)"
          >
            M
          </button>
          <button
            className="toolbar-btn size-btn"
            onClick={() => applySizeToAll(72)}
            disabled={disabled}
            title="Large (72px)"
          >
            L
          </button>
        </div>

        {mainTitle && (
          <div className="toolbar-group">
            <span className="toolbar-label">Border:</span>
            <button
              className={`toolbar-btn min-w-14! border-btn ${
                currentBorder ? "active" : ""
              }`}
              onClick={toggleBorder}
              disabled={disabled}
              title={
                currentBorder
                  ? "Border enabled (click to disable)"
                  : "Border disabled (click to enable)"
              }
              style={{
                background: currentBorder ? "#FFD700" : "#333",
                color: currentBorder ? "black" : "#888",
                border: currentBorder ? "2px solid #FFD700" : "2px solid #555",
              }}
            >
              {currentBorder ? "ON" : "OFF"}
            </button>
          </div>
        )}

        {/* Emoji Picker */}
        <div className="toolbar-group">
          <EmojiPickerButton
            onEmojiSelect={handleEmojiInsert}
            disabled={disabled || isWordMode}
          />
        </div>
      </div>

      {!isWordMode ? (
        <>
          {/* Simple text editor mode */}
          <textarea
            ref={textareaRef}
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
                      fontSize: `${((segment.fontSize || 64) / 64) * 1}rem`,
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
                      <option value="black">Black</option>
                      <option value="#FFC700">Yellow</option>
                      <option value="#E63946">Red</option>
                      <option value="#06AED5">Cyan</option>
                      <option value="#2D9E6D">Green</option>
                    </select>
                    <select
                      value={segment.fontSize || 64}
                      onChange={(e) =>
                        updateSegment(index, {
                          fontSize: Number(e.target.value),
                        })
                      }
                      disabled={disabled}
                      className="word-size-select"
                    >
                      <option value={52}>Small</option>
                      <option value={64}>Medium</option>
                      <option value={72}>Large</option>
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
                  fontSize: `${(segment.fontSize || 64) / 3}px`,
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
