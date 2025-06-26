import { type ModelClient } from './model/ModelClient.js';

interface MetricInputs {
  expertClient: ModelClient;
  question: string;
  context: string;
  groundTruthAnswer: string;
  candidateAnswer: string;
}

interface KnowledgeMetricInputs extends Omit<MetricInputs, 'context'> {}

interface MetricScores {
  faithfulness: number | null;
  relevancy: number;
  judge_score: number;
}

async function getJsonScore(client: ModelClient, prompt: string): Promise<number> {
  try {
    const responseJson = await client.generate({ prompt, json: true });
    const parsed = JSON.parse(responseJson);
    const score = parseFloat(parsed.score);
    if (isNaN(score)) {
      console.warn(`Warning: LLM returned non-numeric score in: ${responseJson}`);
      return 0.0;
    }
    return score;
  } catch (e: any) {
    console.error("Error getting or parsing score from LLM", e);
    return 0.0;
  }
}

async function calculateFaithfulness(client: ModelClient, context: string, answer: string): Promise<number> {
  const prompt = `
    Assess if the following 'Answer' is fully supported by the 'Context'.
    The score must be a float between 0.0 (not supported) and 1.0 (fully supported).
    A high score means every claim in the answer can be verified from the context.
    Respond with ONLY a JSON object containing a single key "score".

    Context:
    ---
    ${context}
    ---
    Answer:
    ---
    ${answer}
    ---
  `;
  return getJsonScore(client, prompt);
}

async function calculateRelevancy(client: ModelClient, question: string, answer: string): Promise<number> {
  const prompt = `
    Assess if the following 'Answer' is a relevant and direct response to the 'Question'.
    The score must be a float between 0.0 (not relevant) and 1.0 (highly relevant).
    A high score means the answer directly addresses the main point of the question.
    Respond with ONLY a JSON object containing a single key "score".

    Question:
    ---
    ${question}
    ---
    Answer:
    ---
    ${answer}
    ---
  `;
  return getJsonScore(client, prompt);
}

async function getJudgeScore(client: ModelClient, question: string, groundTruth: string, candidate: string): Promise<number> {
  const prompt = `
    You are an impartial judge. Evaluate the 'Candidate Answer' against the 'Ground Truth Answer' for the given 'Question'.
    Rate the candidate's answer on a scale from 0 to 10 for helpfulness, correctness, and completeness, where 10 is best.
    Respond with ONLY a JSON object containing a single key "score".

    Question:
    ---
    ${question}
    ---
    Ground Truth Answer:
    ---
    ${groundTruth}
    ---
    Candidate Answer:
    ---
    ${candidate}
    ---
  `;
  return getJsonScore(client, prompt);
}

export async function calculateMetrics(inputs: MetricInputs): Promise<MetricScores> {
  const [faithfulness, relevancy, judgeScore] = await Promise.all([
    calculateFaithfulness(inputs.expertClient, inputs.context, inputs.candidateAnswer),
    calculateRelevancy(inputs.expertClient, inputs.question, inputs.candidateAnswer),
    getJudgeScore(inputs.expertClient, inputs.question, inputs.groundTruthAnswer, inputs.candidateAnswer),
  ]);

  return { faithfulness, relevancy, judge_score: judgeScore };
}

export async function calculateKnowledgeMetrics(inputs: KnowledgeMetricInputs): Promise<MetricScores> {
  const [relevancy, judgeScore] = await Promise.all([
    calculateRelevancy(inputs.expertClient, inputs.question, inputs.candidateAnswer),
    getJudgeScore(inputs.expertClient, inputs.question, inputs.groundTruthAnswer, inputs.candidateAnswer),
  ]);

  return { faithfulness: null, relevancy, judge_score: judgeScore };
}
