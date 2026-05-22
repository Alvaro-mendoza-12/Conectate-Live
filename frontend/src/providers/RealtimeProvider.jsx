import { createContext, useContext, useMemo } from "react";
import { createSocketRealtimeAdapter } from "../adapters/socket/socketRealtimeAdapter.js";
import { standaloneCapabilities } from "../domain/contracts.js";
import { useAuth } from "./AuthProvider.jsx";

const RealtimeContext = createContext(null);

export function RealtimeProvider({ adapter, children }) {
  const { session } = useAuth();
  const activeAdapter = useMemo(
    () => adapter ?? createSocketRealtimeAdapter(session),
    [adapter, session]
  );
  const value = useMemo(
    () => ({
      capabilities: standaloneCapabilities.realtime,
      createSocket: activeAdapter.createSocket,
      kind: activeAdapter.kind
    }),
    [activeAdapter]
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  const context = useContext(RealtimeContext);

  if (!context) {
    throw new Error("useRealtime requiere RealtimeProvider.");
  }

  return context;
}
