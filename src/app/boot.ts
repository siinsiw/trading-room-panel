import { isSeeded, resetToSeedData } from '@/data/seed/reset';
import { subscribeBroadcast, setupStorageFallback } from '@/data/sync/broadcast';
import { useOrderbookStore } from '@/stores/orderbook.store';
import { useTimeStore } from '@/stores/time.store';
import { logger } from '@/lib/logger';

export async function boot(): Promise<void> {
  // Seed on first load
  const seeded = await isSeeded();
  if (!seeded) {
    logger.info('Seeding data...');
    resetToSeedData();
  }

  // Start Tehran clock
  const stopClock = useTimeStore.getState().startClock();

  // Listen for cross-tab updates
  const stopBroadcast = subscribeBroadcast((msg) => {
    logger.info('BroadcastChannel message:', msg.type);
    if (msg.type !== 'seed.reset') {
      useOrderbookStore.getState().invalidate();
    } else {
      window.location.reload();
    }
  });

  // Storage event fallback
  const stopStorage = setupStorageFallback(() => {
    useOrderbookStore.getState().invalidate();
  });

  window.addEventListener('beforeunload', () => {
    stopClock();
    stopBroadcast();
    stopStorage();
  }, { once: true });
}
