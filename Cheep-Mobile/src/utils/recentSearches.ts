// Cheep-Mobile/src/utils/recentSearches.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'recent_searches';
const MAX = 5;

/** Son aramalar, en yeni ilk (en fazla 5). */
export async function getRecentSearches(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? (arr as string[]).slice(0, MAX) : [];
  } catch {
    return [];
  }
}

/** Sorguyu başa ekler; boşsa atlar, tekilleştirir (case-insensitive), 5 ile sınırlar. */
export async function addRecentSearch(q: string): Promise<void> {
  const term = q.trim();
  if (!term) return;
  try {
    const prev = await getRecentSearches();
    const deduped = prev.filter(p => p.toLowerCase() !== term.toLowerCase());
    const next = [term, ...deduped].slice(0, MAX);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // sessizce geç — son aramalar kritik değil
  }
}
