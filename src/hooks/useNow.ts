import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useApp } from '../state/store';

/** Current time, refreshed every 15 seconds and when the app comes back to the foreground. */
export function useNow(): Date {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      useApp.getState().ensureToday(d);
      setNow(d);
    };
    tick();
    const timer = setInterval(tick, 15000);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && tick());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, []);
  return now;
}
