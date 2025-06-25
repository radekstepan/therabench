import 'dotenv/config';

function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (value === undefined || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${key}. Please set it in your .env file or via Infisical.`);
  }
  return value;
}

function resolveSecret(keyName: string): string {
  const valueOrReference = getRequiredEnv(keyName);
  const resolvedValue = process.env[valueOrReference];
  return resolvedValue ?? valueOrReference;
}

export const cfg = {
  expert: {
    base: getRequiredEnv('EXPERT_BASE_URL'),
    model: getRequiredEnv('EXPERT_MODEL'),
    key: resolveSecret('EXPERT_API_KEY'),
  },
  candidate: {
    base: getRequiredEnv('CANDIDATE_BASE_URL'),
    model: getRequiredEnv('CANDIDATE_MODEL'),
  },
  maxParallel: Number(process.env.MAX_CONCURRENCY ?? 4),
};
