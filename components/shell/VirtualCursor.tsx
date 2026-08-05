"use client";

import type { CursorPosition } from "./useVirtualCursor";
import styles from "./VirtualCursor.module.css";

interface Props {
  position: CursorPosition;
  visible: boolean;
}

export function VirtualCursor({ position, visible }: Props) {
  if (!visible) return null;

  return (
    <div
      className={styles.cursor}
      style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
    >
      <span className={styles.dot} />
    </div>
  );
}
