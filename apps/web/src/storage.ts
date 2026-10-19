import type { LocalData } from '@prostir/contracts';
export const storageKey = 'prostir-v1';
export function readStorage(): LocalData {
  try {
    const data = JSON.parse(localStorage.getItem(storageKey) || '{}');
    return {
      history: Array.isArray(data.history) ? data.history.filter((r: any) =>
        r && typeof r.id === 'string' && Number.isFinite(r.raw) && Number.isFinite(r.percent) && typeof r.date === 'string') : [],
      drafts: data.drafts && typeof data.drafts === 'object' && !Array.isArray(data.drafts) ? data.drafts : {},
    };
  } catch { return { history: [], drafts: {} }; }
}
