export const authModes = Object.freeze({
  standalone: "standalone",
  jwt: "jwt"
});

export const meetingPermissions = Object.freeze({
  admit: "meeting:admit",
  close: "meeting:close",
  clearBoard: "meeting:whiteboard:clear",
  invite: "meeting:invite",
  moderate: "meeting:moderate"
});

export const standaloneCapabilities = Object.freeze({
  auth: {
    mode: authModes.standalone,
    persistentPermissions: false,
    profiles: "guest"
  },
  meetings: {
    history: "browser",
    invitations: "browser",
    scheduling: "browser"
  },
  realtime: {
    signaling: "socket.io",
    media: "webrtc-mesh",
    whiteboard: "socket.io"
  }
});

export function permissionsForRole(role) {
  if (role !== "owner") {
    return [meetingPermissions.invite];
  }

  return Object.values(meetingPermissions);
}

export function hasMeetingPermission(role, permission) {
  return permissionsForRole(role).includes(permission);
}

/**
 * @typedef {Object} LiveSession
 * @property {string} id
 * @property {"standalone" | "jwt"} authMode
 * @property {boolean} authenticated
 * @property {{ id: string, displayName: string, kind: "guest" | "member" }} profile
 */

/**
 * The provider contracts stay narrow on purpose. Future Supabase, Firebase or
 * JWT adapters only need to preserve these method names for the current UI.
 *
 * @typedef {Object} AuthAdapter
 * @property {() => LiveSession} getSession
 * @property {(patch: { displayName?: string }) => LiveSession} updateProfile
 * @property {() => Promise<string | null>} getAccessToken
 */

/**
 * @typedef {Object} MeetingDataAdapter
 * @property {() => { history: Array, invitations: Array, scheduled: Array }} getDashboard
 * @property {(meeting: Object) => Object} rememberAdmission
 * @property {(roomId: string, participantCount: number) => Object | null} updateParticipants
 * @property {(invitation: Object) => Object | null} rememberInvitation
 * @property {(meeting: Object) => Object | null} scheduleMeeting
 */
