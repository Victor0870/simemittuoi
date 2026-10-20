import type { CSSProperties, ReactNode } from "react";

type MaterialIconProps = {
  name: string;
  filled?: boolean;
  className?: string;
  /** Stylesheet Google Fonts ép font-size 24px đè lên class text-[..]; dùng size khi cần cỡ khác. */
  size?: number;
  style?: CSSProperties;
  children?: ReactNode;
};

export function MaterialIcon({
  name,
  filled = false,
  className = "",
  size,
  style,
}: MaterialIconProps) {
  return (
    <span
      className={`material-symbols-outlined ${filled ? "material-symbols-filled" : ""} ${className}`}
      style={size ? { fontSize: size, ...style } : style}
      aria-hidden
    >
      {name}
    </span>
  );
}
