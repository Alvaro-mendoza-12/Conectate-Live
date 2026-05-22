import { getBrowserStorage, readJson, writeJson } from "./browserStorage.js";

const catalogKey = "conectate-live.meeting-catalog.v1";
const legacyRecentKey = "conectate-live.recent-meetings.v1";
const maxHistory = 12;
const maxInvitations = 10;
const maxScheduled = 10;

function timestamp(value) {
  const date = new Date(value || Date.now());

  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function cleanRoomId(value) {
  return String(value ?? "").trim().slice(0, 48);
}

function cleanText(value, maxLength = 80) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function emptyCatalog() {
  return {
    history: [],
    invitations: [],
    scheduled: [],
    version: 1
  };
}

function sanitizeHistory(entry) {
  const roomId = cleanRoomId(entry?.roomId);

  if (!roomId) {
    return null;
  }

  return {
    createdAt: timestamp(entry.createdAt || entry.lastJoinedAt),
    createdByYou: Boolean(entry.createdByYou),
    lastJoinedAt: timestamp(entry.lastJoinedAt),
    lastRole: entry.lastRole === "owner" ? "owner" : "guest",
    ownerProfileId: cleanText(entry.ownerProfileId, 120),
    participantCount: Math.max(1, Number(entry.participantCount) || 1),
    roomId,
    title: cleanText(entry.title || `Sala ${roomId}`),
    username: cleanText(entry.username, 32),
    visits: Math.max(1, Number(entry.visits) || 1)
  };
}

function sanitizeInvitation(entry) {
  const roomId = cleanRoomId(entry?.roomId);

  if (!roomId) {
    return null;
  }

  return {
    copiedAt: timestamp(entry.copiedAt || entry.receivedAt),
    receivedAt: timestamp(entry.receivedAt || entry.copiedAt),
    roomId,
    source: ["copied", "link", "scheduled"].includes(entry.source)
      ? entry.source
      : "link",
    title: cleanText(entry.title || `Invitacion ${roomId}`)
  };
}

function sanitizeScheduled(entry) {
  const roomId = cleanRoomId(entry?.roomId);

  if (!roomId) {
    return null;
  }

  return {
    createdAt: timestamp(entry.createdAt),
    hostProfileId: cleanText(entry.hostProfileId, 120),
    roomId,
    scheduledFor: timestamp(entry.scheduledFor),
    title: cleanText(entry.title || "Reunion programada")
  };
}

function uniqueByRoom(entries) {
  const used = new Set();

  return entries.filter((entry) => {
    if (!entry || used.has(entry.roomId)) {
      return false;
    }

    used.add(entry.roomId);
    return true;
  });
}

function migrateLegacyHistory(storage) {
  const legacy = readJson(storage, legacyRecentKey, []);

  return Array.isArray(legacy)
    ? legacy.map(sanitizeHistory).filter(Boolean).slice(0, maxHistory)
    : [];
}

function readCatalog() {
  const storage = getBrowserStorage("local");
  const stored = readJson(storage, catalogKey, null);
  const catalog = stored ?? {
    ...emptyCatalog(),
    history: migrateLegacyHistory(storage)
  };

  return {
    history: uniqueByRoom(
      Array.isArray(catalog.history) ? catalog.history.map(sanitizeHistory) : []
    )
      .sort((left, right) => right.lastJoinedAt.localeCompare(left.lastJoinedAt))
      .slice(0, maxHistory),
    invitations: uniqueByRoom(
      Array.isArray(catalog.invitations)
        ? catalog.invitations.map(sanitizeInvitation)
        : []
    )
      .sort((left, right) => right.receivedAt.localeCompare(left.receivedAt))
      .slice(0, maxInvitations),
    scheduled: uniqueByRoom(
      Array.isArray(catalog.scheduled)
        ? catalog.scheduled.map(sanitizeScheduled)
        : []
    )
      .sort((left, right) => left.scheduledFor.localeCompare(right.scheduledFor))
      .slice(0, maxScheduled),
    version: 1
  };
}

function writeCatalog(catalog) {
  return writeJson(getBrowserStorage("local"), catalogKey, catalog);
}

export function createLocalMeetingAdapter() {
  return {
    getDashboard() {
      const catalog = readCatalog();

      writeCatalog(catalog);
      return catalog;
    },
    rememberAdmission(entry) {
      const catalog = readCatalog();
      const previous = catalog.history.find(
        (meeting) => meeting.roomId === cleanRoomId(entry.roomId)
      );
      const meeting = sanitizeHistory({
        ...previous,
        createdAt: previous?.createdAt || new Date().toISOString(),
        createdByYou: previous?.createdByYou || entry.mode === "create",
        lastJoinedAt: new Date().toISOString(),
        lastRole: entry.role,
        ownerProfileId: entry.role === "owner" ? entry.profileId : previous?.ownerProfileId,
        participantCount: entry.participantCount,
        roomId: entry.roomId,
        title: entry.title || previous?.title,
        username: entry.username,
        visits: (previous?.visits ?? 0) + 1
      });

      catalog.history = uniqueByRoom([meeting, ...catalog.history]).slice(
        0,
        maxHistory
      );
      catalog.invitations = catalog.invitations.filter(
        (invitation) => invitation.roomId !== meeting.roomId
      );
      writeCatalog(catalog);
      return meeting;
    },
    rememberInvitation(entry) {
      const catalog = readCatalog();
      const invitation = sanitizeInvitation({
        ...entry,
        receivedAt: new Date().toISOString()
      });

      if (!invitation) {
        return null;
      }

      catalog.invitations = uniqueByRoom([invitation, ...catalog.invitations]).slice(
        0,
        maxInvitations
      );
      writeCatalog(catalog);
      return invitation;
    },
    scheduleMeeting(entry) {
      const catalog = readCatalog();
      const meeting = sanitizeScheduled({
        ...entry,
        createdAt: new Date().toISOString()
      });

      if (!meeting) {
        return null;
      }

      catalog.scheduled = uniqueByRoom([meeting, ...catalog.scheduled]).slice(
        0,
        maxScheduled
      );
      catalog.invitations = uniqueByRoom([
        sanitizeInvitation({
          roomId: meeting.roomId,
          source: "scheduled",
          title: meeting.title
        }),
        ...catalog.invitations
      ]).slice(0, maxInvitations);
      writeCatalog(catalog);
      return meeting;
    },
    updateParticipants(roomId, participantCount) {
      const catalog = readCatalog();
      const meeting = catalog.history.find(
        (entry) => entry.roomId === cleanRoomId(roomId)
      );

      if (!meeting) {
        return null;
      }

      meeting.participantCount = Math.max(1, Number(participantCount) || 1);
      writeCatalog(catalog);
      return meeting;
    }
  };
}
