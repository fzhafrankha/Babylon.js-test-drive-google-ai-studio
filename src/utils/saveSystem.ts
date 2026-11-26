import { SaveSlotData } from '../types/game';

const STORAGE_KEY = 'aethelgard_rpg_saves_v1';

export function loadAllSaveSlots(): (SaveSlotData | null)[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [null, null, null];
    const parsed = JSON.parse(raw) as (SaveSlotData | null)[];
    return [parsed[0] ?? null, parsed[1] ?? null, parsed[2] ?? null];
  } catch {
    return [null, null, null];
  }
}

export function saveToSlot(slotIndex: number, data: SaveSlotData): boolean {
  try {
    const slots = loadAllSaveSlots();
    slots[slotIndex] = data;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slots));
    return true;
  } catch {
    return false;
  }
}

export function deleteSaveSlot(slotIndex: number): void {
  try {
    const slots = loadAllSaveSlots();
    slots[slotIndex] = null;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slots));
  } catch {
    // Ignore storage errors
  }
}

export function getMostRecentSave(): SaveSlotData | null {
  const slots = loadAllSaveSlots().filter((s): s is SaveSlotData => s !== null);
  if (slots.length === 0) return null;
  slots.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
  return slots[0];
}
