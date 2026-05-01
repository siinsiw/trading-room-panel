import { generateSampleData } from './sample-data';
import { publishBroadcast } from '@/data/sync/broadcast';

const LS_KEYS = ['tr:markets', 'tr:users', 'tr:orders', 'tr:trades', 'tr:settlements', 'tr:audit'];

export function resetToSeedData(): void {
  // Wipe
  LS_KEYS.forEach(k => localStorage.removeItem(k));

  // Reseed
  const data = generateSampleData();
  localStorage.setItem('tr:markets',     JSON.stringify(data.markets));
  localStorage.setItem('tr:users',       JSON.stringify(data.users));
  localStorage.setItem('tr:orders',      JSON.stringify(data.orders));
  localStorage.setItem('tr:trades',      JSON.stringify(data.trades));
  localStorage.setItem('tr:settlements', JSON.stringify(data.settlements));
  localStorage.setItem('tr:audit',       JSON.stringify(data.auditEntries));

  publishBroadcast({ type: 'seed.reset' });
}

export function isSeeded(): boolean {
  return localStorage.getItem('tr:markets') !== null;
}
