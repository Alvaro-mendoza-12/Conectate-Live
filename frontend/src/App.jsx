import { useEffect, useState } from "react";
import { LobbyScreen, SessionEnded } from "./components/LobbyScreen.jsx";
import { MeetingRoom } from "./components/MeetingRoom.jsx";
import { ProductHome } from "./components/ProductHome.jsx";
import { useMeeting } from "./hooks/useMeeting.js";
import { syncPageMetadata } from "./lib/metadata.js";
import { roomFromLocation } from "./lib/room.js";

export default function App() {
  const meeting = useMeeting();
  const [draft, setDraft] = useState(null);

  useEffect(() => {
    syncPageMetadata({
      roomId: meeting.roomId || draft?.roomId || roomFromLocation(),
      status: meeting.status
    });
  }, [draft?.roomId, meeting.roomId, meeting.status]);

  function prepareMeeting(nextDraft) {
    if (nextDraft.mode === "create") {
      setDraft(null);
      meeting.joinMeeting(nextDraft);
      return;
    }

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
    return (
      <SessionEnded
        endState={meeting.endState}
        error={meeting.error}
        onReturn={returnHome}
      />
    );
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

  return (
    <ProductHome
      busy={meeting.status === "joining"}
      error={meeting.error}
      onPrepare={prepareMeeting}
    />
  );
}
