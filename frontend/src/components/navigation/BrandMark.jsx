import { Link } from "react-router-dom";
import { cn } from "@/lib/cn";
import { useOrgBranding } from "@/components/OrgThemeProvider";

export default function BrandMark({ to = "/", compact = false, className }) {
  const { orgName } = useOrgBranding();

  return (
    <Link
      to={to}
      className={cn(
        "inline-flex min-w-0 items-center gap-3 text-left",
        compact ? "gap-2.5" : "gap-3.5",
        className,
      )}
    >
      {/* The club logo, given the whole box.

          It used to sit at 40px inside a 48px plate with a border, and at that
          size the sculpture was an unreadable smear — the ribbons, the lit
          edges and the perspective all collapse into noise. Rendered at
          increasing sizes it starts to resolve around 56px and reads properly
          by 72px, so the badge was the problem rather than the image.

          The plate and border are gone because the asset's background is
          already cut to transparency, so there was nothing for them to do
          except eat eight pixels the logo needed. */}
      <span
        className={cn(
          "relative flex shrink-0 items-center justify-center",
          compact ? "h-14 w-14" : "h-16 w-16",
        )}
      >
        <img
          src="/app/brand/club-logo-256.webp"
          srcSet="/app/brand/club-logo-128.webp 128w, /app/brand/club-logo-256.webp 256w, /app/brand/club-logo-512.webp 512w"
          sizes="(max-width: 767px) 56px, 64px"
          alt=""
          width="256"
          height="256"
          decoding="async"
          className="h-full w-full object-contain"
        />
      </span>

      {/* Title block — on mobile the subtitle is hidden so the title
          can stay on one line next to the avatar without competing
          with the header's action row for horizontal space. Subtitle
          only shows from md: (768px) up, where there's actual room. */}
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-display text-base font-bold tracking-[-0.06em] text-white sm:text-lg">
          Asymptotes
        </span>
        <span className="hidden whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.28em] text-text-muted md:inline">
          {orgName || "BMSIT Chapter"}
        </span>
      </span>
    </Link>
  );
}
