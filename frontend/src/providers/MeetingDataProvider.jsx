import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import { createLocalMeetingAdapter } from "../adapters/local/localMeetingAdapter.js";
import { standaloneCapabilities } from "../domain/contracts.js";

const MeetingDataContext = createContext(null);

export function MeetingDataProvider({ adapter, children }) {
  const activeAdapter = useMemo(
    () => adapter ?? createLocalMeetingAdapter(),
    [adapter]
  );
  const [dashboard, setDashboard] = useState(() => activeAdapter.getDashboard());

  const refreshDashboard = useCallback(() => {
    const next = activeAdapter.getDashboard();

    setDashboard(next);
    return next;
  }, [activeAdapter]);

  const runAndRefresh = useCallback((method, ...args) => {
    const result = activeAdapter[method](...args);

    refreshDashboard();
    return result;
  }, [activeAdapter, refreshDashboard]);

  const rememberAdmission = useCallback(
    (...args) => runAndRefresh("rememberAdmission", ...args),
    [runAndRefresh]
  );
  const rememberInvitation = useCallback(
    (...args) => runAndRefresh("rememberInvitation", ...args),
    [runAndRefresh]
  );
  const scheduleMeeting = useCallback(
    (...args) => runAndRefresh("scheduleMeeting", ...args),
    [runAndRefresh]
  );
  const updateParticipants = useCallback(
    (...args) => runAndRefresh("updateParticipants", ...args),
    [runAndRefresh]
  );

  useEffect(() => {
    function refreshFromAnotherTab() {
      refreshDashboard();
    }

    window.addEventListener("storage", refreshFromAnotherTab);
    return () => window.removeEventListener("storage", refreshFromAnotherTab);
  }, [activeAdapter]);

  const value = useMemo(
    () => ({
      capabilities: standaloneCapabilities.meetings,
      dashboard,
      refreshDashboard,
      rememberAdmission,
      rememberInvitation,
      scheduleMeeting,
      updateParticipants
    }),
    [
      dashboard,
      refreshDashboard,
      rememberAdmission,
      rememberInvitation,
      scheduleMeeting,
      updateParticipants
    ]
  );

  return (
    <MeetingDataContext.Provider value={value}>
      {children}
    </MeetingDataContext.Provider>
  );
}

export function useMeetingData() {
  const context = useContext(MeetingDataContext);

  if (!context) {
    throw new Error("useMeetingData requiere MeetingDataProvider.");
  }

  return context;
}
