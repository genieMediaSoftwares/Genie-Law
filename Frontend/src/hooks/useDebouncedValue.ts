import { useEffect, useState } from 'react';

export const useDebouncedValue = <T,>(value: T, delayMs = 350): T => {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return settled;
};
