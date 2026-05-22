const recentMeetingsKey = "conectate-live.recent-meetings.v1";
const maxRecentMeetings = 8;

function storageAvailable() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function sanitizeEntry(entry) {
  const roomId = String(entry?.roomId ?? "").trim();

  if (!roomId) {
    return null;
  }

  return {
    createdByYou: Boolean(entry.createdByYou),
    lastJoinedAt: entry.lastJoinedAt || new Date().toISOString(),
    lastRole: entry.lastRole === "owner" ? "owner" : "guest",
    participantCount: Math.max(1, Number(entry.participantCount) || 1),
    roomId,
    username: String(entry.username ?? "").trim(),
    visits: Math.max(1, Number(entry.visits) || 1)
  };
}

function writeRecentMeetings(meetings) {
  if (!storageAvailable()) {
    return;
  }

  window.localStorage.setItem(
    recentMeetingsKey,
    JSON.stringify(meetings.slice(0, maxRecentMeetings))
  );
}

export function readRecentMeetings() {
  if (!storageAvailable()) {
    return [];
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(recentMeetingsKey) ?? "[]");

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(sanitizeEntry)
      .filter(Boolean)
      .sort((left, right) => right.lastJoinedAt.localeCompare(left.lastJoinedAt))
      .slice(0, maxRecentMeetings);
  } catch {
    return [];
  }
}

export function rememberRecentMeeting({
  mode,
  participantCount,
  role,
  roomId,
  username
}) {
  const recent = readRecentMeetings();
  const previous = recent.find((entry) => entry.roomId === roomId);
  const next = sanitizeEntry({
    ...previous,
    createdByYou: previous?.createdByYou || mode === "create",
    lastJoinedAt: new Date().toISOString(),
    lastRole: role,
    participantCount,
    roomId,
    username,
    visits: (previous?.visits ?? 0) + 1
  });

  if (!next) {
    return [];
  }

  const meetings = [next, ...recent.filter((entry) => entry.roomId !== roomId)];

  writeRecentMeetings(meetings);
  return meetings;
}

export function updateRecentMeetingParticipants(roomId, participantCount) {
  const recent = readRecentMeetings();
  const next = recent.map((entry) =>
    entry.roomId === roomId
      ? sanitizeEntry({
          ...entry,
          participantCount
        })
      : entry
  );

  writeRecentMeetings(next.filter(Boolean));
}
