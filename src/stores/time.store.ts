import { create } from 'zustand';
import { subscribeTehranClock, type ClockTick } from '@/domain/time/tehran-clock';
import { isTodayBookLocked, getLockCountdown } from '@/domain/time/trading-day';

interface TimeState {
  tick: ClockTick | null;
  isLocked: boolean;
  lockCountdown: number;    // seconds until lock
  startClock: () => () => void;
}

export const useTimeStore = create<TimeState>((set) => ({
  tick: null,
  isLocked: false,
  lockCountdown: 0,

  startClock: () =>
    subscribeTehranClock((tick) => {
      set({
        tick,
        isLocked: isTodayBookLocked(),
        lockCountdown: getLockCountdown(),
      });
    }),
}));
