import { useState, useRef, useEffect, useCallback } from "react";
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
  const editorRef = useRef<HTMLDivElement>(null);

  // Get plain text from segments - memoized to avoid recreating on every render
  const getPlainText = useCallback(() => {
    return value.map((seg) => seg.text).join("");
  }, [value]);

  // Handle text input
  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const text = e.currentTarget.textContent || "";

    // Update with single segment using current formatting
    onChange([{ text, color: currentColor, fontSize: currentSize }]);
  };

  // Apply color to all text
  const applyColor = (color: string) => {
    setCurrentColor(color);
    const text = getPlainText();
    if (text) {
      onChange([{ text, color, fontSize: currentSize }]);
    }
  };

  // Apply size to all text
  const applySize = (size: number) => {
    setCurrentSize(size);
    const text = getPlainText();
    if (text) {
      onChange([{ text, color: currentColor, fontSize: size }]);
    }
  };

  // Update editor content when value changes externally
  useEffect(() => {
    if (editorRef.current) {
      const plainText = getPlainText();
      // Only update if the text actually changed and we're not currently typing
      if (
        editorRef.current.textContent !== plainText &&
        document.activeElement !== editorRef.current
      ) {
        editorRef.current.textContent = plainText;
      }
    }
  }, [value, getPlainText]);

  return (
    <div className="rich-text-input">
      {label && <label className="rich-text-label">{label}</label>}

      <div className="rich-text-toolbar">
        <div className="toolbar-group">
          <span className="toolbar-label">Color:</span>
          <button
            className="toolbar-btn color-btn"
            style={{ background: "white", color: "black" }}
            onClick={() => applyColor("white")}
            disabled={disabled}
            title="White"
          >
            W
          </button>
          <button
            className="toolbar-btn color-btn"
            style={{ background: "#FFD700", color: "black" }}
            onClick={() => applyColor("#FFD700")}
            disabled={disabled}
            title="Yellow"
          >
            Y
          </button>
          <button
            className="toolbar-btn color-btn"
            style={{ background: "#FF6B6B", color: "white" }}
            onClick={() => applyColor("#FF6B6B")}
            disabled={disabled}
            title="Red"
          >
            R
          </button>
          <button
            className="toolbar-btn color-btn"
            style={{ background: "#4ECDC4", color: "black" }}
            onClick={() => applyColor("#4ECDC4")}
            disabled={disabled}
            title="Cyan"
          >
            C
          </button>
          <button
            className="toolbar-btn color-btn"
            style={{ background: "#95E1D3", color: "black" }}
            onClick={() => applyColor("#95E1D3")}
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
            onClick={() => applySize(40)}
            disabled={disabled}
            title="Small (40px)"
          >
            S
          </button>
          <button
            className="toolbar-btn size-btn"
            onClick={() => applySize(52)}
            disabled={disabled}
            title="Medium (52px)"
          >
            M
          </button>
          <button
            className="toolbar-btn size-btn"
            onClick={() => applySize(64)}
            disabled={disabled}
            title="Large (64px)"
          >
            L
          </button>
        </div>
      </div>

      <div
        ref={editorRef}
        className="rich-text-editor"
        contentEditable={!disabled}
        onInput={handleInput}
        suppressContentEditableWarning
        data-placeholder={placeholder}
      />

      <div className="rich-text-preview">
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
    </div>
  );
}
