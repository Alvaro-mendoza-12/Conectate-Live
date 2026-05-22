import {
  ArrowRight,
  CalendarClock,
  CalendarPlus,
  Clock3,
  Copy,
  History,
  Link2,
  LoaderCircle,
  Plus,
  ShieldCheck,
  UsersRound,
  Video,
  WandSparkles
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  createRoomCode,
  meetingLink,
  roomFromInput,
  roomFromLocation
} from "../lib/room.js";
import { useAuth } from "../providers/AuthProvider.jsx";
import { useMeetingData } from "../providers/MeetingDataProvider.jsx";
import { BrandLogo } from "./BrandLogo.jsx";

const workspaceCards = [
  {
    code: "historial-local",
    name: "Historial reciente",
    note: "Las salas usadas quedan en este navegador hasta tener backend persistente."
  },
  {
    code: "invitacion-enlace",
    name: "Invitaciones recientes",
    note: "Abre un enlace o pega un codigo para volver rapido al lobby."
  }
];

function relativeTime(value) {
  const timestamp = new Date(value).getTime();
  const seconds = Math.round((timestamp - Date.now()) / 1000);
  const absoluteSeconds = Math.abs(seconds);

  if (!Number.isFinite(timestamp) || absoluteSeconds < 45) {
    return "hace un momento";
  }

  const formatter = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

  if (absoluteSeconds < 60 * 60) {
    return formatter.format(Math.round(seconds / 60), "minute");
  }

  if (absoluteSeconds < 60 * 60 * 24) {
    return formatter.format(Math.round(seconds / (60 * 60)), "hour");
  }

  return formatter.format(Math.round(seconds / (60 * 60 * 24)), "day");
}

function looksRecentlyLive(value) {
  return Date.now() - new Date(value).getTime() < 15 * 60 * 1000;
}

function defaultScheduleValue() {
  const nextHour = new Date(Date.now() + 60 * 60 * 1000);
  const offsetMs = nextHour.getTimezoneOffset() * 60 * 1000;

  nextHour.setMinutes(0, 0, 0);
  return new Date(nextHour.getTime() - offsetMs).toISOString().slice(0, 16);
}

function dateTimeLabel(value) {
  return new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function FeatureChip({ icon: Icon, children }) {
  return (
    <span className="inline-flex h-9 items-center gap-2 rounded-md border border-white/10 bg-black/25 px-3 text-sm text-slate-100 shadow-sm shadow-black/15 backdrop-blur-sm transition hover:border-cyan-100/25 hover:bg-black/38">
      <Icon size={15} />
      {children}
    </span>
  );
}

export function ProductHome({ busy = false, error, onPrepare }) {
  const { profile, updateGuestProfile } = useAuth();
  const {
    dashboard,
    rememberInvitation,
    scheduleMeeting
  } = useMeetingData();
  const locationRoom = useMemo(roomFromLocation, []);
  const [username, setUsername] = useState(profile.displayName);
  const [joinValue, setJoinValue] = useState(locationRoom);
  const [formError, setFormError] = useState("");
  const [dashboardNotice, setDashboardNotice] = useState("");
  const [scheduleTitle, setScheduleTitle] = useState("Reunion de estudio");
  const [scheduleTime, setScheduleTime] = useState(defaultScheduleValue);
  const recentMeetings = dashboard.history;
  const scheduledMeetings = dashboard.scheduled;
  const invitations = dashboard.invitations;
  const nextCode = useMemo(createRoomCode, []);
  const inviteRoom = useMemo(() => roomFromInput(joinValue), [joinValue]);
  const participantFootprint = recentMeetings.reduce(
    (count, meeting) => count + meeting.participantCount,
    0
  );

  useEffect(() => {
    if (!username && profile.displayName) {
      setUsername(profile.displayName);
    }
  }, [profile.displayName, username]);

  useEffect(() => {
    if (locationRoom) {
      rememberInvitation({
        roomId: roomFromInput(locationRoom),
        source: "link",
        title: "Enlace recibido"
      });
    }
  }, [locationRoom, rememberInvitation]);

  function validateName() {
    const displayName = username.trim();

    if (displayName) {
      setFormError("");
      updateGuestProfile({ displayName });
      return true;
    }

    setFormError("Escribe tu nombre temporal antes de continuar.");
    return false;
  }

  function createFastMeeting(roomId = createRoomCode()) {
    if (!validateName()) {
      return;
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

  function rejoinRecentMeeting(meeting) {
    if (!validateName()) {
      return;
    }

    setJoinValue(meeting.roomId);
    onPrepare({
      mode: "join",
      roomId: meeting.roomId,
      username: username.trim()
    });
  }

  async function copyMeetingLink(meeting) {
    try {
      await navigator.clipboard.writeText(meetingLink(meeting.roomId));
      rememberInvitation({
        roomId: meeting.roomId,
        source: "copied",
        title: meeting.title || `Invitacion ${meeting.roomId}`
      });
      setDashboardNotice(`Enlace de ${meeting.roomId} copiado.`);
    } catch {
      setDashboardNotice("No se pudo copiar. Abre la sala y copia el enlace alli.");
    }
  }

  function createScheduledMeeting(event) {
    event.preventDefault();

    const meeting = scheduleMeeting({
      hostProfileId: profile.id,
      roomId: createRoomCode(),
      scheduledFor: scheduleTime,
      title: scheduleTitle
    });

    if (!meeting) {
      setDashboardNotice("No se pudo guardar la reunion local.");
      return;
    }

    setDashboardNotice(`Agenda local lista para ${meeting.roomId}.`);
  }

  return (
    <main className="product-shell min-h-screen bg-[#060914] text-white">
      <section className="relative isolate min-h-[min(88dvh,900px)] overflow-hidden px-4 pb-16 pt-5 sm:px-8 lg:px-12">
        <img
          alt=""
          className="absolute inset-0 -z-20 h-full w-full object-cover object-[58%_center]"
          src="/conectate-live-hero.png"
        />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(4,7,18,0.98)_0%,rgba(4,7,18,0.88)_42%,rgba(4,7,18,0.44)_72%,rgba(4,7,18,0.9)_100%)]" />
        <div className="soft-grid absolute inset-0 -z-10 opacity-55" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-48 bg-gradient-to-t from-[#060914] to-transparent" />

        <header className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <BrandLogo pulse />
          <div className="hidden items-center gap-2 sm:flex">
            <span className="live-badge">
              <span />
              Live
            </span>
            <span className="rounded-md border border-white/10 bg-black/25 px-3 py-2 text-sm text-slate-200 backdrop-blur-md">
              WebRTC + Socket.IO
            </span>
          </div>
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
              Crea una reunion privada, entra directo y deja pasar a cada
              participante con controles simples de owner.
            </p>

            <div className="mt-7 flex flex-wrap gap-2">
              <FeatureChip icon={ShieldCheck}>Sala de espera</FeatureChip>
              <FeatureChip icon={Video}>Lobby multimedia</FeatureChip>
              <FeatureChip icon={Link2}>Enlace compartible</FeatureChip>
            </div>
          </div>

          <form
            aria-busy={busy}
            className="glass-panel animate-rise rounded-lg border border-white/12 p-4 shadow-2xl shadow-black/45 backdrop-blur-md sm:p-5"
            onSubmit={joinMeeting}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-cyan-100">Entrar ahora</p>
                <p className="mt-1 text-sm text-slate-300">
                  Perfil invitado standalone.
                </p>
              </div>
              <span
                className="inline-flex h-10 items-center gap-2 rounded-md bg-white/8 px-3 text-xs text-slate-100"
                title="Session guest guardada en este navegador hasta activar auth Conectate."
              >
                <Video size={16} />
                Guest
              </span>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">
                Nombre temporal
              </span>
              <input
                autoFocus
                className="h-12 w-full rounded-md border border-white/10 bg-black/30 px-4 text-white outline-none transition focus:border-cyan-200/65 focus:bg-black/45"
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
                className="h-12 w-full rounded-md border border-white/10 bg-black/30 px-4 text-white outline-none transition focus:border-cyan-200/65 focus:bg-black/45"
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
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <button
                className="motion-lift inline-flex h-12 items-center justify-center gap-2 rounded-md bg-cyan-300 font-medium text-slate-950 shadow-lg shadow-cyan-950/35 transition hover:bg-cyan-200"
                disabled={busy}
                onClick={() => createFastMeeting(nextCode)}
                type="button"
              >
                {busy ? <LoaderCircle className="animate-spin" size={18} /> : <Plus size={18} />}
                {busy ? "Creando..." : "Crear reunion"}
              </button>
              <button
                className="motion-lift inline-flex h-12 items-center justify-center gap-2 rounded-md border border-white/12 bg-white/8 font-medium text-white transition hover:border-cyan-100/22 hover:bg-white/14"
                disabled={busy}
                type="submit"
              >
                {busy ? "Preparando..." : "Unirse"}
                {busy ? <LoaderCircle className="animate-spin" size={18} /> : <ArrowRight size={18} />}
              </button>
            </div>

            {busy ? (
              <div
                aria-live="polite"
                className="mt-4 grid gap-2 rounded-md border border-white/8 bg-black/18 p-3"
              >
                <span className="brand-skeleton h-2.5 w-28 rounded-full" />
                <span className="brand-skeleton h-2.5 w-full rounded-full" />
              </div>
            ) : null}
          </form>
        </div>
      </section>

      <section className="relative mx-auto -mt-10 grid max-w-7xl gap-4 px-4 pb-10 sm:px-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-12">
        <div className="surface-panel rounded-lg border border-white/10 p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-slate-400">Dashboard</p>
              <h2 className="text-xl font-semibold text-white">
                Continuar reuniones
              </h2>
            </div>
            <button
              className="motion-lift inline-flex h-11 items-center gap-2 rounded-md border border-cyan-200/25 bg-cyan-200/10 px-3 text-sm text-cyan-50 transition hover:bg-cyan-200/16"
              onClick={() => createFastMeeting()}
              title="Crear una sala con codigo nuevo"
              type="button"
            >
              <Copy size={16} />
              Reunion rapida
            </button>
          </div>

          <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <span className="rounded-md border border-white/8 bg-black/18 px-3 py-2 text-sm text-slate-200">
              <History className="mr-2 inline text-cyan-100" size={15} />
              {recentMeetings.length} salas locales
            </span>
            <span className="rounded-md border border-white/8 bg-black/18 px-3 py-2 text-sm text-slate-200">
              <UsersRound className="mr-2 inline text-cyan-100" size={15} />
              {participantFootprint || 0} participantes vistos
            </span>
            <span className="rounded-md border border-white/8 bg-black/18 px-3 py-2 text-sm text-slate-200">
              <Clock3 className="mr-2 inline text-cyan-100" size={15} />
              {recentMeetings[0]
                ? relativeTime(recentMeetings[0].lastJoinedAt)
                : "sin actividad"}
            </span>
            <span className="rounded-md border border-white/8 bg-black/18 px-3 py-2 text-sm text-slate-200">
              <CalendarClock className="mr-2 inline text-cyan-100" size={15} />
              {scheduledMeetings.length} en agenda
            </span>
          </div>

          {dashboardNotice ? (
            <p
              aria-live="polite"
              className="mb-4 rounded-md border border-cyan-200/18 bg-cyan-200/10 px-3 py-2 text-sm text-cyan-50"
            >
              {dashboardNotice}
            </p>
          ) : null}

          {recentMeetings.length ? (
            <div className="grid gap-3 xl:grid-cols-2">
              {recentMeetings.slice(0, 4).map((meeting) => (
                <article
                  className="motion-lift rounded-lg border border-white/9 bg-white/[0.045] p-4 transition hover:border-cyan-100/18 hover:bg-white/[0.075]"
                  key={meeting.roomId}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-medium text-white">
                          Sala {meeting.roomId}
                        </h3>
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs ${
                            looksRecentlyLive(meeting.lastJoinedAt)
                              ? "bg-teal-300/16 text-teal-100"
                              : "bg-white/8 text-slate-300"
                          }`}
                          title="Estado estimado por actividad local; el backend valida al entrar."
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-teal-200" />
                          {looksRecentlyLive(meeting.lastJoinedAt)
                            ? "En vivo"
                            : "Reciente"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-300">
                        {meeting.createdByYou ? "Ultima reunion creada" : "Ultima sala usada"}{" "}
                        {relativeTime(meeting.lastJoinedAt)}
                      </p>
                    </div>
                    <span className="rounded-md bg-black/24 px-2 py-1 font-mono text-xs text-cyan-100">
                      {meeting.lastRole === "owner" ? "Owner" : "Invitado"}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
                    <span
                      className="rounded-md border border-white/8 bg-black/18 px-2 py-1"
                      title="Conteo visto en la ultima sesion de este navegador"
                    >
                      {meeting.participantCount} participantes conectados
                    </span>
                    <span className="rounded-md border border-white/8 bg-black/18 px-2 py-1">
                      {meeting.visits} accesos
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      className="inline-flex h-9 items-center gap-1 rounded-md bg-cyan-300 px-3 text-sm font-medium text-slate-950 hover:bg-cyan-200"
                      onClick={() => rejoinRecentMeeting(meeting)}
                      title="Volver a solicitar acceso con tu nombre actual"
                      type="button"
                    >
                      <ArrowRight size={15} />
                      Reingresar
                    </button>
                    <button
                      aria-label={`Copiar enlace de ${meeting.roomId}`}
                      className="inline-flex h-9 items-center gap-1 rounded-md bg-white/8 px-3 text-sm text-white hover:bg-white/14"
                      onClick={() => copyMeetingLink(meeting)}
                      title="Copiar enlace"
                      type="button"
                    >
                      <Copy size={15} />
                      Copiar
                    </button>
                    <button
                      className="inline-flex h-9 items-center gap-1 rounded-md border border-white/10 px-3 text-sm text-slate-100 hover:bg-white/8"
                      onClick={() => createFastMeeting()}
                      title="Crear otra reunion con codigo nuevo"
                      type="button"
                    >
                      <Plus size={15} />
                      Crear similar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {workspaceCards.map((meeting) => (
                <article
                  className="rounded-lg border border-dashed border-white/12 bg-white/[0.035] p-4"
                  key={meeting.code}
                >
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-coral-soft text-rose-50">
                      <CalendarClock size={18} />
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-medium text-white">{meeting.name}</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-300">
                        {meeting.note}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          <section className="mt-5 grid gap-3 border-t border-white/8 pt-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="font-medium text-white">Agenda local</h3>
                <span
                  className="rounded-md bg-white/7 px-2 py-1 text-xs text-slate-300"
                  title="Se reemplazara por backend persistente en la integracion futura."
                >
                  Mock elegante
                </span>
              </div>

              {scheduledMeetings.length ? (
                <div className="grid gap-2">
                  {scheduledMeetings.slice(0, 3).map((meeting) => (
                    <article
                      className="flex flex-wrap items-center gap-3 rounded-lg border border-white/9 bg-black/18 p-3"
                      key={meeting.roomId}
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-teal-300/14 text-teal-100">
                        <CalendarClock size={18} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-white">{meeting.title}</p>
                        <p className="mt-1 text-sm text-slate-300">
                          {dateTimeLabel(meeting.scheduledFor)} - {meeting.roomId}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          className="inline-flex h-9 items-center gap-1 rounded-md bg-cyan-300 px-3 text-sm font-medium text-slate-950 hover:bg-cyan-200"
                          onClick={() => createFastMeeting(meeting.roomId)}
                          title="Crear esta sala programada ahora"
                          type="button"
                        >
                          <Video size={15} />
                          Iniciar
                        </button>
                        <button
                          aria-label={`Copiar invitacion de ${meeting.roomId}`}
                          className="grid h-9 w-9 place-items-center rounded-md bg-white/8 text-white hover:bg-white/14"
                          onClick={() => copyMeetingLink(meeting)}
                          title="Copiar invitacion"
                          type="button"
                        >
                          <Copy size={15} />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-white/12 bg-black/16 p-4 text-sm leading-6 text-slate-300">
                  Programa una sala local y arranca con el mismo codigo cuando
                  llegue la hora.
                </div>
              )}
            </div>

            <form
              className="rounded-lg border border-white/9 bg-white/[0.045] p-3"
              onSubmit={createScheduledMeeting}
            >
              <p className="inline-flex items-center gap-2 text-sm font-medium text-cyan-50">
                <CalendarPlus size={16} />
                Programar reunion
              </p>
              <input
                className="mt-3 h-10 w-full rounded-md border border-white/10 bg-black/24 px-3 text-sm text-white outline-none focus:border-cyan-200/55"
                maxLength={80}
                onChange={(event) => setScheduleTitle(event.target.value)}
                placeholder="Titulo"
                value={scheduleTitle}
              />
              <input
                className="mt-2 h-10 w-full rounded-md border border-white/10 bg-black/24 px-3 text-sm text-white outline-none focus:border-cyan-200/55"
                onChange={(event) => setScheduleTime(event.target.value)}
                type="datetime-local"
                value={scheduleTime}
              />
              <button
                className="motion-lift mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-cyan-100/20 bg-cyan-200/12 text-sm text-cyan-50 hover:bg-cyan-200/18"
                type="submit"
              >
                <Plus size={15} />
                Guardar agenda
              </button>
            </form>
          </section>
        </div>

        <aside className="surface-panel rounded-lg border border-white/10 p-4 sm:p-5">
          <p className="text-sm text-slate-400">Invitacion reciente</p>
          <h2 className="mt-1 text-xl font-semibold text-white">
            {inviteRoom ? "Lista para lobby" : "Pega un enlace"}
          </h2>
          {inviteRoom ? (
            <div className="mt-4 rounded-lg border border-cyan-200/16 bg-cyan-200/9 p-3">
              <span
                className="inline-flex items-center gap-1 rounded-md bg-teal-300/14 px-2 py-1 text-xs text-teal-100"
                title="El backend confirmara si la sala sigue activa"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-teal-200" />
                En vivo
              </span>
              <p className="mt-3 truncate font-mono text-sm text-cyan-50">
                {inviteRoom}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-200">
                Usa tu nombre actual para solicitar acceso o reingresar.
              </p>
              <button
                className="motion-lift mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-cyan-300 font-medium text-slate-950 hover:bg-cyan-200"
                onClick={() => rejoinRecentMeeting({ roomId: inviteRoom })}
                title="Abrir el lobby de esta invitacion"
                type="button"
              >
                <ArrowRight size={16} />
                Continuar
              </button>
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-dashed border-white/12 bg-black/18 p-3 text-sm leading-6 text-slate-300">
              Al abrir un enlace compartido, el codigo queda preparado aqui y en
              el formulario de entrada.
            </div>
          )}

          <div className="mt-5 border-t border-white/8 pt-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-slate-400">Invitaciones locales</p>
              <span className="rounded-md bg-white/7 px-2 py-1 text-xs text-slate-300">
                {invitations.length}
              </span>
            </div>
            {invitations.length ? (
              <div className="mt-3 grid gap-2">
                {invitations.slice(0, 3).map((invitation) => (
                  <article
                    className="rounded-md bg-white/[0.055] p-3"
                    key={invitation.roomId}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">
                          {invitation.title}
                        </p>
                        <p className="mt-1 truncate font-mono text-xs text-cyan-100">
                          {invitation.roomId}
                        </p>
                      </div>
                      <span className="rounded-md bg-black/22 px-2 py-1 text-xs text-slate-300">
                        {relativeTime(invitation.receivedAt)}
                      </span>
                    </div>
                    <button
                      className="mt-3 inline-flex h-9 w-full items-center justify-center gap-1 rounded-md bg-white/8 text-sm text-white hover:bg-white/14"
                      onClick={() => rejoinRecentMeeting(invitation)}
                      type="button"
                    >
                      <ArrowRight size={15} />
                      Abrir lobby
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-3 rounded-md bg-white/[0.045] px-3 py-2 text-sm leading-6 text-slate-300">
                Los enlaces recibidos y copiados quedaran aqui por navegador.
              </p>
            )}
          </div>

          <div className="mt-5">
            <p className="text-sm text-slate-400">Preparado para crecer</p>
            <h2 className="mt-1 text-xl font-semibold text-white">
              Modulos Conectate
            </h2>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-200">
              <article
                className="rounded-md bg-white/[0.055] px-3 py-2"
              >
                JWT y cuentas Conectate podran entrar sin cambiar WebRTC.
              </article>
              <article className="rounded-md bg-white/[0.055] px-3 py-2">
                Amigos, historial real y salas activas quedan listos para backend.
              </article>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
