export type ModelKey = 'haiku-4.5' | 'sonnet-5' | 'opus-5';
export type Effort = 'low' | 'medium' | 'high';

export const MODELS: Record<ModelKey, { label: string; id: string; supportsEffort: boolean }> = {
  'haiku-4.5': { label: 'Haiku 4.5', id: 'claude-haiku-4-5-20251001', supportsEffort: false },
  'sonnet-5': { label: 'Sonnet 5', id: 'claude-sonnet-5', supportsEffort: true },
  'opus-5': { label: 'Opus 5', id: 'claude-opus-5', supportsEffort: true },
};

export const EFFORTS: { label: string; value: Effort }[] = [
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' },
];
