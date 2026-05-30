import { useEffect, useMemo, useState } from "react";
import { defaultThemePreset } from "../styles/themePresets.js";

const storageKey = "aniseek-dashboard-appearance";

const defaults = {
  themePreset: defaultThemePreset.id,
  backgroundColor: defaultThemePreset.backgroundColor,
  surfaceColor: defaultThemePreset.surfaceColor,
  primaryColor: defaultThemePreset.primaryColor,
  textColor: defaultThemePreset.textColor,
  fontSize: 14,
  fontFamily: "Inter"
};

function hexToRgb(value) {
  const normalized = value.replace("#", "");
  const full = normalized.length === 3
    ? normalized.split("").map((char) => `${char}${char}`).join("")
    : normalized;
  const numberValue = Number.parseInt(full, 16);

  return [
    (numberValue >> 16) & 255,
    (numberValue >> 8) & 255,
    numberValue & 255
  ].join(" ");
}

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
  root.style.setProperty("--background-color", appearance.backgroundColor);
  root.style.setProperty("--surface-color", appearance.surfaceColor);
  root.style.setProperty("--primary-color", appearance.primaryColor);
  root.style.setProperty("--text-color", appearance.textColor);
  root.style.setProperty("--background-rgb", hexToRgb(appearance.backgroundColor));
  root.style.setProperty("--surface-rgb", hexToRgb(appearance.surfaceColor));
  root.style.setProperty("--primary-rgb", hexToRgb(appearance.primaryColor));
  root.style.setProperty("--text-rgb", hexToRgb(appearance.textColor));
  root.style.setProperty("--line-rgb", hexToRgb(appearance.textColor));
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
