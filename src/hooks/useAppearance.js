import { useEffect, useMemo, useState } from "react";

const storageKey = "aniseek-dashboard-appearance";

const defaults = {
  primaryColor: "#9b5cff",
  textColor: "#f5f2ff",
  fontSize: 14,
  fontFamily: "Inter"
};

function loadAppearance() {
  try {
    return {
      ...defaults,
      ...JSON.parse(localStorage.getItem(storageKey) || "{}")
    };
  } catch {
    return defaults;
  }
}

function applyAppearance(appearance) {
  const root = document.documentElement;
  root.style.setProperty("--primary-color", appearance.primaryColor);
  root.style.setProperty("--text-color", appearance.textColor);
  root.style.setProperty("--font-size", `${appearance.fontSize}px`);
  root.style.setProperty("--font-family", appearance.fontFamily);
}

export function useAppearance() {
  const [appearance, setAppearance] = useState(loadAppearance);

  useEffect(() => {
    applyAppearance(appearance);
    localStorage.setItem(storageKey, JSON.stringify(appearance));
  }, [appearance]);

  return useMemo(
    () => ({
      appearance,
      setAppearance,
      resetAppearance: () => setAppearance(defaults)
    }),
    [appearance]
  );
}
