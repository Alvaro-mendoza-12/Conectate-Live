import { apiBaseUrl } from "../lib/config.js";

function urlFor(path) {
  return new URL(path, `${apiBaseUrl.replace(/\/$/, "")}/`).toString();
}

export function createLiveApiClient({
  fetchImpl = globalThis.fetch,
  getAccessToken = async () => null
} = {}) {
  async function request(path, options = {}) {
    if (!fetchImpl) {
      throw new Error("Fetch no esta disponible en este runtime.");
    }

    const token = await getAccessToken();
    const response = await fetchImpl(urlFor(path), {
      ...options,
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers
      }
    });

    if (!response.ok) {
      throw new Error(`API ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  return {
    getCapabilities: () => request("/api/capabilities"),
    getRoomStatus: (roomId) => request(`/api/rooms/${encodeURIComponent(roomId)}/status`),
    request
  };
}
