export const roomActions = Object.freeze({
  admit: "admit",
  clearBoard: "clear-board",
  close: "close",
  moderate: "moderate"
});

export function canPerformRoomAction(user, action) {
  if (!user || user.role !== "owner") {
    return false;
  }

  return Object.values(roomActions).includes(action);
}
