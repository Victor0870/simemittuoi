import type { ReactNode } from "react";

type MaterialIconProps = {
  name: string;
  filled?: boolean;
  className?: string;
  children?: ReactNode;
};

export function MaterialIcon({
  name,
  filled = false,
  className = "",
}: MaterialIconProps) {
  return (
    <span
      className={`material-symbols-outlined ${filled ? "material-symbols-filled" : ""} ${className}`}
      aria-hidden
    >
      {name}
    </span>
  );
}
