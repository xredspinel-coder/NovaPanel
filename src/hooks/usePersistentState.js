import { useEffect, useState } from "react";

export function usePersistentState(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      return localStorage.getItem(key) || initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Local storage is a preference cache only.
    }
  }, [key, value]);

  return [value, setValue];
}
