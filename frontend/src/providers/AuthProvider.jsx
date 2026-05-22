import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { createLocalAuthAdapter } from "../adapters/local/localAuthAdapter.js";
import { standaloneCapabilities } from "../domain/contracts.js";

const AuthContext = createContext(null);

export function AuthProvider({ adapter, children }) {
  const activeAdapter = useMemo(
    () => adapter ?? createLocalAuthAdapter(),
    [adapter]
  );
  const [session, setSession] = useState(() => activeAdapter.getSession());

  const updateGuestProfile = useCallback((patch) => {
    const nextSession = activeAdapter.updateProfile(patch);

    setSession(nextSession);
    return nextSession.profile;
  }, [activeAdapter]);

  const value = useMemo(
    () => ({
      adapter: activeAdapter,
      capabilities: standaloneCapabilities.auth,
      getAccessToken: activeAdapter.getAccessToken,
      profile: session.profile,
      session,
      updateGuestProfile
    }),
    [activeAdapter, session, updateGuestProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth requiere AuthProvider.");
  }

  return context;
}
