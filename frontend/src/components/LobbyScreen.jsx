import {
  ArrowLeft,
  DoorOpen,
  LoaderCircle,
  Mic,
  MicOff,
  ShieldCheck,
  Video,
  VideoOff
} from "lucide-react";
import { BrandLogo } from "./BrandLogo.jsx";
import { VideoTile } from "./VideoTile.jsx";

function LobbyButton({ active = false, label, onClick, children }) {
  return (
    <button
      aria-label={label}
      className={`grid h-12 w-12 place-items-center rounded-md border transition ${
        active
          ? "border-cyan-200/20 bg-cyan-300 text-slate-950"
          : "border-white/12 bg-white/8 text-white hover:bg-white/14"
      }`}
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

export function LobbyScreen({ draft, meeting, onBack, onEnter }) {
  const waiting = meeting.status === "waiting";
  const joining = meeting.status === "joining";

  return (
    <main className="grid min-h-screen bg-[#060914] text-white lg:grid-cols-[minmax(0,1fr)_420px]">
      <section className="flex min-h-[55dvh] flex-col px-4 py-5 sm:px-8 lg:px-12 lg:py-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <button
            className="inline-flex h-10 items-center gap-2 rounded-md border border-white/10 bg-white/7 px-3 text-sm text-slate-100 hover:bg-white/12"
            onClick={onBack}
            type="button"
          >
            <ArrowLeft size={16} />
            Inicio
          </button>
          <BrandLogo compact pulse tagline="Lobby seguro" />
          <p className="truncate rounded-md bg-white/7 px-3 py-2 font-mono text-xs text-cyan-50">
            {draft.roomId}
          </p>
        </header>

        <div className="flex min-h-0 flex-1 items-center py-5 sm:py-8">
          <div className="w-full">
            <VideoTile
              local
              name={`${draft.username} en lobby`}
              stream={meeting.previewStream ?? meeting.localStream}
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                <LobbyButton
                  active={meeting.mediaState.micEnabled}
                  label={
                    meeting.mediaState.micEnabled
                      ? "Silenciar microfono"
                      : "Activar microfono"
                  }
                  onClick={meeting.toggleMic}
                >
                  {meeting.mediaState.micEnabled ? (
                    <Mic size={19} />
                  ) : (
                    <MicOff size={19} />
                  )}
                </LobbyButton>
                <LobbyButton
                  active={meeting.mediaState.cameraEnabled}
                  label={
                    meeting.mediaState.cameraEnabled
                      ? "Apagar camara"
                      : "Activar camara"
                  }
                  onClick={meeting.toggleCamera}
                >
                  {meeting.mediaState.cameraEnabled ? (
                    <Video size={19} />
                  ) : (
                    <VideoOff size={19} />
                  )}
                </LobbyButton>
              </div>
              <span className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-200">
                Preview local antes de publicar audio y video
              </span>
            </div>
          </div>
        </div>
      </section>

      <aside className="surface-panel flex flex-col justify-center border-t border-white/9 px-4 py-8 sm:px-8 lg:border-l lg:border-t-0">
        <p className="inline-flex items-center gap-2 text-sm font-medium text-cyan-100">
          <ShieldCheck size={16} />
          Lobby Conectate Live
        </p>
        <h1 className="mt-3 text-3xl font-semibold leading-tight text-white">
          Solicita acceso al owner.
        </h1>
        <p className="mt-3 leading-7 text-slate-300">
          Revisa camara y microfono. Al entrar, el owner de la sala decide quien
          pasa a la llamada.
        </p>

        <div className="mt-6 grid gap-3 rounded-lg border border-white/10 bg-black/18 p-4 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-400">Nombre</span>
            <span className="truncate font-medium text-white">{draft.username}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-400">Codigo</span>
            <span className="truncate font-mono text-cyan-50">{draft.roomId}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-400">Rol</span>
            <span className="font-medium text-white">Invitado</span>
          </div>
        </div>

        {meeting.error ? (
          <p className="mt-4 rounded-md border border-rose-300/20 bg-rose-400/12 px-3 py-2 text-sm text-rose-100">
            {meeting.error}
          </p>
        ) : null}

        {waiting ? (
          <div className="mt-5 rounded-lg border border-cyan-200/18 bg-cyan-200/10 p-4">
            <p className="flex items-center gap-2 font-medium text-cyan-50">
              <LoaderCircle className="animate-spin" size={17} />
              Esperando aprobacion
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-200">
              Tu solicitud ya llego al owner. Mantendremos la conexion lista.
            </p>
            <div className="mt-3 grid gap-2">
              <span className="brand-skeleton h-2.5 w-24 rounded-full" />
              <span className="brand-skeleton h-2.5 w-full rounded-full" />
            </div>
          </div>
        ) : (
          <button
            className="motion-lift mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-cyan-300 font-medium text-slate-950 shadow-lg shadow-cyan-950/35 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-70"
            disabled={joining}
            onClick={onEnter}
            type="button"
          >
            <DoorOpen size={18} />
            {joining ? "Conectando..." : "Solicitar acceso"}
          </button>
        )}
      </aside>
    </main>
  );
}

export function SessionEnded({ endState, error, onReturn }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#060914] px-4 text-white">
      <section className="w-full max-w-md rounded-lg border border-white/10 bg-[#0b1020] p-6 text-center shadow-2xl shadow-black/40">
        <BrandLogo className="justify-center" compact tagline="" />
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-lg bg-white/8 text-cyan-100">
          <VideoOff size={24} />
        </span>
        <h1 className="mt-4 text-2xl font-semibold">
          {endState?.title || "Reunion finalizada"}
        </h1>
        <p className="mt-3 leading-7 text-slate-300">
          {error || "La sesion termino y tus dispositivos dejaron de compartirse."}
        </p>
        <button
          className="mt-5 inline-flex h-11 items-center justify-center rounded-md bg-cyan-300 px-4 font-medium text-slate-950 hover:bg-cyan-200"
          onClick={onReturn}
          type="button"
        >
          Volver al inicio
        </button>
      </section>
    </main>
  );
}
