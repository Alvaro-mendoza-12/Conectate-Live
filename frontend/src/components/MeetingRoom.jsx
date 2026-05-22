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

export function MeetingRoom({ meeting }) {
  const [mobilePanel, setMobilePanel] = useState("video");
  const [sidePanel, setSidePanel] = useState("chat");
  const [copied, setCopied] = useState(false);
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

      <nav className="grid grid-cols-4 gap-1 border-b border-white/8 p-2 lg:hidden">
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

      <section className="grid min-h-0 flex-1 gap-2 p-2 sm:gap-3 sm:p-3 lg:grid-cols-[250px_minmax(0,1fr)_340px] lg:p-4">
        <UserPanel
          className={`${mobilePanel === "users" ? "flex" : "hidden"} lg:flex`}
          onModerate={meeting.moderateUser}
          self={meeting.self}
          users={meeting.users}
        />

        <section
          className={`${mobilePanel === "video" ? "flex" : "hidden"} min-h-0 flex-col overflow-y-auto rounded-lg border border-white/10 bg-[#0e1220]/74 p-2 sm:p-3 lg:flex`}
        >
          <div className="grid content-start gap-2 sm:gap-3 md:grid-cols-2 lg:grid-cols-1 min-[1500px]:grid-cols-2 min-[2100px]:grid-cols-3">
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
                  Comparte el enlace para recibir solicitudes de entrada.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <span className="brand-skeleton h-16 rounded-md" />
                  <span className="brand-skeleton h-16 rounded-md" />
                </div>
              </div>
            </section>
          ) : null}
        </section>

        <section
          className={`${
            ["board", "chat"].includes(mobilePanel) ? "flex" : "hidden"
          } min-h-0 flex-col gap-2 lg:flex`}
        >
          <nav className="hidden grid-cols-2 gap-1 rounded-lg border border-white/8 bg-black/18 p-1 lg:grid">
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
            } ${sidePanel === "chat" ? "lg:flex" : "lg:hidden"}`}
            messages={meeting.messages}
            onSend={meeting.sendMessage}
            self={meeting.self}
          />
          <WhiteboardPanel
            canClear={owner}
            className={`${
              mobilePanel === "board" ? "flex" : "hidden"
            } ${sidePanel === "board" ? "lg:flex" : "lg:hidden"}`}
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
