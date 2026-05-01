const CHANNEL_NAME = 'trading-room-v1';

export type BroadcastMessage =
  | { type: 'markets.updated';     ids: string[] }
  | { type: 'users.updated';       ids: string[] }
  | { type: 'orders.updated';      ids: string[] }
  | { type: 'trades.created';      ids: string[] }
  | { type: 'trades.updated';      ids: string[] }
  | { type: 'settlements.created'; ids: string[] }
  | { type: 'audit.appended';      ids: string[] }
  | { type: 'seed.reset' };

type Listener = (msg: BroadcastMessage) => void;

let channel: BroadcastChannel | null = null;
const listeners = new Set<Listener>();

function getChannel(): BroadcastChannel {
  if (!channel) {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (ev: MessageEvent<BroadcastMessage>) => {
      listeners.forEach(l => l(ev.data));
    };
  }
  return channel;
}

export function publishBroadcast(msg: BroadcastMessage): void {
  getChannel().postMessage(msg);
  // Also notify same-tab listeners
  listeners.forEach(l => l(msg));
}

export function subscribeBroadcast(listener: Listener): () => void {
  getChannel(); // ensure channel exists
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Storage event fallback (cross-origin tabs)
export function setupStorageFallback(listener: Listener): () => void {
  const handler = (e: StorageEvent) => {
    if (e.key?.startsWith('tr:')) {
      listener({ type: 'orders.updated', ids: [] });
    }
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}
