import {
  Copy,
  MessageSquare,
  Radio,
  RefreshCw,
  Signal,
  SignalLow,
  UsersRound,
  Video
} from "lucide-react";
import { useState } from "react";
import { ChatPanel } from "./ChatPanel.jsx";
import { ControlBar } from "./ControlBar.jsx";
import { UserPanel } from "./UserPanel.jsx";
import { VideoTile } from "./VideoTile.jsx";

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

export function MeetingRoom({ meeting }) {
  const [mobilePanel, setMobilePanel] = useState("video");
  const [copied, setCopied] = useState(false);

  async function copyRoom() {
    try {
      await navigator.clipboard.writeText(meeting.roomId);
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

  return (
    <main className="relative flex h-dvh min-h-screen flex-col overflow-hidden bg-[#080b13]/72">
      <header className="flex min-h-16 flex-wrap items-center gap-3 border-b border-white/8 px-3 py-2 sm:px-5">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">Campus Room</p>
          <div className="flex min-w-0 items-center gap-2 text-xs text-slate-300">
            <span className="truncate">Sala {meeting.roomId}</span>
            <button
              aria-label="Copiar codigo de sala"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-white/8 text-slate-100 hover:bg-white/14"
              onClick={copyRoom}
              title="Copiar codigo"
              type="button"
            >
              <Copy size={14} />
            </button>
            {copied ? <span className="text-teal-200">Copiado</span> : null}
          </div>
        </div>

        <span
          className={`ml-auto flex h-9 items-center gap-2 rounded-md px-3 text-sm ${connectionTone.className}`}
        >
          <ConnectionIcon size={15} />
          {connectionTone.label}
        </span>
      </header>

      {meeting.error ? (
        <p className="border-b border-rose-300/15 bg-rose-400/10 px-4 py-2 text-sm text-rose-100">
          {meeting.error}
        </p>
      ) : null}

      <nav className="grid grid-cols-3 gap-1 border-b border-white/8 p-2 lg:hidden">
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
      </nav>

      <section className="grid min-h-0 flex-1 gap-2 p-2 sm:gap-3 sm:p-3 lg:grid-cols-[250px_minmax(0,1fr)_340px] lg:p-4">
        <UserPanel
          className={`${mobilePanel === "users" ? "flex" : "hidden"} lg:flex`}
          self={meeting.self}
          users={meeting.users}
        />

        <section
          className={`${mobilePanel === "video" ? "flex" : "hidden"} min-h-0 flex-col overflow-y-auto rounded-lg border border-white/10 bg-[#0e1220]/74 p-2 sm:p-3 lg:flex`}
        >
          <div className="grid content-start gap-2 sm:grid-cols-2 sm:gap-3 2xl:grid-cols-3">
            <VideoTile
              local
              name={`${meeting.self.username} (Tu)`}
              screenSharing={meeting.mediaState.screenSharing}
              speaking={meeting.localSpeaking}
              stream={meeting.previewStream ?? meeting.localStream}
            />

            {meeting.remoteMedia.map((peer) => (
              <VideoTile
                connectionLabel={
                  peer.recovering
                    ? "Reconectando"
                    : ["failed", "disconnected"].includes(peer.iceState) ||
                        ["failed", "disconnected"].includes(peer.connectionState)
                      ? "Inestable"
                      : ""
                }
                key={peer.id}
                muted={peer.muted}
                name={peer.user?.username ?? "Participante"}
                onToggleMute={() => meeting.toggleRemoteMute(peer.id)}
                speaking={peer.speaking}
                stream={peer.stream}
              />
            ))}
          </div>

          {meeting.users.length <= 1 ? (
            <section className="mt-3 grid min-h-44 place-items-center rounded-lg border border-dashed border-white/12 bg-black/15 px-5 text-center">
              <div>
                <p className="text-base font-medium text-white">
                  Esperando participantes
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  Comparte el codigo de sala para que entren a la llamada.
                </p>
              </div>
            </section>
          ) : null}
        </section>

        <ChatPanel
          className={`${mobilePanel === "chat" ? "flex" : "hidden"} lg:flex`}
          messages={meeting.messages}
          onSend={meeting.sendMessage}
          self={meeting.self}
        />
      </section>

      <ControlBar
        mediaState={meeting.mediaState}
        onLeave={meeting.leaveMeeting}
        onMobilePanel={setMobilePanel}
        onReconnectCall={meeting.reconnectCall}
        onToggleCamera={meeting.toggleCamera}
        onToggleMic={meeting.toggleMic}
        onToggleScreen={meeting.toggleScreenShare}
      />

      {!meeting.connected ? (
        <section className="absolute inset-0 z-20 grid place-items-center bg-[#070a11]/86 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-lg border border-white/10 bg-[#101522] p-5 text-center shadow-2xl shadow-black/45">
            <p className="text-lg font-semibold text-white">Usuario desconectado</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              La sala intentara recuperar Socket.IO. Revisa la red si el estado no vuelve.
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
