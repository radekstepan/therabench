import pLimit from 'p-limit';
import { dbOps } from './db.js';
import { cfg } from './config.js';
import { OpenAIClient } from './model/OpenAIClient.js';
import type { Transcript, QAPair } from './types.js';

const expertClient = new OpenAIClient(cfg.expert);
const limit = pLimit(cfg.maxParallel);

function createLabelingPrompt(transcriptContent: string): string {
  return `
    Given the following transcript, please generate 3-5 high-quality question and answer pairs.
    Each pair should be grounded in the text. The answer MUST be a direct quote or a very close paraphrase of a sentence or two from the transcript.
    For each pair, also provide the "span", which is the exact text snippet from the transcript that contains the answer.

    The output must be a single JSON object containing a key "qa_pairs" which is an array of objects.
    Each object in the array should have three keys: "question", "answer", and "span".

    Example format:
    {
      "qa_pairs": [
        {
          "question": "What was the patient's primary concern during the session?",
          "answer": "The patient expressed significant anxiety about an upcoming work presentation.",
          "span": "My main worry right now is this big presentation at work; I've been losing sleep over it."
        }
      ]
    }

    Transcript:
    ---
    ${transcriptContent}
    ---
  `;
}

async function generatePairsForTranscript(transcript: Transcript): Promise<Omit<QAPair, 'id'>[]> {
  const prompt = createLabelingPrompt(transcript.content);
  const responseJson = await expertClient.generate({ prompt, json: true });

  try {
    const parsed = JSON.parse(responseJson);
    if (!parsed.qa_pairs || !Array.isArray(parsed.qa_pairs)) {
      throw new Error('Invalid JSON structure from expert model.');
    }

    return parsed.qa_pairs.map((p: any) => ({
      transcript_id: transcript.id,
      question: p.question,
      answer: p.answer,
      span: p.span,
    }));
  } catch (e) {
    console.error(`Failed to parse JSON for transcript ${transcript.id}:`, responseJson);
    return []; // Return empty array on failure to avoid crashing the whole process
  }
}

export async function labelTranscripts(): Promise<number> {
  const transcriptsToLabel = dbOps.getUnlabeledTranscripts();
  if (transcriptsToLabel.length === 0) {
    return 0;
  }

  console.log(`Found ${transcriptsToLabel.length} unlabeled transcripts. Generating Q&A pairs...`);

  const promises = transcriptsToLabel.map(transcript =>
    limit(async () => {
      console.log(`  - Labeling transcript ${transcript.id} (path: ${transcript.path})`);
      const pairs = await generatePairsForTranscript(transcript);
      if (pairs.length > 0) {
        dbOps.insertQAPairs(pairs);
        console.log(`  - Stored ${pairs.length} Q&A pairs for transcript ${transcript.id}.`);
      }
    })
  );

  await Promise.all(promises);

  return transcriptsToLabel.length;
}
