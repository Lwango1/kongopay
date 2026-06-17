// Event bus temps réel pour la communication entre services
// Alternative légère à Redis/BullMQ

class EventBus {
  constructor() {
    this.listeners = new Map();
    this.queue = [];
    this.processing = false;
    this.metrics = { emitted: 0, processed: 0, errors: 0, queueSize: 0 };
  }

  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(handler);
    return () => this.off(event, handler);
  }

  off(event, handler) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      const idx = handlers.indexOf(handler);
      if (idx >= 0) handlers.splice(idx, 1);
    }
  }

  emit(event, data) {
    this.metrics.emitted++;
    const handlers = this.listeners.get(event);
    if (!handlers) return;

    for (const handler of handlers) {
      this.queue.push({ handler, data, event });
      this.metrics.queueSize = this.queue.length;
    }
    this.processQueue();
  }

  async processQueue() {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const job = this.queue.shift();
      try {
        await job.handler(job.data);
        this.metrics.processed++;
      } catch (err) {
        this.metrics.errors++;
        console.error(`[EventBus] Erreur traitement ${job.event}:`, err.message);
      }
      this.metrics.queueSize = this.queue.length;
    }

    this.processing = false;
  }

  getMetrics() {
    return { ...this.metrics, uptime: process.uptime() };
  }
}

export const eventBus = new EventBus();

// --- WebSocket broadcaster (extension optionnelle) ---
let wsClients = new Set();

export function addWsClient(ws) {
  wsClients.add(ws);
  ws.on('close', () => wsClients.delete(ws));
  ws.on('error', () => wsClients.delete(ws));
}

export function broadcastToClients(event, data) {
  const msg = JSON.stringify({ event, data, timestamp: Date.now() });
  for (const ws of wsClients) {
    try {
      if (ws.readyState === 1) ws.send(msg);
    } catch { /* ignore */ }
  }
}

// Connect event bus to WebSocket broadcast
eventBus.on('signal', (signal) => broadcastToClients('signal', signal));
eventBus.on('trade', (trade) => broadcastToClients('trade', trade));
eventBus.on('alert', (alert) => broadcastToClients('alert', alert));
