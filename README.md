# CBT/DBT LLM Evaluator

A local evaluation platform for testing how well Small Language Models (SLMs) and LLMs respond to therapeutic scenarios (CBT, DBT, ACT).

## 🏗 Architecture

- **`packages/eval-engine`**: A Node.js CLI tool.
  - Generates synthetic patient scenarios using a "Judge" model (e.g., GPT-4).
  - Runs local models (via Ollama) against these scenarios.
  - Uses the Judge model to score responses (0-100) and output JSON.
- **`packages/dashboard`**: A React + Vite Web UI.
  - Visualizes the results.
  - Allows human experts to override scores, rank answers, and add notes.
  - Exports the curated dataset for fine-tuning or analysis.

## 🚀 Prerequisites

1.  **Node.js** (v18+)
2.  **Yarn** or **NPM**
3.  **Ollama** running locally (for the candidate models).
4.  **OpenAI API Key** (for the Generator and Judge).

## 🛠 Setup & Installation

1.  **Install dependencies**:
    ```bash
    yarn install
    ```

2.  **Environment Setup**:
    Create a `.env` file in `packages/eval-engine/.env`:
    ```env
    OPENAI_API_KEY=sk-your-key-here
    OLLAMA_URL=http://localhost:11434/api/generate
    LOCAL_MODEL=llama3
    ```

## 🏃‍♂️ Usage Workflow

### Step 1: Generate Test Data
Create synthetic patient questions and rubrics using GPT-4.
```bash
yarn eval:gen
