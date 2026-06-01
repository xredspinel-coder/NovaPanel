import { useSyncExternalStore } from "react";
import { getDeveloperConsoleLogs, subscribeDeveloperConsole } from "../utils/developerConsole.js";

export function useDeveloperConsoleLogs() {
  return useSyncExternalStore(subscribeDeveloperConsole, getDeveloperConsoleLogs, getDeveloperConsoleLogs);
}
