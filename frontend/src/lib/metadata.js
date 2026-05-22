const SITE_NAME = "Conectate Live";
const HOME_DESCRIPTION =
  "Reuniones privadas con video, chat y control de acceso para amigos y equipos.";

function upsertMeta(selector, attribute, value) {
  let node = document.head.querySelector(selector);

  if (!node) {
    node = document.createElement("meta");
    document.head.append(node);
  }

  node.setAttribute(attribute.name, attribute.value);
  node.setAttribute("content", value);
}

function syncCanonical(url) {
  let canonical = document.head.querySelector('link[rel="canonical"]');

  if (!canonical) {
    canonical = document.createElement("link");
    canonical.setAttribute("rel", "canonical");
    document.head.append(canonical);
  }

  canonical.setAttribute("href", url);
}

export function syncPageMetadata({ roomId = "", status = "home" } = {}) {
  const cleanRoom = String(roomId ?? "").trim();
  const shareUrl = new URL(window.location.href);

  shareUrl.hash = "";

  const meetingLabel =
    status === "joined"
      ? "Reunion en vivo"
      : cleanRoom
        ? "Unirse a reunion"
        : "Reuniones privadas";
  const title = `${SITE_NAME} | ${meetingLabel}`;
  const description = cleanRoom
    ? "Entra a una reunion privada de Conectate Live con acceso controlado por el owner."
    : HOME_DESCRIPTION;

  document.title = title;
  upsertMeta('meta[name="description"]', { name: "name", value: "description" }, description);
  upsertMeta('meta[property="og:title"]', { name: "property", value: "og:title" }, title);
  upsertMeta(
    'meta[property="og:description"]',
    { name: "property", value: "og:description" },
    description
  );
  upsertMeta('meta[property="og:url"]', { name: "property", value: "og:url" }, shareUrl.toString());
  upsertMeta('meta[name="twitter:title"]', { name: "name", value: "twitter:title" }, title);
  upsertMeta(
    'meta[name="twitter:description"]',
    { name: "name", value: "twitter:description" },
    description
  );
  syncCanonical(shareUrl.toString());
}
