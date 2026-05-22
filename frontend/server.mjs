import { createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const host = process.env.FRONTEND_HOST || "0.0.0.0";
const port = Number(process.env.FRONTEND_PORT || 4173);
const frontendDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(frontendDir, "dist");
const indexFile = path.join(distDir, "index.html");
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};

function log(level, event, details = {}) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    service: "frontend",
    event,
    ...details
  };

  console[level === "error" ? "error" : "log"](JSON.stringify(payload));
}

function isInsideDist(filePath) {
  return filePath === distDir || filePath.startsWith(`${distDir}${path.sep}`);
}

async function requestedFile(requestUrl) {
  const pathname = decodeURIComponent(
    new URL(requestUrl || "/", `http://${host}:${port}`).pathname
  );
  const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
  const candidatePath = path.resolve(distDir, relativePath);

  if (!isInsideDist(candidatePath)) {
    return null;
  }

  try {
    const candidateStat = await stat(candidatePath);

    if (candidateStat.isFile()) {
      return candidatePath;
    }
  } catch {
    if (path.extname(candidatePath)) {
      return null;
    }
  }

  return indexFile;
}

async function main() {
  try {
    await access(indexFile);
  } catch {
    log("error", "missing_build", {
      hint: "Ejecuta npm run build o ./start.sh antes de iniciar el frontend."
    });
    process.exit(1);
  }

  const server = createServer(async (request, response) => {
    if (!["GET", "HEAD"].includes(request.method || "")) {
      response.writeHead(405, { Allow: "GET, HEAD" });
      response.end();
      return;
    }

    try {
      const filePath = await requestedFile(request.url);

      if (!filePath) {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Not found");
        return;
      }

      const extension = path.extname(filePath);
      const cacheControl =
        filePath === indexFile ? "no-cache" : "public, max-age=3600";

      response.writeHead(200, {
        "Cache-Control": cacheControl,
        "Content-Type": mimeTypes[extension] || "application/octet-stream"
      });

      if (request.method === "HEAD") {
        response.end();
        return;
      }

      createReadStream(filePath)
        .on("error", (error) => {
          log("error", "stream_error", { message: error.message });
          response.destroy(error);
        })
        .pipe(response);
    } catch (error) {
      log("error", "request_error", { message: error.message });
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Internal server error");
    }
  });

  server.listen(port, host, () => {
    log("info", "listening", { url: `http://${host}:${port}` });
  });
}

main();

