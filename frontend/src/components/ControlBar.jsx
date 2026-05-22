import {
  LogOut,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  Power,
  RefreshCw,
  UsersRound,
  Video,
  VideoOff
} from "lucide-react";

function ControlButton({ active = false, danger = false, label, onClick, children }) {
  const tone = danger
    ? "bg-rose-400 text-slate-950 hover:bg-rose-300"
    : active
      ? "bg-teal-300 text-slate-950 hover:bg-teal-200"
      : "bg-white/9 text-slate-100 hover:bg-white/15";

  return (
    <button
      aria-label={label}
      className={`grid h-12 w-12 place-items-center rounded-md transition ${tone}`}
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

export function ControlBar({
  mediaState,
  canClose,
  onCloseMeeting,
  onLeave,
  onMobilePanel,
  onReconnectCall,
  onToggleCamera,
  onToggleMic,
  onToggleScreen
}) {
  return (
    <footer className="flex items-center justify-start gap-2 overflow-x-auto border-t border-white/8 bg-[#0a0d15]/94 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:justify-center">
      <ControlButton
        active={mediaState.micEnabled}
        label={mediaState.micEnabled ? "Silenciar microfono" : "Activar microfono"}
        onClick={onToggleMic}
      >
        {mediaState.micEnabled ? <Mic size={19} /> : <MicOff size={19} />}
      </ControlButton>

      <ControlButton
        active={mediaState.cameraEnabled}
        label={mediaState.cameraEnabled ? "Apagar camara" : "Activar camara"}
        onClick={onToggleCamera}
      >
        {mediaState.cameraEnabled ? <Video size={19} /> : <VideoOff size={19} />}
      </ControlButton>

      <ControlButton
        active={mediaState.screenSharing}
        label={mediaState.screenSharing ? "Detener pantalla" : "Compartir pantalla"}
        onClick={onToggleScreen}
      >
        <MonitorUp size={19} />
      </ControlButton>

      <ControlButton label="Reconectar llamada" onClick={onReconnectCall}>
        <RefreshCw size={19} />
      </ControlButton>

      <span className="mx-1 h-8 w-px bg-white/10 lg:hidden" />

      <span className="lg:hidden">
        <ControlButton label="Ver chat" onClick={() => onMobilePanel("chat")}>
          <MessageSquare size={19} />
        </ControlButton>
      </span>

      <span className="lg:hidden">
        <ControlButton label="Ver usuarios" onClick={() => onMobilePanel("users")}>
          <UsersRound size={19} />
        </ControlButton>
      </span>

      <ControlButton danger label="Salir" onClick={onLeave}>
        <LogOut size={19} />
      </ControlButton>

      {canClose ? (
        <ControlButton danger label="Cerrar reunion" onClick={onCloseMeeting}>
          <Power size={19} />
        </ControlButton>
      ) : null}
    </footer>
  );
}
