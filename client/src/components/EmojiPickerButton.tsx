/**
 * Emoji Picker Component
 * Wrapper around emoji-picker-react with consistent styling
 */

import { useState, useRef, useEffect } from "react";
import EmojiPicker, { Theme } from "emoji-picker-react";
import type { EmojiClickData } from "emoji-picker-react";
import { Smile } from "lucide-react";
import "./EmojiPickerButton.css";

interface EmojiPickerButtonProps {
  onEmojiSelect: (emoji: string) => void;
  disabled?: boolean;
}

export function EmojiPickerButton({
  onEmojiSelect,
  disabled = false,
}: EmojiPickerButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close picker when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    onEmojiSelect(emojiData.emoji);
    setIsOpen(false);
  };

  return (
    <div className="emoji-picker-container">
      <button
        ref={buttonRef}
        type="button"
        className="emoji-picker-trigger"
        onClick={() => setIsOpen(!isOpen)}
        onMouseDown={(e) => e.preventDefault()}
        disabled={disabled}
        title="Add emoji"
      >
        <Smile size={18} />
      </button>

      {isOpen && (
        <div ref={pickerRef} className="emoji-picker-popover">
          <EmojiPicker
            onEmojiClick={handleEmojiClick}
            theme={Theme.DARK}
            width={320}
            height={400}
            searchPlaceHolder="Search emojis..."
            previewConfig={{
              showPreview: true,
              defaultCaption: "Pick an emoji",
            }}
            skinTonesDisabled={false}
            lazyLoadEmojis={true}
          />
        </div>
      )}
    </div>
  );
}
