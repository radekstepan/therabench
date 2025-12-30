# TheraBench

An evaluation platform for testing how well Small Language Models (SLMs) and LLMs respond to therapeutic scenarios (CBT, DBT, ACT) and perform context-based analysis (Transcript Adherence).

## 🏗 Architecture

- **`packages/eval-engine`**: A Node.js CLI tool.
  - Generates synthetic patient scenarios using a "Judge" model (e.g., GPT-4).
  - Runs local models (via Ollama) or API models against these scenarios.
  - Uses the Judge model to score responses (0-100) and output JSON.
  - Supports **Context-Based Evaluation** (RAG/Transcript) where the model must answer based solely on provided source text.
- **`packages/dashboard`**: A React + Vite Web UI.
  - Visualizes the results.
  - Tracks specific metrics: Safety, Empathy, Modality Adherence, and **Faithfulness**.
  - Allows human experts to override scores, rank answers, and add notes.
  - Exports the curated dataset for fine-tuning or analysis.

## 🚀 Prerequisites

1.  **Node.js** (v18+)
2.  **Yarn** or **NPM**
3.  **Ollama** running locally (for the candidate models) or API access to your model.
4.  **API Key** for the evaluator model (e.g., OpenAI for GPT-4).
5.  **(Optional)** **Infisical CLI** for secure secret management.

## 🛠 Setup & Installation

1.  **Install dependencies**:
    ```bash
    yarn install
    ```

2.  **Environment Setup**:
    
    Copy the example environment file:
    ```bash
    cp .env.example .env
    ```
    
    Edit `.env` with your configuration:
    ```env
    # Expert Model Configuration (for judging/scoring responses)
    EXPERT_MODEL_API_KEY=your-openai-api-key-here
    EXPERT_MODEL_URL=https://api.openai.com/v1
    EXPERT_MODEL_NAME=gpt-4-turbo
    
    # Candidate Model Configuration (the model being evaluated)
    CANDIDATE_MODEL_API_KEY=
    CANDIDATE_MODEL_URL=http://localhost:11434/api/generate
    CANDIDATE_MODEL_NAME=llama3
    ```

3.  **(Optional) Infisical Setup**:
    
    For secure secret management using Infisical:
    
    a. Install Infisical CLI:
    ```bash
    # macOS
    brew install infisical/get-cli/infisical
    
    # Other platforms: https://infisical.com/docs/cli/overview
    ```
    
    b. Copy the example config:
    ```bash
    cp .infisical.json.example .infisical.json
    ```
    
    c. Update `.infisical.json` with your workspace ID:
    ```json
    {
      "workspaceId": "your-workspace-id-here",
      "defaultEnvironment": "dev"
    }
    ```
    
    d. In Infisical, add your secrets with the same keys as in `.env.example`:
       - `EXPERT_MODEL_API_KEY`
       - `EXPERT_MODEL_URL`
       - `EXPERT_MODEL_NAME`
       - `CANDIDATE_MODEL_API_KEY`
       - `CANDIDATE_MODEL_URL`
       - `CANDIDATE_MODEL_NAME`
    
    When `.infisical.json` exists, the eval engine will automatically use Infisical to inject secrets. If Infisical CLI is not found, it falls back to using `.env` file.

## 🏃‍♂️ Usage Workflow

### 1. Standard Therapy Evaluation (CBT/DBT/ACT)

1.  **Generate evaluation scenarios**:
    ```bash
    yarn eval:gen
    ```
    This uses the expert model (e.g., GPT-4) to generate synthetic patient scenarios and saves them to `packages/eval-engine/data/questions.json`.

2.  **Run the evaluation**:
    ```bash
    yarn eval:run
    ```
    This runs your candidate model against the generated scenarios, has the expert model score each response, and saves results to `packages/eval-engine/data/results`.

### 2. Transcript & Faithfulness Evaluation

To evaluate how well a model grounds its answers in a specific transcript (RAG-style evaluation):

1.  **Create a transcript questions file** (e.g., `data/transcripts.json`):
    ```json
    {
      "questions": [
        {
          "id": "transcript_1",
          "category": "Transcript",
          "difficulty": "High",
          "title": "Session Summary",
          "context": "THERAPIST: How are you? CLIENT: I felt dizzy after taking the meds...",
          "scenario": "Did the client report side effects?",
          "rubric": {
            "mustInclude": ["Dizziness"],
            "mustAvoid": ["No side effects"]
          }
        }
      ]
    }
    ```

2.  **Run specific evaluation**:
    ```bash
    yarn eval:run --file packages/eval-engine/data/transcripts.json
    ```
    This will calculate a **Faithfulness** score (0-100) specifically measuring hallucination rates and grounding.

### 3. View Analysis

1.  **Start Dashboard**:
    ```bash
    yarn start
    ```
    This launches the dashboard at `http://localhost:5173`.
    
    - **Leaderboard**: See "Faithfulness" alongside Safety and Empathy scores.
    - **Drill-down**: Click a model to see its response. For Transcript questions, the source context will be displayed above the response for easy verification.
