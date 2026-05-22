import { authModes } from "../../domain/contracts.js";
import {
  getBrowserStorage,
  randomId,
  readJson,
  writeJson
} from "./browserStorage.js";

const guestProfileKey = "conectate-live.guest-profile.v1";
const guestSessionKey = "conectate-live.guest-session.v1";

function cleanDisplayName(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 32);
}

function defaultProfile() {
  return {
    createdAt: new Date().toISOString(),
    displayName: "",
    id: randomId("guest-profile"),
    kind: "guest",
    updatedAt: new Date().toISOString()
  };
}

function loadProfile() {
  const storage = getBrowserStorage("local");
  const stored = readJson(storage, guestProfileKey, null);

  if (!stored?.id) {
    return writeJson(storage, guestProfileKey, defaultProfile());
  }

  return {
    ...defaultProfile(),
    ...stored,
    displayName: cleanDisplayName(stored.displayName),
    id: String(stored.id),
    kind: "guest"
  };
}

function loadSession(profile) {
  const storage = getBrowserStorage("session");
  const stored = readJson(storage, guestSessionKey, null);

  if (stored?.id) {
    return {
      ...stored,
      authMode: authModes.standalone,
      authenticated: false,
      profile
    };
  }

  return writeJson(storage, guestSessionKey, {
    authMode: authModes.standalone,
    authenticated: false,
    createdAt: new Date().toISOString(),
    id: randomId("guest-session"),
    profile
  });
}

function persistSession(session) {
  return writeJson(getBrowserStorage("session"), guestSessionKey, {
    authMode: session.authMode,
    authenticated: session.authenticated,
    createdAt: session.createdAt,
    id: session.id
  });
}

export function createLocalAuthAdapter() {
  return {
    getAccessToken: async () => null,
    getSession() {
      return loadSession(loadProfile());
    },
    updateProfile(patch = {}) {
      const profile = loadProfile();
      const nextProfile = {
        ...profile,
        displayName: cleanDisplayName(patch.displayName ?? profile.displayName),
        updatedAt: new Date().toISOString()
      };

      writeJson(getBrowserStorage("local"), guestProfileKey, nextProfile);

      const session = {
        ...loadSession(nextProfile),
        profile: nextProfile
      };

      persistSession(session);
      return session;
    }
  };
}
