import { Snapshot, SnapshotResult } from "../constants/default-snapshot";
import { Mode } from "@monkeytype/schemas/shared";
import { getDefaultSnapshot } from "../constants/default-snapshot";

const STORAGE_KEY = "monkeytype_local_snapshot";
const STORAGE_VERSION = 1;

export interface StorageSnapshot {
  version: number;
  data: Snapshot;
  lastSaved: number;
}

export function saveSnapshotToLocalStorage(snapshot: Snapshot): void {
  try {
    const data: StorageSnapshot = {
      version: STORAGE_VERSION,
      data: snapshot,
      lastSaved: Date.now(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("Failed to save snapshot to local storage", e);
  }
}

export function loadSnapshotFromLocalStorage(): Snapshot | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored) as StorageSnapshot;

    if (parsed.version !== STORAGE_VERSION) {
      console.warn("Local storage snapshot version mismatch, ignoring");
      return null;
    }

    return parsed.data;
  } catch (e) {
    console.error("Failed to load snapshot from local storage", e);
    return null;
  }
}

export function clearLocalStorage(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error("Failed to clear local storage", e);
  }
}

export function addLocalResult(result: SnapshotResult<Mode>): void {
  try {
    const snapshot = loadSnapshotFromLocalStorage();
    if (!snapshot) return;

    if (snapshot.results !== undefined) {
      snapshot.results.unshift(result);
    } else {
      snapshot.results = [result];
    }

    saveSnapshotToLocalStorage(snapshot);
  } catch (e) {
    console.error("Failed to add local result", e);
  }
}

export function initializeLocalSnapshot(name?: string): Snapshot {
  const existingSnapshot = loadSnapshotFromLocalStorage();

  if (existingSnapshot) {
    return existingSnapshot;
  }

  const newSnapshot = getDefaultSnapshot();
  if (name) {
    newSnapshot.name = name;
  }

  saveSnapshotToLocalStorage(newSnapshot);
  return newSnapshot;
}

export function getLastSavedTimestamp(): number | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored) as StorageSnapshot;
    return parsed.lastSaved;
  } catch (e) {
    return null;
  }
}
