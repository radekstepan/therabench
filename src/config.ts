import 'dotenv/config';

function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (value === undefined || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${key}. Please set it in your .env file or via Infisical.`);
  }
  return value;
}

function resolveSecret(keyName: string, required: true): string;
function resolveSecret(keyName: string, required: false): string | undefined;
function resolveSecret(keyName: string, required: boolean): string | undefined {
  const valueOrReference = process.env[keyName];
  if (!valueOrReference) {
    if (required) {
      throw new Error(`Missing required environment variable: ${keyName}.`);
    }
    return undefined;
  }
  
  const resolvedValue = process.env[valueOrReference];
  return resolvedValue ?? valueOrReference;
}

export const cfg = {
  expert: {
    base: getRequiredEnv('EXPERT_BASE_URL'),
    model: getRequiredEnv('EXPERT_MODEL'),
    key: resolveSecret('EXPERT_API_KEY', true),
  },
  candidate: {
    base: getRequiredEnv('CANDIDATE_BASE_URL'),
    model: getRequiredEnv('CANDIDATE_MODEL'),
    key: resolveSecret('CANDIDATE_API_KEY', false), // API key is optional for candidate models
  },
  maxParallel: Number(process.env.MAX_CONCURRENCY ?? 4),
};
