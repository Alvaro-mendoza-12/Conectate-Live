import { createLocalMeetingAdapter } from "../adapters/local/localMeetingAdapter.js";

// Compatibility layer for pre-provider imports and legacy browser history.
const adapter = createLocalMeetingAdapter();

export function readRecentMeetings() {
  return adapter.getDashboard().history;
}

export function rememberRecentMeeting(entry) {
  return adapter.rememberAdmission(entry);
}

export function updateRecentMeetingParticipants(roomId, participantCount) {
  return adapter.updateParticipants(roomId, participantCount);
}
