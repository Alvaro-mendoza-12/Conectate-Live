import { Monitor, VideoOff, Volume2, VolumeX } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

export function VideoTile({
  connectionLabel = "",
  local = false,
  muted = false,
  name,
  onToggleMute,
  screenSharing = false,
  speaking = false,
  stream
}) {
  const videoRef = useRef(null);
  const hasVideo = useMemo(
    () =>
      Boolean(
        stream
          ?.getVideoTracks()
          .some((track) => track.readyState === "live" && track.enabled)
      ),
    [stream]
  );

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream ?? null;
    }
  }, [stream]);

  return (
    <article
      className={`relative aspect-video min-h-[160px] overflow-hidden rounded-lg border bg-[#0c101a] transition sm:min-h-[180px] ${
        speaking
          ? "border-teal-200 shadow-[0_0_0_2px_rgba(94,234,212,0.28)]"
          : "border-white/10"
      }`}
    >
      <video
        autoPlay
        className={`h-full w-full object-cover ${local && !screenSharing ? "-scale-x-100" : ""}`}
        muted={local || muted}
        playsInline
        ref={videoRef}
      />

      {!hasVideo ? (
        <div className="absolute inset-0 grid place-items-center bg-[#0c101a] text-slate-300">
          <div className="grid gap-3 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white/8">
              <VideoOff size={24} />
            </span>
            <span className="px-4 text-sm">{name}</span>
          </div>
        </div>
      ) : null}

      <div className="absolute left-3 top-3 flex flex-wrap gap-2">
        {speaking ? (
          <span className="rounded-md bg-teal-300 px-2 py-1 text-xs font-medium text-slate-950">
            Hablando
          </span>
        ) : null}
        {connectionLabel ? (
          <span className="rounded-md bg-black/55 px-2 py-1 text-xs text-slate-100">
            {connectionLabel}
          </span>
        ) : null}
      </div>

      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/80 to-transparent px-3 pb-3 pt-10">
        <span className="truncate rounded-md bg-black/45 px-2 py-1 text-sm text-white">
          {name}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          {!local && onToggleMute ? (
            <button
              aria-label={muted ? `Activar audio de ${name}` : `Silenciar ${name}`}
              className="grid h-8 w-8 place-items-center rounded-md bg-black/55 text-white hover:bg-black/75"
              onClick={onToggleMute}
              title={muted ? "Activar audio" : "Silenciar"}
              type="button"
            >
              {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
          ) : null}
          {screenSharing ? (
            <span className="grid h-8 w-8 place-items-center rounded-md bg-teal-300 text-slate-950">
              <Monitor size={16} />
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}
