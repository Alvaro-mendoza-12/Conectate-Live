export function BrandMark({ className = "", pulse = false }) {
  return (
    <span
      className={`brand-mark relative grid shrink-0 place-items-center overflow-hidden ${className}`}
    >
      {pulse ? <span className="brand-pulse" /> : null}
      <img
        alt=""
        className="relative z-10 h-full w-full"
        src="/brand/conectate-live-mark.svg"
      />
    </span>
  );
}

export function BrandLogo({
  className = "",
  compact = false,
  pulse = false,
  tagline = "Reuniones privadas ligeras"
}) {
  return (
    <div className={`flex min-w-0 items-center gap-3 ${className}`}>
      <BrandMark
        className={compact ? "h-9 w-9 rounded-lg" : "h-11 w-11 rounded-xl"}
        pulse={pulse}
      />
      <div className="min-w-0">
        <p
          className={`truncate font-semibold text-white ${
            compact ? "text-sm sm:text-base" : "text-lg"
          }`}
        >
          Conectate Live
        </p>
        {tagline ? (
          <p className="truncate text-xs text-slate-300 sm:text-sm">{tagline}</p>
        ) : null}
      </div>
    </div>
  );
}
