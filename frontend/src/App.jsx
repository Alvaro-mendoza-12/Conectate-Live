import { useState } from "react";
import { LobbyScreen, SessionEnded } from "./components/LobbyScreen.jsx";
import { MeetingRoom } from "./components/MeetingRoom.jsx";
import { ProductHome } from "./components/ProductHome.jsx";
import { useMeeting } from "./hooks/useMeeting.js";

export default function App() {
  const meeting = useMeeting();
  const [draft, setDraft] = useState(null);

  function prepareMeeting(nextDraft) {
    setDraft(nextDraft);
    meeting.requestLocalMedia();
  }

  function returnHome() {
    meeting.leaveMeeting();
    setDraft(null);
  }

  if (meeting.status === "joined") {
    return <MeetingRoom meeting={meeting} />;
  }

  if (meeting.status === "ended") {
    return <SessionEnded error={meeting.error} onReturn={returnHome} />;
  }

  if (draft) {
    return (
      <LobbyScreen
        draft={draft}
        meeting={meeting}
        onBack={returnHome}
        onEnter={() => meeting.joinMeeting(draft)}
      />
    );
  }

  return <ProductHome error={meeting.error} onPrepare={prepareMeeting} />;
}
