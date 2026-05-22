import {
  ArrowRight,
  CalendarClock,
  Copy,
  Link2,
  Plus,
  ShieldCheck,
  Video,
  WandSparkles
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  createRoomCode,
  meetingLink,
  roomFromInput,
  roomFromLocation
} from "../lib/room.js";

const mockMeetings = [
  {
    code: "conectate-lab",
    name: "Repaso de laboratorio",
    time: "Hoy, 7:30 PM"
  },
  {
    code: "equipo-final",
    name: "Entrega de proyecto",
    time: "Manana, 10:00 AM"
  }
];

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-11 w-11 place-items-center rounded-lg bg-cyan-300 text-slate-950 shadow-[0_14px_44px_rgba(103,232,249,0.2)]">
        <Video size={22} />
      </span>
      <div>
        <p className="text-lg font-semibold text-white">Conectate Live</p>
        <p className="text-sm text-slate-300">Reuniones privadas ligeras</p>
      </div>
    </div>
  );
}

function FeatureChip({ icon: Icon, children }) {
  return (
    <span className="inline-flex h-9 items-center gap-2 rounded-md border border-white/10 bg-black/25 px-3 text-sm text-slate-100 backdrop-blur-sm">
      <Icon size={15} />
      {children}
    </span>
  );
}

export function ProductHome({ error, onPrepare }) {
  const [username, setUsername] = useState("");
  const [joinValue, setJoinValue] = useState(roomFromLocation());
  const [notice, setNotice] = useState("");
  const [formError, setFormError] = useState("");
  const nextCode = useMemo(createRoomCode, []);

  function validateName() {
    if (username.trim()) {
      setFormError("");
      return true;
    }

    setFormError("Escribe tu nombre temporal antes de continuar.");
    return false;
  }

  async function createFastMeeting(roomId = createRoomCode()) {
    if (!validateName()) {
      return;
    }

    try {
      await navigator.clipboard.writeText(meetingLink(roomId));
      setNotice("Enlace copiado. Ajusta camara y microfono antes de entrar.");
    } catch {
      setNotice("Reunion creada. Podras copiar el enlace desde la llamada.");
    }

    onPrepare({
      mode: "create",
      roomId,
      username: username.trim()
    });
  }

  function joinMeeting(event) {
    event.preventDefault();

    if (!validateName()) {
      return;
    }

    const roomId = roomFromInput(joinValue);

    if (!roomId) {
      setFormError("Pega un codigo o enlace de reunion.");
      return;
    }

    onPrepare({
      mode: "join",
      roomId,
      username: username.trim()
    });
  }

  return (
    <main className="min-h-screen bg-[#060914] text-white">
      <section className="relative isolate min-h-[min(88dvh,900px)] overflow-hidden px-4 pb-16 pt-5 sm:px-8 lg:px-12">
        <img
          alt=""
          className="absolute inset-0 -z-20 h-full w-full object-cover object-[58%_center]"
          src="/conectate-live-hero.png"
        />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(4,7,18,0.98)_0%,rgba(4,7,18,0.88)_42%,rgba(4,7,18,0.44)_72%,rgba(4,7,18,0.9)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-48 bg-gradient-to-t from-[#060914] to-transparent" />

        <header className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <Brand />
          <span className="hidden rounded-md border border-white/10 bg-black/25 px-3 py-2 text-sm text-slate-200 backdrop-blur-md sm:inline-flex">
            WebRTC + Socket.IO
          </span>
        </header>

        <div className="mx-auto grid max-w-7xl gap-8 pt-14 lg:grid-cols-[minmax(0,620px)_minmax(320px,430px)] lg:items-end lg:justify-between lg:pt-24">
          <div className="animate-rise">
            <p className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-cyan-100">
              <WandSparkles size={16} />
              La sala de estudio ya se siente como producto.
            </p>
            <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-white sm:text-6xl">
              Conectate Live
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-200 sm:text-lg">
              Crea una reunion privada, revisa tu preview y deja pasar a cada
              participante con controles simples de owner.
            </p>

            <div className="mt-7 flex flex-wrap gap-2">
              <FeatureChip icon={ShieldCheck}>Sala de espera</FeatureChip>
              <FeatureChip icon={Video}>Lobby multimedia</FeatureChip>
              <FeatureChip icon={Link2}>Enlace compartible</FeatureChip>
            </div>
          </div>

          <form
            className="animate-rise rounded-lg border border-white/12 bg-[#0b1020]/88 p-4 shadow-2xl shadow-black/45 backdrop-blur-md sm:p-5"
            onSubmit={joinMeeting}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-cyan-100">Entrar ahora</p>
                <p className="mt-1 text-sm text-slate-300">
                  Sin correo ni contrasena.
                </p>
              </div>
              <span className="grid h-10 w-10 place-items-center rounded-md bg-white/8 text-slate-100">
                <Video size={18} />
              </span>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">
                Nombre temporal
              </span>
              <input
                autoFocus
                className="h-12 w-full rounded-md border border-white/10 bg-black/30 px-4 text-white outline-none transition focus:border-cyan-200/65"
                maxLength={32}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Alvaro"
                value={username}
              />
            </label>

            <label className="mt-4 block">
              <span className="mb-2 block text-sm text-slate-300">
                Codigo o enlace
              </span>
              <input
                className="h-12 w-full rounded-md border border-white/10 bg-black/30 px-4 text-white outline-none transition focus:border-cyan-200/65"
                maxLength={240}
                onChange={(event) => setJoinValue(event.target.value)}
                placeholder="conectate-abc123 o enlace"
                value={joinValue}
              />
            </label>

            {formError || error ? (
              <p className="mt-4 rounded-md border border-rose-300/20 bg-rose-400/12 px-3 py-2 text-sm text-rose-100">
                {formError || error}
              </p>
            ) : null}
            {notice ? (
              <p className="mt-4 rounded-md border border-cyan-200/18 bg-cyan-200/10 px-3 py-2 text-sm text-cyan-50">
                {notice}
              </p>
            ) : null}

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <button
                className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-cyan-300 font-medium text-slate-950 transition hover:bg-cyan-200"
                onClick={() => createFastMeeting(nextCode)}
                type="button"
              >
                <Plus size={18} />
                Crear reunion
              </button>
              <button
                className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-white/12 bg-white/8 font-medium text-white transition hover:bg-white/14"
                type="submit"
              >
                Unirse
                <ArrowRight size={18} />
              </button>
            </div>
          </form>
        </div>
      </section>

      <section className="relative mx-auto -mt-10 grid max-w-7xl gap-4 px-4 pb-10 sm:px-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-12">
        <div className="rounded-lg border border-white/10 bg-[#0a1020] p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-slate-400">Dashboard</p>
              <h2 className="text-xl font-semibold text-white">
                Proximas reuniones
              </h2>
            </div>
            <button
              className="inline-flex h-11 items-center gap-2 rounded-md border border-cyan-200/25 bg-cyan-200/10 px-3 text-sm text-cyan-50 hover:bg-cyan-200/16"
              onClick={() => createFastMeeting()}
              type="button"
            >
              <Copy size={16} />
              Reunion rapida
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {mockMeetings.map((meeting) => (
              <article
                className="rounded-lg border border-white/9 bg-white/[0.045] p-4"
                key={meeting.code}
              >
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-coral-soft text-rose-50">
                    <CalendarClock size={18} />
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate font-medium text-white">
                      {meeting.name}
                    </h3>
                    <p className="mt-1 text-sm text-slate-300">{meeting.time}</p>
                    <p className="mt-2 truncate font-mono text-xs text-cyan-100">
                      {meeting.code}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="rounded-lg border border-white/10 bg-[#0a1020] p-4 sm:p-5">
          <p className="text-sm text-slate-400">Preparado para crecer</p>
          <h2 className="mt-1 text-xl font-semibold text-white">
            Modulos Conectate
          </h2>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-200">
            <p className="rounded-md bg-white/[0.055] px-3 py-2">
              JWT y cuentas Conectate podran entrar sin cambiar WebRTC.
            </p>
            <p className="rounded-md bg-white/[0.055] px-3 py-2">
              Amigos, llamadas privadas e historial real quedan como modulos.
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}
