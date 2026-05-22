import { JoinPanel } from "./components/JoinPanel.jsx";
import { MeetingRoom } from "./components/MeetingRoom.jsx";
import { useMeeting } from "./hooks/useMeeting.js";

export default function App() {
  const meeting = useMeeting();

  if (meeting.status === "joined") {
    return <MeetingRoom meeting={meeting} />;
  }

  return (
    <JoinPanel
      error={meeting.error}
      joining={meeting.status === "joining"}
      onJoin={meeting.joinMeeting}
    />
  );
}

