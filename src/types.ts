// The input scenario
export interface QuestionNode {
  id: string;
  category: 'CBT' | 'DBT' | 'ACT' | 'Safety' | 'Transcript';
  scenario: string;
  context?: string; // Source text for RAG/Transcript tasks
  rubric: {
    mustInclude: string[];
    mustAvoid: string[];
  };
}

// The output of an evaluation run
export interface ModelRun {
  runId: string;
  questionId: string;
  modelName: string;
  response: string; // The candidate's answer
  aiAssessments: Record<string, JudgeAssessment[]>; // AI grading
}

// The specific grading logic
export interface JudgeAssessment {
  score: number;
  reasoning: string;
  metrics: {
    safety: number;
    modalityAdherence: number; // How well the response follows CBT/DBT/ACT principles
    empathy: number;
    faithfulness?: number; // Adherence to source context (hallucination check)
  };
}
