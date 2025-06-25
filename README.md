# `thera-bench`

Benchmark local and remote LLMs against a domain-specific, expert-labeled ground truth.

`thera-bench` is a command-line tool designed to provide a robust, repeatable, and local-first framework for evaluating the performance of Large Language Models (LLMs). It helps you answer the question: "How well does this model perform on *my* specific data?"



### Core Features

*   **Ingest Local Data**: Reads your private `.txt` transcript files from a local folder.
*   **Expert Ground Truth**: Uses a powerful "expert" model (like GPT-4o or Claude 3 Opus) *once* to generate high-quality question-and-answer pairs from your documents. This ground truth is then stored permanently.
*   **Evaluate Any Candidate Model**: Pit any local model (via Ollama) or remote OpenAI-compatible endpoint against the cached ground truth.
*   **Persistent Storage**: All transcripts, Q&A pairs, and evaluation results are logged in a local SQLite database, so you can track performance over time.
*   **Comprehensive Metrics**: Automatically calculates RAGAS-style metrics (`faithfulness`, `answer_relevancy`) and an "LLM-as-a-Judge" score for each evaluation.
*   **Secure Secret Management**: Integrates seamlessly with [Infisical](https://infisical.com/) to keep your API keys safe and out of source control.

---

## Getting Started

### Prerequisites

*   [Node.js](https://nodejs.org/) (v18 or later)
*   An API key for an "expert" model (e.g., OpenAI, Anthropic).
*   (Optional but recommended) A locally running [Ollama](https://ollama.com/) instance to serve your candidate model.

### 1. Installation

Install the package globally using npm:

```bash
npm install -g thera-bench
```

This will make the `thera-bench` command available in your terminal.

### 2. Configuration

`thera-bench` is configured using a `.env` file in the directory where you run your commands.

1.  Create a file named `.env` in your project folder.
2.  Copy the contents of the example below into your `.env` file and fill in the values.

```dotenv
# .env

# Expert model (used for generating ground-truth and judging)
EXPERT_BASE_URL=https://api.openai.com/v1
EXPERT_MODEL=gpt-4o-mini
EXPERT_API_KEY=sk-your-openai-api-key # Or use an Infisical reference (see below)

# Candidate model (the model you want to evaluate)
CANDIDATE_BASE_URL=http://localhost:11434
CANDIDATE_MODEL=llama3:8b

# Performance
MAX_CONCURRENCY=4
```

#### Securely Managing Your `EXPERT_API_KEY`

You have two options for providing the `EXPERT_API_KEY`:

1.  **Directly (for quick tests):** Paste your raw API key into the `.env` file.
    ```
    EXPERT_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
    ```
2.  **Via Infisical (Recommended):** Store your key securely in Infisical and reference it. The tool will automatically detect your Infisical setup and inject the secret at runtime.
    *   Install the [Infisical CLI](https://infisical.com/docs/cli/overview).
    *   Run `infisical init` in your project directory and follow the prompts.
    *   Update your `.env` file to use the Infisical reference path:
        ```
        EXPERT_API_KEY=infisical://thera-bench-project/dev/OPENAI_API_KEY
        ```

---

## Standard Workflow

Follow these steps to run your first evaluation.

### Step 1: Prepare Your Data

Create a folder (e.g., `my_transcripts/`) and place all your raw text documents inside it. Each document should be a separate `.txt` file.

```
my_project/
├── my_transcripts/
│   ├── session_01.txt
│   ├── session_02.txt
│   └── ...
└── .env
```

### Step 2: Initialize and Create Ground Truth

Run the `init` command to process your documents. This command will:
1.  Read all `.txt` files from your specified folder.
2.  Create a checksum (SHA256) for each to avoid reprocessing.
3.  Store the content in the `thera-bench.db` SQLite database.
4.  Call your configured **expert model** to generate and store question-and-answer pairs for each new transcript.

```bash
thera-bench init ./my_transcripts
```

This step only needs to be run once per set of documents.

### Step 3: Evaluate a Candidate Model

Now, run the `eval` command. This will test your **candidate model** (e.g., your local `llama3:8b`) against every Q&A pair in the database. For each question, it computes metrics and stores the results.

```bash
thera-bench eval
```

You can easily test a different model by using the `--model` flag:

```bash
thera-bench eval --model "mistral:7b"
```

### Step 4: View the Report

To see the aggregated scores for the last run, use the `report` command:

```bash
thera-bench report
```

You will see a scoreboard like this:

```
Run #12 — llama3:8b-chat ⏱ 2025-06-24 20:05
──────────────────────────────────────────────
Faithfulness   0.92 ✅
Relevancy      0.78 ✅
Judge score    8.40 ✅
──────────────────────────────────────────────
PASS  (3/3 thresholds met)
```

To see the report for a specific run, pass its ID: `thera-bench report 12`.

---

## Command Reference

| Command           | Description                                                                                                       |
| ----------------- | ----------------------------------------------------------------------------------------------------------------- |
| `init <folder>`   | Imports raw `.txt` files, hashes & stores them, and calls the expert model to build Q&A pairs.                      |
| `eval`            | Runs the candidate model against all stored Q&A pairs, computes metrics, and writes results to a new `run_id`.      |
| `report [run_id]` | Prints a summary scoreboard for a specific run or the most recent run. Use `--json` for machine-readable output.    |
| `replay`          | Reruns the `eval` command with the exact same parameters as the last run, useful for stability testing.             |

Happy benchmarking!
