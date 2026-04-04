"use client";

import { useDroppable } from "@dnd-kit/core";

export function DroppableSlot({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`min-h-[60px] bg-background/50 rounded-2xl p-2 border border-dashed flex flex-col gap-2 transition-colors group ${
        isOver ? "border-primary/50 bg-primary/5" : "border-border/30"
      }`}
    >
      {children}
    </div>
  );
}
