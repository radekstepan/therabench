# `thera-bench`

A database-free, fully file-based framework for evaluating LLM performance.

`thera-bench` provides a transparent, portable, and version-controllable system for benchmarking Large Language Models. It reads your local documents, generates a reviewable ground-truth dataset, and stores all evaluation results as plain-text JSON files.

### Core Features

*   **100% File-Based**: No databases. All data and results are stored as human-readable `.json` files.
*   **Portable & Versionable**: Your entire evaluation suite (data, ground-truth, results) can be checked into Git.
*   **Human-Readable Ground Truth**: Generates Q&A pairs from your documents into `.qa.json` files for easy review and editing.
*   **Decoupled Data**: Source documents and generated data are kept in separate, user-defined directories.
*   **Evaluate Any Model**: Test local Ollama models or remote OpenAI-compatible endpoints.
*   **Comprehensive Metrics**: Calculates `faithfulness`, `answer_relevancy`, and an "LLM-as-a-Judge" score for each evaluation.
*   **Secure Secret Management**: Integrates with [Infisical](https://infisical.com/) to keep API keys out of your files.

---

## Directory Structure

`thera-bench` operates on two key directories that you specify:

1.  **Source Directory (`<sourceDir>`):** Contains your original `.txt` documents. This directory is treated as read-only.
2.  **Data Directory (`<dataDir>`):** A workspace where all generated files are stored. It will be created if it doesn't exist and will have the following structure:

    ```
    <dataDir>/
    ├── qa_pairs/
    │   ├── transcript-01.qa.json
    │   └── transcript-02.qa.json
    └── runs/
        ├── 2023-10-27T10-30-00-000Z/  (A unique Run ID)
        │   ├── _meta.json
        │   ├── transcript-01.eval.json
        │   └── transcript-02.eval.json
        └── 2023-10-27T11-00-00-000Z/
            ├── _meta.json
            └── ...
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

Create a folder for your source documents (e.g., `./my_transcripts`) and another for your generated data (e.g., `./eval_data`).

**Step 2: Initialize Ground Truth (`init`)**

Generate the `*.qa.json` files. This command reads from your source directory and writes to your data directory.

```bash
thera-bench init ./my_transcripts ./eval_data
```
You can now review the generated files in `./eval_data/qa_pairs/`.

**Step 3: Run Evaluation (`eval`)**

Evaluate your candidate model. This reads from *both* directories and creates a new run folder inside `./eval_data/runs/`.

```bash
thera-bench eval ./my_transcripts ./eval_data
```
To test a different model, use the `-m` flag:
```bash
thera-bench eval ./my_transcripts ./eval_data -m "mistral:7b"
```

**Step 4: View the Report (`report`)**

Generate a scoreboard for the most recent run.

```bash
thera-bench report ./eval_data
```
To view a specific run, provide its ID:
```bash
thera-bench report ./eval_data 2023-10-27T10-30-00-000Z
```

**Step 5: Rerun the Last Evaluation (`replay`)**
For stability testing, rerun the last evaluation with the same parameters.

```bash
thera-bench replay ./my_transcripts ./eval_data
```

---
## Troubleshooting

**Error: `terminated` / `exit status 1`**

This generic error often means a hidden problem occurred. Check for:
*   **File Permissions**: Ensure the script has read access to your `<sourceDir>` and read/write access to your `<dataDir>`.
*   **Invalid API Key**: Your `EXPERT_API_KEY` might be incorrect. The tool will now print a more detailed error message if the API call fails.
*   **Missing Source Directory**: If the `<sourceDir>` you provide doesn't exist, the program will now exit with a "Source directory not found" error.

Happy benchmarking!
