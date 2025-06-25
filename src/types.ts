export interface QAPair {
  question: string;
  answer: string;
  span: string;
}

export interface QAPairsFile {
  qa_pairs: QAPair[];
}

export interface EvaluationResult {
  question: string;
  ground_truth_answer: string;
  candidate_answer: string;
  faithfulness: number;
  relevancy: number;
  judge_score: number;
}

export interface RunMeta {
  runId: string;
  candidateModel: string;
  startedAt: string;
}

export interface EvaluationFile {
  runMeta: RunMeta;
  results: EvaluationResult[];
}
