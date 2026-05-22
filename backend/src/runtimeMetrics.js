const startedAt = new Date().toISOString();
const counters = new Map();

export function trackMetric(name, count = 1) {
  counters.set(name, (counters.get(name) ?? 0) + count);
}

export function getRuntimeMetrics(roomStats = {}) {
  const memory = process.memoryUsage();

  return {
    counters: Object.fromEntries(
      [...counters.entries()].sort(([left], [right]) => left.localeCompare(right))
    ),
    memoryMb: {
      heapUsed: Number((memory.heapUsed / 1024 / 1024).toFixed(1)),
      rss: Number((memory.rss / 1024 / 1024).toFixed(1))
    },
    rooms: roomStats,
    startedAt,
    uptimeSeconds: Math.round(process.uptime())
  };
}
