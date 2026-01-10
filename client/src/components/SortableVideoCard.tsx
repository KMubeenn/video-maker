import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface SortableVideoCardProps {
  id: string | number;
  children: ReactNode;
  className?: string;
}

export function SortableVideoCard({
  id,
  children,
  className,
}: SortableVideoCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("relative", isDragging && "opacity-50 z-50", className)}
    >
      <div className="flex items-start gap-2 w-full">
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className={cn(
            "drag-handle cursor-grab active:cursor-grabbing shrink-0 mt-2",
            "hover:bg-accent rounded p-1 transition-colors",
            "touch-none" // Prevent touch scrolling on handle
          )}
          title="Drag to reorder"
        >
          <GripVertical className="h-5 w-5 text-muted-foreground" />
        </div>

        {/* Card Content */}
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
