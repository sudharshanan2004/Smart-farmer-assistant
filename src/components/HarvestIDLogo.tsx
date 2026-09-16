import { cn } from "@/lib/utils";

/**
 * Reusable Smart Farmer Assistant brand logo.
 * Renders the official uploaded asset (public/logo/app-logo.png) everywhere.
 */
export function AppLogo({
  variant = "icon",
  size = 36,
  decorative = false,
  className,
  imgClassName,
}: {
  /** "icon" renders the compact mark; "full" is the same official logo sized up for header/sidebar use. */
  variant?: "icon" | "full";
  /** Size of the logo in px */
  size?: number;
  /** True when this instance is a decorative duplicate (hidden from screen readers). */
  decorative?: boolean;
  className?: string;
  imgClassName?: string;
}) {
  return (
    <span className={cn("inline-flex shrink-0 items-center overflow-hidden rounded-xl", className)}>
      <img
        src="/logo/app-logo.png"
        alt={decorative ? "" : "Smart Farmer Assistant logo"}
        aria-hidden={decorative || undefined}
        width={size}
        height={size}
        draggable={false}
        className={cn("shrink-0 rounded-xl object-cover", imgClassName)}
      />
    </span>
  );
}

// Alias to maintain compatibility with existing imports
export const HarvestIDLogo = AppLogo;
