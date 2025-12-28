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
    // Only export results that have been modified by the user
    const modifiedResults = originalResults
        .filter(r => overrides[r.runId])
        .map(r => {
            const override = overrides[r.runId];
            return {
                ...r,
                humanOverride: override,
                isReviewed: true
            };
        });

    // Only export questions that have been modified
    const modifiedQuestions = questions
        .filter(q => questionOverrides[q.id] || rubricOverrides[q.id])
        .map(q => {
            const questionOverride = questionOverrides[q.id];
            const rubricOverride = rubricOverrides[q.id];
            
            return {
                ...q,
                ...(questionOverride?.title && { title: questionOverride.title }),
                ...(questionOverride?.scenario && { scenario: questionOverride.scenario }),
                rubric: questionOverride?.rubric || rubricOverride || q.rubric,
                modified: true
            };
        });

    const exportData = {
        results: modifiedResults,
        questions: modifiedQuestions,
        exportDate: new Date().toISOString(),
        note: 'This file contains only user modifications. To merge with default results, import this file and merge the arrays by runId/questionId.'
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `user_edits_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
};
