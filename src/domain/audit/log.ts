import { nanoid } from 'nanoid';
import type { AuditEntry, Role, ID } from '../types';

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function createAuditEntry(params: {
  prevEntry: AuditEntry | null;
  actorId: ID;
  actorRole: Role;
  action: string;
  payload: Record<string, unknown>;
}): Promise<AuditEntry> {
  const timestamp = new Date().toISOString();
  const payloadStr = JSON.stringify(params.payload);
  const hashInput = (params.prevEntry?.id ?? '') + payloadStr + timestamp;
  const id = await sha256(hashInput);

  return {
    id,
    prevId: params.prevEntry?.id,
    actorId: params.actorId,
    actorRole: params.actorRole,
    action: params.action,
    payload: params.payload,
    timestamp,
  };
}

export function verifyAuditChain(entries: AuditEntry[]): boolean {
  for (let i = 1; i < entries.length; i++) {
    if (entries[i].prevId !== entries[i - 1].id) return false;
  }
  return true;
}

// Fallback sync version (no hash chain) for non-critical local use
export function createAuditEntrySync(params: {
  actorId: ID;
  actorRole: Role;
  action: string;
  payload: Record<string, unknown>;
}): AuditEntry {
  return {
    id: nanoid(12),
    actorId: params.actorId,
    actorRole: params.actorRole,
    action: params.action,
    payload: params.payload,
    timestamp: new Date().toISOString(),
  };
}
