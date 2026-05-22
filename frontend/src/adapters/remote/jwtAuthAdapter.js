import { authModes } from "../../domain/contracts.js";

// This adapter is intentionally inert until Conectate exposes a stable token API.
export function createJwtAuthAdapter({ apiClient, readToken }) {
  return {
    async getAccessToken() {
      return readToken?.() ?? null;
    },
    getSession() {
      throw new Error(
        "JWT auth adapter listo, pero no configurado en modo standalone."
      );
    },
    async loadProfile() {
      return apiClient.request("/api/me");
    },
    mode: authModes.jwt,
    updateProfile() {
      throw new Error("Los perfiles remotos se guardaran en la API Conectate.");
    }
  };
}
