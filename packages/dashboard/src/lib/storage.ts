import { HumanOverride, ModelRun } from '../types';

export type { HumanOverride };

const STORAGE_KEY = 'therapy_eval_overrides';

export const getOverrides = (): Record<string, HumanOverride> => {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
};

export const saveOverride = (runId: string, override: HumanOverride) => {
    const current = getOverrides();
    current[runId] = override;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    return current;
};

export const exportData = (originalResults: ModelRun[], overrides: Record<string, HumanOverride>) => {
    const merged = originalResults.map(r => {
        const override = overrides[r.runId];
        if (override) {
            return {
                ...r,
                humanOverride: override,
                // We keep the original AI assessment but maybe add a flag
                isReviewed: true
            };
        }
        return r;
    });

    const blob = new Blob([JSON.stringify(merged, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `evaluated_dataset_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
};
