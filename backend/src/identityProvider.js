const identityIdMaxLength = 120;
const configuredIdentityProvider = String(
  process.env.IDENTITY_PROVIDER || "guest"
).toLowerCase();

function normalizeIdentityId(value) {
  return String(value ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9:_-]/g, "")
    .slice(0, identityIdMaxLength);
}

export function getIdentityCapabilities() {
  return {
    activeProvider: "guest",
    configuredProvider: configuredIdentityProvider,
    jwtAccepted: false,
    profiles: "ephemeral"
  };
}

export function resolveSocketIdentity(socket) {
  const auth = socket.handshake.auth ?? {};

  return {
    authMode: "standalone",
    authenticated: false,
    profileId: normalizeIdentityId(auth.profileId),
    provider: "guest",
    sessionId: normalizeIdentityId(auth.guestSessionId) || `socket:${socket.id}`
  };
}
