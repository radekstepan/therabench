import pLimit from 'p-limit';
import { cfg } from './config.js';
import { dbOps } from './db.js';
import { OpenAIClient } from './model/OpenAIClient.js';
import { OllamaClient } from './model/OllamaClient.js';
import { calculateMetrics } from './metrics.js';

export async function runEvaluation(opts: { candidateModel?: string }): Promise<number> {
  const candidateModelName = opts.candidateModel ?? cfg.candidate.model;
  
  console.log(`Starting evaluation for model: ${candidateModelName}`);

  const candidateClient = new OllamaClient({ ...cfg.candidate, model: candidateModelName });
  const expertClient = new OpenAIClient(cfg.expert);
  
  const qaItems = dbOps.getAllQAPairsWithContext();
  if (qaItems.length === 0) {
    throw new Error('No Q&A pairs found in the database. Run "thera-bench init" first.');
  }

  console.log(`Found ${qaItems.length} Q&A pairs to evaluate against.`);
  
  const runId = dbOps.createRun(candidateModelName, { prompts: 'v1' });
  const limit = pLimit(cfg.maxParallel);
  let processedCount = 0;

  const evaluationPromises = qaItems.map(item =>
    limit(async () => {
      const candidatePrompt = `
        Use the following context to answer the question.
        
        Context:
        ---
        ${item.context}
        ---
        
        Question: ${item.question}
        
        Answer:
      `;

      const candidateAnswer = await candidateClient.generate({ prompt: candidatePrompt });

      const { faithfulness, relevancy, judgeScore } = await calculateMetrics({
        expertClient,
        question: item.question,
        context: item.context,
        groundTruthAnswer: item.ground_truth_answer,
        candidateAnswer,
      });

      dbOps.insertResult({
        run_id: runId,
        qa_id: item.qa_id,
        candidate_answer: candidateAnswer,
        faithfulness: faithfulness,
        relevancy: relevancy,
        judge_score: judgeScore,
      });
      processedCount++;
      process.stdout.write(`\r  Evaluated ${processedCount}/${qaItems.length} questions...`);
    })
  );

  await Promise.all(evaluationPromises);

  return runId;
}
