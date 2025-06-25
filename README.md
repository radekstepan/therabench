# `thera-bench`

A self-contained, file-based framework for evaluating LLM performance in a single directory.

`thera-bench` provides a transparent, portable, and version-controllable system for benchmarking Large Language Models. It reads your local documents, generates a reviewable ground-truth dataset, and stores all evaluation results as plain-text JSON files right next to your source documents.

### Core Features

*   **Single Directory Model**: No complex setup. All you need is one folder with your `.txt` files. All generated files live alongside their source.
*   **100% File-Based**: No databases. Everything is a human-readable `.json` file.
*   **Portable & Versionable**: Your entire evaluation suite—source documents, ground-truth data, and run results—can be checked into Git.
*   **Intelligent Ground Truth**: Automatically chunks long documents to generate Q&A pairs that cover the entire text, ensuring comprehensive evaluation.
*   **Evaluate Any Model**: Test local Ollama models or remote OpenAI-compatible endpoints.
*   **Secure Secret Management**: Integrates with [Infisical](https://infisical.com/) to keep API keys out of your files.

---

## The Single Directory Structure

Everything happens in the one directory you specify. `thera-bench` uses a clear file naming convention:

*   **You provide:** `my-transcript.txt`
*   **`init` creates:** `my-transcript.qa.json`
*   **`eval` creates:** `my-transcript.2023-10-27T10-30-00-000Z.eval.json`

A typical directory will look like this:

```
my_eval_project/
├── .env
├── transcript-A.txt
├── transcript-A.qa.json
├── transcript-A.2024-05-21T12-34-56Z.eval.json
├── transcript-B.txt
└── transcript-B.qa.json
```

---

## Getting Started

### 1. Installation

```bash
npm install -g thera-bench
```

### 2. Configuration (`.env` file)

Create a `.env` file in your project's root directory to configure your API keys.

**Using Infisical (Recommended):**

1.  Run `infisical init` in your project.
2.  In your `.env` file, **reference** the secret name from your Infisical project.

```dotenv
# .env
EXPERT_BASE_URL=https://api.openai.com/v1
EXPERT_MODEL=gpt-4o-mini
EXPERT_API_KEY=OPENAI_API_KEY # This is a REFERENCE

CANDIDATE_BASE_URL=http://localhost:11434
CANDIDATE_MODEL=llama3:8b
```

### 3. Standard Workflow

**Step 1: Prepare Your Data**

Create a folder and place your `.txt` documents inside (e.g., `./my-project/`).

**Step 2: Initialize Ground Truth (`init`)**

Run `init`, pointing it at your project directory. It will find all `.txt` files and create a `*.qa.json` file for each one that doesn't already have one.

```bash
thera-bench init ./my-project
```

**Step 3: Run Evaluation (`eval`)**

Run `eval` on the same directory. It will find all transcripts with a corresponding `*.qa.json` file and generate a new set of `*.eval.json` files, tagged with a unique run ID.

```bash
thera-bench eval ./my-project
```
To test a different model, use the `-m` flag:
```bash
thera-bench eval ./my-project -m "mistral:7b"
```

**Step 4: View the Report (`report`)**

Generate a scoreboard for the most recent run.

```bash
thera-bench report ./my-project
```
To view a specific run, provide its ID (the timestamp from the filename):
```bash
thera-bench report ./my-project 2024-05-21T12-34-56Z
```

**Step 5: Rerun the Last Evaluation (`replay`)**
For stability testing, rerun the last evaluation with the same parameters.

```bash
thera-bench replay ./my-project
```

Happy benchmarking!
