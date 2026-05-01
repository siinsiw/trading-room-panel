export type ClockTick = {
  iso: string;
  tehranTime: string;   // HH:MM:SS
  tehranDate: string;   // YYYY/MM/DD jalali
};

type Listener = (tick: ClockTick) => void;

let interval: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<Listener>();

function getTick(): ClockTick {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('fa-IR', {
    timeZone: 'Asia/Tehran',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    calendar: 'persian',
    hour12: false,
    numberingSystem: 'latn',
  });

  const parts = fmt.formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';

  return {
    iso: now.toISOString(),
    tehranTime: `${get('hour')}:${get('minute')}:${get('second')}`,
    tehranDate: `${get('year')}/${get('month')}/${get('day')}`,
  };
}

export function subscribeTehranClock(listener: Listener): () => void {
  listeners.add(listener);

  if (!interval) {
    interval = setInterval(() => {
      const tick = getTick();
      listeners.forEach(l => l(tick));
    }, 1000);
  }

  // immediate tick
  listener(getTick());

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && interval) {
      clearInterval(interval);
      interval = null;
    }
  };
}

export function getCurrentTehranTick(): ClockTick {
  return getTick();
}
