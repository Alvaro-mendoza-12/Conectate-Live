import {
  Check,
  Copy,
  Crown,
  Grid2X2,
  Link2,
  MessageSquare,
  PenLine,
  Radio,
  RefreshCw,
  Signal,
  SignalLow,
  UserPlus,
  UsersRound,
  Video,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocalRecording } from "../hooks/useLocalRecording.js";
import { meetingLink } from "../lib/room.js";
import { useMeetingData } from "../providers/MeetingDataProvider.jsx";
import { BrandLogo } from "./BrandLogo.jsx";
import { ChatPanel } from "./ChatPanel.jsx";
import { ControlBar } from "./ControlBar.jsx";
import { UserPanel } from "./UserPanel.jsx";
import { VideoTile } from "./VideoTile.jsx";
import { WhiteboardPanel } from "./WhiteboardPanel.jsx";

function ViewButton({ active, children, icon: Icon, onClick }) {
  return (
    <button
      className={`flex h-10 items-center justify-center gap-2 rounded-md px-3 text-sm transition ${
        active ? "bg-white/14 text-white" : "text-slate-300 hover:bg-white/8"
      }`}
      onClick={onClick}
      type="button"
    >
      <Icon size={16} />
      {children}
    </button>
  );
}

function AdmissionDock({ meeting }) {
  if (meeting.self?.role !== "owner" || meeting.joinRequests.length === 0) {
    return null;
  }

  return (
    <aside className="absolute right-3 top-24 z-10 w-[min(calc(100vw-1.5rem),360px)] rounded-lg border border-cyan-200/22 bg-[#10182b]/96 p-4 shadow-2xl shadow-black/45 backdrop-blur-md sm:right-5">
      <header className="mb-3 flex items-center gap-2 text-sm font-medium text-cyan-50">
        <UserPlus size={17} />
        Solicitudes de entrada
        <span className="ml-auto rounded-md bg-cyan-200/14 px-2 py-0.5 text-xs">
          {meeting.joinRequests.length}
        </span>
      </header>
      <div className="grid max-h-64 gap-2 overflow-y-auto">
        {meeting.joinRequests.map((request) => (
          <article
            className="rounded-md border border-white/10 bg-black/22 p-3"
            key={request.id}
          >
            <p className="truncate text-sm text-white">
              <span className="font-medium">{request.username}</span> quiere entrar
            </p>
            <div className="mt-3 flex gap-2">
              <button
                className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-md bg-cyan-300 text-sm font-medium text-slate-950 hover:bg-cyan-200"
                onClick={() => meeting.respondToJoinRequest(request, true)}
                type="button"
              >
                <Check size={15} />
                Aceptar
              </button>
              <button
                className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-md bg-white/8 text-sm text-white hover:bg-white/14"
                onClick={() => meeting.respondToJoinRequest(request, false)}
                type="button"
              >
                <X size={15} />
                Rechazar
              </button>
            </div>
          </article>
        ))}
      </div>
    </aside>
  );
}

function peerConnectionLabel(peer) {
  if (peer.recovering) {
    return "Reconectando";
  }

  return ["failed", "disconnected"].includes(peer.iceState) ||
    ["failed", "disconnected"].includes(peer.connectionState)
    ? "Inestable"
    : "";
}

function gridShapeFor(count, width) {
  if (count <= 1) {
    return { columns: 1, rows: 1 };
  }

  const columns =
    width < 640
      ? count <= 2
        ? 1
        : 2
      : width < 1080
        ? count <= 4
          ? 2
          : 3
        : count <= 2
          ? 2
          : count <= 4
            ? 2
            : count <= 9
              ? 3
              : 4;

  return {
    columns,
    rows: Math.ceil(count / columns)
  };
}

export function MeetingRoom({ meeting }) {
  const [mobilePanel, setMobilePanel] = useState("video");
  const [sidePanel, setSidePanel] = useState("chat");
  const [copied, setCopied] = useState(false);
  const [stageFullscreen, setStageFullscreen] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === "undefined" ? 1280 : window.innerWidth
  );
  const focusStageRef = useRef(null);
  const owner = meeting.self.role === "owner";
  const shareLink = meetingLink(meeting.roomId);
  const recording = useLocalRecording({
    localStream: meeting.localStream,
    screenStream: meeting.mediaState.screenSharing
      ? meeting.previewStream
      : null
  });
  const { rememberInvitation } = useMeetingData();

  async function copyRoom() {
    try {
      await navigator.clipboard.writeText(shareLink);
      rememberInvitation({
        roomId: meeting.roomId,
        source: "copied",
        title: `Invitacion ${meeting.roomId}`
      });
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_200);
    } catch {
      setCopied(false);
    }
  }

  const connectionTone = {
    offline: {
      className: "bg-rose-300/14 text-rose-100",
      icon: SignalLow,
      label: "Desconectado"
    },
    reconnecting: {
      className: "bg-amber-300/14 text-amber-100",
      icon: Radio,
      label: "Reconectando"
    },
    stable: {
      className: "bg-teal-300/14 text-teal-100",
      icon: Signal,
      label: "Estable"
    },
    unstable: {
      className: "bg-amber-300/14 text-amber-100",
      icon: SignalLow,
      label: "Inestable"
    }
  }[meeting.connectionQuality];
  const ConnectionIcon = connectionTone.icon;
  const focusState = meeting.focusState;
  const usersById = useMemo(
    () => new Map(meeting.users.map((user) => [user.id, user])),
    [meeting.users]
  );
  const participants = useMemo(() => {
    const localParticipant = {
      id: meeting.self.id,
      local: true,
      name: `${meeting.self.username} (Tu)`,
      screenSharing: meeting.mediaState.screenSharing,
      speaking: meeting.localSpeaking,
      stream: meeting.previewStream ?? meeting.localStream
    };
    const remoteParticipants = meeting.remoteMedia.map((peer) => ({
      connectionLabel: peerConnectionLabel(peer),
      id: peer.id,
      muted: peer.muted,
      name: peer.user?.username ?? usersById.get(peer.id)?.username ?? "Participante",
      onToggleMute: () => meeting.toggleRemoteMute(peer.id),
      screenSharing: focusState?.mode === "screen" && focusState.targetId === peer.id,
      speaking: peer.speaking,
      stream: peer.stream
    }));
    const visibleIds = new Set([
      localParticipant.id,
      ...remoteParticipants.map((participant) => participant.id)
    ]);
    const waitingParticipants = meeting.users
      .filter((user) => !visibleIds.has(user.id))
      .map((user) => ({
        id: user.id,
        name: user.username,
        screenSharing: focusState?.mode === "screen" && focusState.targetId === user.id,
        stream: null
      }));

    return [localParticipant, ...remoteParticipants, ...waitingParticipants];
  }, [
    focusState,
    meeting.localSpeaking,
    meeting.localStream,
    meeting.mediaState.screenSharing,
    meeting.previewStream,
    meeting.remoteMedia,
    meeting.self.id,
    meeting.self.username,
    meeting.toggleRemoteMute,
    meeting.users,
    usersById
  ]);
  const focusedParticipant =
    focusState && participants.find((participant) => participant.id === focusState.targetId);
  const focusActive = Boolean(focusState && focusedParticipant);
  const gridShape = useMemo(
    () => gridShapeFor(participants.length, viewportWidth),
    [participants.length, viewportWidth]
  );
  const gridStyle = {
    gridTemplateColumns: `repeat(${gridShape.columns}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${gridShape.rows}, minmax(0, 1fr))`
  };
  const secondaryParticipants = focusActive
    ? participants.filter((participant) => participant.id !== focusedParticipant.id)
    : [];
  const canControlFocus =
    focusActive && (owner || focusState.targetId === meeting.self.id);
  const userPanelClass = focusActive
    ? "hidden xl:hidden"
    : `${mobilePanel === "users" ? "flex" : "hidden"} xl:flex`;

  useEffect(() => {
    function handleFullscreenChange() {
      setStageFullscreen(document.fullscreenElement === focusStageRef.current);
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    function handleResize() {
      setViewportWidth(window.innerWidth);
    }

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  async function toggleFocusFullscreen() {
    if (!focusStageRef.current) {
      return;
    }

    if (document.fullscreenElement === focusStageRef.current) {
      await document.exitFullscreen?.();
      return;
    }

    await focusStageRef.current.requestFullscreen?.();
  }

  function renderVideoTile(participant, options = {}) {
    return (
      <VideoTile
        className={options.className}
        compact={options.compact}
        connectionLabel={participant.connectionLabel}
        fullscreenActive={options.fullscreenActive}
        key={participant.id}
        local={participant.local}
        muted={participant.muted}
        name={participant.name}
        onFullscreen={options.onFullscreen}
        onToggleMute={participant.onToggleMute}
        screenSharing={participant.screenSharing}
        speaking={participant.speaking}
        spotlight={options.spotlight}
        stream={participant.stream}
      />
    );
  }

  return (
    <main className="room-shell relative flex h-dvh min-h-screen flex-col overflow-hidden bg-[#080b13]/72">
      <header className="flex min-h-16 flex-wrap items-center gap-3 border-b border-white/8 px-3 py-2 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <BrandLogo compact pulse tagline="" />
          <div className="flex min-w-0 items-center gap-2 text-xs text-slate-300">
            <span className="truncate">Reunion {meeting.roomId}</span>
            <button
              aria-label="Copiar enlace de reunion"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-white/8 text-slate-100 hover:bg-white/14"
              onClick={copyRoom}
              title="Copiar enlace"
              type="button"
            >
              <Copy size={14} />
            </button>
            {copied ? <span className="text-teal-200">Copiado</span> : null}
            {owner ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-200/14 px-2 py-1 text-amber-50">
                <Crown size={12} />
                Owner
              </span>
            ) : null}
            {owner && meeting.ownerPromotion ? (
              <span
                className="inline-flex items-center gap-1 rounded-md bg-cyan-200/14 px-2 py-1 text-cyan-50"
                title="El owner anterior salio y ahora administras la sala."
              >
                <Radio size={12} />
                Nuevo anfitrion
              </span>
            ) : null}
            {recording.active ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-rose-300/14 px-2 py-1 text-rose-100">
                <Radio size={12} />
                Grabando local
              </span>
            ) : null}
          </div>
        </div>

        <span
          className={`ml-auto flex h-9 items-center gap-2 rounded-md px-3 text-sm ${connectionTone.className}`}
        >
          <ConnectionIcon size={15} />
          {connectionTone.label}
        </span>
      </header>

      {owner ? (
        <section className="border-b border-white/8 bg-[#0a1020]/88 px-3 py-2 backdrop-blur-sm sm:px-5">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-md border border-white/10 bg-white/[0.055] px-3 py-2 text-slate-300">
              Codigo unico{" "}
              <span className="font-mono font-medium text-white">
                {meeting.roomId}
              </span>
            </span>
            <span className="flex min-w-0 items-center gap-2 rounded-md border border-white/10 bg-white/[0.055] px-3 py-2 text-slate-300">
              <Link2 className="shrink-0 text-cyan-100" size={15} />
              <span className="shrink-0">Enlace unico</span>
              <span className="max-w-[min(56vw,34rem)] truncate font-mono text-xs text-white">
                {shareLink}
              </span>
            </span>
            <button
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-cyan-300 px-3 font-medium text-slate-950 transition hover:bg-cyan-200"
              onClick={copyRoom}
              type="button"
            >
              <Copy size={15} />
              {copied ? "Copiado" : "Copiar enlace"}
            </button>
          </div>
        </section>
      ) : null}

      {meeting.error ? (
        <p className="border-b border-rose-300/15 bg-rose-400/10 px-4 py-2 text-sm text-rose-100">
          {meeting.error}
        </p>
      ) : null}
      {recording.error ? (
        <p className="border-b border-amber-300/15 bg-amber-300/10 px-4 py-2 text-sm text-amber-50">
          {recording.error}
        </p>
      ) : null}

      {meeting.recordingActive ? (
        <div className="pointer-events-none absolute left-0 right-0 top-16 z-30 flex justify-center px-4">
          <div className="mt-2 flex items-center gap-3 rounded-lg border border-rose-300/25 bg-rose-400/10 px-4 py-2.5 text-sm text-rose-100 shadow-2xl shadow-black/35 backdrop-blur-md">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-400" />
            <span className="font-medium">La reunión está siendo grabada</span>
            {meeting.recordingBy ? (
              <span className="text-rose-50/90">({meeting.recordingBy})</span>
            ) : null}
          </div>
        </div>
      ) : null}

      <nav className="grid grid-cols-4 gap-1 border-b border-white/8 p-2 xl:hidden">
        <ViewButton
          active={mobilePanel === "video"}
          icon={Video}
          onClick={() => setMobilePanel("video")}
        >
          Video
        </ViewButton>
        <ViewButton
          active={mobilePanel === "chat"}
          icon={MessageSquare}
          onClick={() => setMobilePanel("chat")}
        >
          Chat
        </ViewButton>
        <ViewButton
          active={mobilePanel === "users"}
          icon={UsersRound}
          onClick={() => setMobilePanel("users")}
        >
          Usuarios
        </ViewButton>
        <ViewButton
          active={mobilePanel === "board"}
          icon={PenLine}
          onClick={() => setMobilePanel("board")}
        >
          Pizarra
        </ViewButton>
      </nav>

      <section
        className={`grid min-h-0 flex-1 gap-2 p-2 sm:gap-3 sm:p-3 xl:p-4 ${
          focusActive
            ? "xl:grid-cols-1"
            : "xl:grid-cols-[250px_minmax(0,1fr)_340px]"
        }`}
      >
        <UserPanel
          className={userPanelClass}
          onModerate={meeting.moderateUser}
          self={meeting.self}
          users={meeting.users}
        />

        <section
          className={`${mobilePanel === "video" ? "flex" : "hidden"} relative min-h-0 flex-col overflow-hidden rounded-lg border border-white/10 bg-[#0e1220]/74 p-2 sm:p-3 xl:flex`}
        >
          {focusActive ? (
            <section
              className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md bg-[#080c15] p-2 fullscreen:bg-[#080c15] sm:p-3"
              ref={focusStageRef}
            >
              <div
                className={`grid min-h-0 flex-1 gap-2 overflow-hidden ${
                  secondaryParticipants.length > 0
                    ? "lg:grid-cols-[minmax(0,1fr)_minmax(150px,220px)]"
                    : "lg:grid-cols-1"
                }`}
              >
                <section className="relative min-h-0 overflow-hidden rounded-lg">
                  {renderVideoTile(focusedParticipant, {
                    className: "h-full min-h-0",
                    fullscreenActive: stageFullscreen,
                    onFullscreen: toggleFocusFullscreen,
                    spotlight: true
                  })}
                  <div className="absolute right-14 top-3 z-10 flex gap-2">
                    {canControlFocus ? (
                      <button
                        aria-label="Volver a cuadricula"
                        className="grid h-9 w-9 place-items-center rounded-md bg-black/55 text-white backdrop-blur hover:bg-black/75"
                        onClick={() => meeting.disableMeetingFocus("manual")}
                        title="Volver a cuadricula"
                        type="button"
                      >
                        <Grid2X2 size={17} />
                      </button>
                    ) : null}
                  </div>
                </section>

                {secondaryParticipants.length > 0 ? (
                  <aside className="flex min-h-[6rem] shrink-0 gap-2 overflow-x-auto overflow-y-hidden pb-1 lg:min-h-0 lg:flex-col lg:overflow-x-hidden lg:overflow-y-auto lg:pb-0 lg:pr-1">
                    {secondaryParticipants.map((participant) =>
                      renderVideoTile(participant, {
                        className: "w-36 shrink-0 sm:w-44 lg:w-full",
                        compact: true
                      })
                    )}
                  </aside>
                ) : null}
              </div>
            </section>
          ) : (
            <>
              <div
                className="grid min-h-0 flex-1 gap-2 overflow-hidden sm:gap-3"
                style={gridStyle}
              >
                {participants.map((participant) =>
                  renderVideoTile(participant, {
                    className: "h-full min-h-0"
                  })
                )}
              </div>

              {meeting.users.length <= 1 ? (
                <section className="pointer-events-none absolute inset-x-4 bottom-4 z-10 mx-auto grid max-w-md place-items-center rounded-lg border border-white/10 bg-black/42 px-4 py-3 text-center shadow-2xl shadow-black/30 backdrop-blur-md">
                  <div>
                    <p className="text-sm font-medium text-white">
                      Esperando participantes
                    </p>
                    <p className="mt-1 text-xs text-slate-300">
                      Comparte el enlace para recibir solicitudes de entrada.
                    </p>
                  </div>
                </section>
              ) : null}
            </>
          )}
        </section>

        <section
          className={`${
            ["board", "chat"].includes(mobilePanel) ? "flex" : "hidden"
          } ${focusActive ? "xl:hidden" : "xl:flex"} min-h-0 flex-col gap-2`}
        >
          <nav className="hidden grid-cols-2 gap-1 rounded-lg border border-white/8 bg-black/18 p-1 xl:grid">
            <ViewButton
              active={sidePanel === "chat"}
              icon={MessageSquare}
              onClick={() => setSidePanel("chat")}
            >
              Chat
            </ViewButton>
            <ViewButton
              active={sidePanel === "board"}
              icon={PenLine}
              onClick={() => setSidePanel("board")}
            >
              Pizarra
            </ViewButton>
          </nav>

          <ChatPanel
            className={`${
              mobilePanel === "chat" ? "flex" : "hidden"
            } ${sidePanel === "chat" ? "xl:flex" : "xl:hidden"}`}
            messages={meeting.messages}
            onSend={meeting.sendMessage}
            self={meeting.self}
          />
          <WhiteboardPanel
            canClear={owner}
            className={`${
              mobilePanel === "board" ? "flex" : "hidden"
            } ${sidePanel === "board" ? "xl:flex" : "xl:hidden"}`}
            onClear={meeting.clearMeetingWhiteboard}
            onStroke={meeting.sendWhiteboardStroke}
            strokes={meeting.whiteboardStrokes}
          />
        </section>
      </section>

      <ControlBar
        canClose={owner}
        mediaState={meeting.mediaState}
        onCloseMeeting={meeting.closeMeeting}
        onLeave={meeting.leaveMeeting}
        onMobilePanel={setMobilePanel}
        onReconnectCall={meeting.reconnectCall}
        onToggleCamera={meeting.toggleCamera}
        onToggleMic={meeting.toggleMic}
        onToggleScreen={meeting.toggleScreenShare}
        recording={recording}
      />

      <AdmissionDock meeting={meeting} />

      {!meeting.connected ? (
        <section className="absolute inset-0 z-20 grid place-items-center bg-[#070a11]/86 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-lg border border-white/10 bg-[#101522] p-5 text-center shadow-2xl shadow-black/45">
            <p className="text-lg font-semibold text-white">Usuario desconectado</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              La reunion intentara recuperar Socket.IO. Revisa la red si el estado no vuelve.
            </p>
            <button
              className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-md bg-indigo-300 px-4 font-medium text-slate-950 hover:bg-indigo-200"
              onClick={meeting.retrySocketConnection}
              type="button"
            >
              <RefreshCw size={17} />
              Reintentar conexion
            </button>
          </div>
        </section>
      ) : null}
    </main>
  );
}
