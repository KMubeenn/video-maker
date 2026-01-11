import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useState, useRef } from "react";
import "./RichTextInput.css";
import { EmojiPickerButton } from "./EmojiPickerButton";
import { Bold, Italic, Underline as UnderlineIcon } from "lucide-react";

export interface TextSegment {
  text: string;
  color?: string;
  fontSize?: number;
  hasBorder?: boolean;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

interface RichTextInputProps {
  value: TextSegment[];
  onChange: (segments: TextSegment[]) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  mainTitle?: boolean;
  size?: number; // Default font size
}

const DEFAULT_FONT_SIZE = 64;

// --- Helper: Convert TextSegments to TipTap JSON Content ---
const segmentsToContent = (segments: TextSegment[]) => {
  if (!segments || segments.length === 0) return { type: "doc", content: [] };

  const paragraph = {
    type: "paragraph",
    content: segments.map((seg) => {
      const marks = [];

      // Color & Font Size via TextStyle
      const styleAttrs: Record<string, string> = {};
      if (seg.color && seg.color !== "white") {
        styleAttrs.color = seg.color;
      }
      if (seg.fontSize) {
        styleAttrs.fontSize = `${seg.fontSize}px`;
      }

      if (Object.keys(styleAttrs).length > 0) {
        marks.push({ type: "textStyle", attrs: styleAttrs });
      }

      if (seg.bold) marks.push({ type: "bold" });
      if (seg.italic) marks.push({ type: "italic" });
      if (seg.underline) marks.push({ type: "underline" });

      return {
        type: "text",
        text: seg.text,
        marks,
      };
    }),
  };

  return {
    type: "doc",
    content: [paragraph],
  };
};

// --- Helper: Convert TipTap JSON to TextSegments ---
const contentToSegments = (
  json: any,
  currentSize: number,
  currentBorder: boolean
): TextSegment[] => {
  if (!json?.content) return [];

  const segments: TextSegment[] = [];

  // Traverse doc -> paragraph -> text nodes
  json.content.forEach((block: any) => {
    if (block.type === "paragraph" && block.content) {
      block.content.forEach((node: any) => {
        if (node.type === "text") {
          const marks = node.marks || [];

          let color = "white";
          let bold = false;
          let italic = false;
          let underline = false;
          let fontSize = currentSize;

          marks.forEach((mark: any) => {
            if (mark.type === "textStyle") {
              if (mark.attrs?.color) color = mark.attrs.color;
              if (mark.attrs?.fontSize) {
                const parsed = parseInt(mark.attrs.fontSize);
                if (!isNaN(parsed)) fontSize = parsed;
              }
            }
            if (mark.type === "bold") bold = true;
            if (mark.type === "italic") italic = true;
            if (mark.type === "underline") underline = true;
          });

          segments.push({
            text: node.text,
            color,
            fontSize,
            hasBorder: currentBorder,
            bold,
            italic,
            underline,
          });
        }
      });
    }
  });

  return segments;
};

export function RichTextInput({
  value,
  onChange,
  placeholder = "Enter text...",
  label,
  disabled = false,
  mainTitle = false,
  size = DEFAULT_FONT_SIZE,
}: RichTextInputProps) {
  const [currentBorder, setCurrentBorder] = useState(true);
  const [currentSize, setCurrentSize] = useState(size);

  // Use ref to access latest state in TipTap callbacks without stale closures
  const stateRef = useRef({ size: currentSize, border: currentBorder });
  useEffect(() => {
    stateRef.current = { size: currentSize, border: currentBorder };
  }, [currentSize, currentBorder]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      Color,
      Underline,
      Placeholder.configure({
        placeholder: placeholder,
      }),
    ],
    content: segmentsToContent(value),
    onUpdate: ({ editor }) => {
      const json = editor.getJSON();
      // Use ref for fresh state
      const newSegments = contentToSegments(
        json,
        stateRef.current.size,
        stateRef.current.border
      );
      onChange(newSegments);
    },
    editorProps: {
      attributes: {
        class: "rich-text-input-field",
      },
    },
    editable: !disabled,
  });

  // Update state when selection changes
  useEffect(() => {
    if (!editor) return;
  }, [editor]);

  const toggleBold = () => editor?.chain().focus().toggleBold().run();
  const toggleItalic = () => editor?.chain().focus().toggleItalic().run();
  const toggleUnderline = () => editor?.chain().focus().toggleUnderline().run();

  const setColor = (color: string) => {
    editor?.chain().focus().setColor(color).run();
  };

  const handleEmojiInsert = (emoji: string) => {
    editor?.chain().focus().insertContent(emoji).run();
  };

  const toggleBorder = () => {
    const newBorder = !currentBorder;
    setCurrentBorder(newBorder);
    // Ref will update in next render, but we need immediate export with new value
    const json = editor?.getJSON();
    if (json) {
      const newSegments = contentToSegments(json, currentSize, newBorder);
      onChange(newSegments);
    }
  };

  const setFontSize = (sizeVal: number) => {
    setCurrentSize(sizeVal);
    // Apply to selection (or set stored mark for next type)
    editor
      ?.chain()
      .focus()
      .setMark("textStyle", { fontSize: `${sizeVal}px` })
      .run();

    // Force update external parent immediately using new size as default for un-styled text
    // This ensures immediate visual feedback even if text is not selected (global logic)
    const json = editor?.getJSON();
    if (json) {
      const newSegments = contentToSegments(json, sizeVal, currentBorder);
      onChange(newSegments);
    }
  };

  // Update state when selection changes to reflect current styles
  useEffect(() => {
    if (!editor) return;

    const onSelectionUpdate = () => {
      const { selection } = editor.state;
      if (!selection.empty) {
        // Try to get font size from selection
        const attrs = editor.getAttributes("textStyle");
        if (attrs.fontSize) {
          const parsed = parseInt(attrs.fontSize);
          if (!isNaN(parsed)) setCurrentSize(parsed);
        }
      }
    };

    editor.on("selectionUpdate", onSelectionUpdate);
    return () => {
      editor.off("selectionUpdate", onSelectionUpdate);
    };
  }, [editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className="rich-text-input">
      {label && <label className="rich-text-label">{label}</label>}

      <div className="rich-text-toolbar">
        {/* Color Picker */}
        <div className="toolbar-group">
          <span className="toolbar-label">Color:</span>
          {["white", "black", "#FFC700", "#E63946", "#06AED5", "#2D9E6D"].map(
            (c) => {
              const titleMap: Record<string, string> = {
                white: "White",
                black: "Black",
                "#FFC700": "Yellow",
                "#E63946": "Red",
                "#06AED5": "Cyan",
                "#2D9E6D": "Green",
              };
              return (
                <button
                  key={c}
                  className={`toolbar-btn color-btn ${
                    editor.isActive("textStyle", { color: c }) ? "active" : ""
                  }`}
                  style={{
                    background: c,
                    color: c === "white" || c === "#FFC700" ? "black" : "white",
                    border: c === "black" ? "1px solid #666" : "none",
                  }}
                  onClick={() => setColor(c)}
                  disabled={disabled}
                  title={titleMap[c]}
                >
                  {titleMap[c][0]}
                </button>
              );
            }
          )}
        </div>

        {/* Text Style */}
        <div className="toolbar-group">
          <button
            className={`toolbar-btn ${editor.isActive("bold") ? "active" : ""}`}
            onClick={toggleBold}
            disabled={disabled}
            title="Bold"
          >
            <Bold size={16} />
          </button>
          <button
            className={`toolbar-btn ${
              editor.isActive("italic") ? "active" : ""
            }`}
            onClick={toggleItalic}
            disabled={disabled}
            title="Italic"
          >
            <Italic size={16} />
          </button>
          <button
            className={`toolbar-btn ${
              editor.isActive("underline") ? "active" : ""
            }`}
            onClick={toggleUnderline}
            disabled={disabled}
            title="Underline"
          >
            <UnderlineIcon size={16} />
          </button>
        </div>

        {/* Font Size */}
        <div className="toolbar-group">
          <span className="toolbar-label">Size:</span>
          {[52, 64, 72].map((s) => (
            <button
              key={s}
              className={`toolbar-btn size-btn ${
                currentSize === s ? "active" : ""
              }`}
              onClick={() => setFontSize(s)}
              disabled={disabled}
              title={`${s}px`}
            >
              {s === 52 ? "S" : s === 64 ? "M" : "L"}
            </button>
          ))}
        </div>

        {/* Border Toggle (Main Title only) */}
        {mainTitle && (
          <div className="toolbar-group">
            <span className="toolbar-label">Border:</span>
            <button
              className={`toolbar-btn min-w-14! border-btn ${
                currentBorder ? "active" : ""
              }`}
              onClick={toggleBorder}
              disabled={disabled}
              style={{
                background: currentBorder ? "#FFD700" : "#333",
                color: currentBorder ? "black" : "#888",
                border: currentBorder ? "2px solid #FFD700" : "1px solid #555",
                fontWeight: "bold",
                width: "auto",
                padding: "0 8px",
              }}
            >
              {currentBorder ? "ON" : "OFF"}
            </button>
          </div>
        )}

        {/* Emoji */}
        <div className="toolbar-group">
          <EmojiPickerButton
            onEmojiSelect={handleEmojiInsert}
            disabled={disabled}
          />
        </div>
      </div>

      <EditorContent editor={editor} />

      {/* Live Preview of Rendered Data structure */}
      <div
        className="rich-text-preview"
        style={{ fontFamily: "Impact, Arial, sans-serif" }}
      >
        {value.map((seg, i) => (
          <span
            key={i}
            style={{
              color: seg.color || "white",
              fontSize: (seg.fontSize || 64) / 3, // Scaled down for preview
              fontWeight: seg.bold ? "bold" : "normal",
              fontStyle: seg.italic ? "italic" : "normal",
              textDecoration: seg.underline ? "underline" : "none",
              WebkitTextStroke:
                seg.hasBorder && seg.color !== "white" ? "1px #FFD700" : "none",
              marginRight: 4,
            }}
          >
            {seg.text}
          </span>
        ))}
        {value.length === 0 && (
          <span className="preview-placeholder">Preview...</span>
        )}
      </div>
    </div>
  );
}
