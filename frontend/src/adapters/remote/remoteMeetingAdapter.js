// Future REST adapter. The local provider uses the same surface today.
export function createRemoteMeetingAdapter({ apiClient }) {
  return {
    getDashboard() {
      throw new Error("El catalogo remoto requiere cargarlo desde la API.");
    },
    listDashboard: () => apiClient.request("/api/meetings/dashboard"),
    rememberAdmission: (meeting) =>
      apiClient.request("/api/meetings/history", {
        body: JSON.stringify(meeting),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      }),
    rememberInvitation: (invitation) =>
      apiClient.request("/api/invitations", {
        body: JSON.stringify(invitation),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      }),
    scheduleMeeting: (meeting) =>
      apiClient.request("/api/meetings", {
        body: JSON.stringify(meeting),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      }),
    updateParticipants: () => null
  };
}
