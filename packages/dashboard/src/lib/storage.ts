import { HumanOverride, ModelRun, QuestionNode, Rubric, QuestionOverride } from '../types';

export type { HumanOverride };

const STORAGE_KEY = 'therapy_eval_overrides';
const RUBRIC_KEY = 'therapy_eval_rubrics';
const QUESTION_KEY = 'therapy_eval_questions';

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

export const getRubricOverrides = (): Record<string, Rubric> => {
    const raw = localStorage.getItem(RUBRIC_KEY);
    return raw ? JSON.parse(raw) : {};
};

export const saveRubricOverride = (questionId: string, rubric: Rubric) => {
    const current = getRubricOverrides();
    current[questionId] = rubric;
    localStorage.setItem(RUBRIC_KEY, JSON.stringify(current));
    return current;
};

export const getQuestionOverrides = (): Record<string, QuestionOverride> => {
    const raw = localStorage.getItem(QUESTION_KEY);
    return raw ? JSON.parse(raw) : {};
};

export const saveQuestionOverride = (questionId: string, override: QuestionOverride) => {
    const current = getQuestionOverrides();
    current[questionId] = override;
    localStorage.setItem(QUESTION_KEY, JSON.stringify(current));
    return current;
};

export const exportData = (originalResults: ModelRun[], overrides: Record<string, HumanOverride>, questions: QuestionNode[], rubricOverrides: Record<string, Rubric>, questionOverrides: Record<string, QuestionOverride>) => {
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

    // Include questions with their overrides
    const questionsWithOverrides = questions.map(q => {
        const questionOverride = questionOverrides[q.id];
        const rubricOverride = rubricOverrides[q.id];
        
        if (questionOverride || rubricOverride) {
            return {
                ...q,
                ...(questionOverride?.title && { title: questionOverride.title }),
                ...(questionOverride?.scenario && { scenario: questionOverride.scenario }),
                rubric: questionOverride?.rubric || rubricOverride || q.rubric,
                modified: true
            };
        }
        return q;
    });

    const exportData = {
        results: merged,
        questions: questionsWithOverrides,
        exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `evaluated_dataset_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
};
