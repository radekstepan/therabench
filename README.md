# TheraBench

An evaluation platform for testing how well Small Language Models (SLMs) and LLMs respond to therapeutic scenarios (CBT, DBT, ACT).

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

1.  **Generate evaluation scenarios**:
    ```bash
    yarn eval:gen
    ```
    This uses the expert model (e.g., GPT-4) to generate synthetic patient scenarios and saves them to `packages/eval-engine/data/questions.json`.

2.  **Run the evaluation**:
    ```bash
    yarn eval:run
    ```
    This runs your candidate model against the generated scenarios, has the expert model score each response, and saves results to `packages/eval-engine/data/results.json`.

3.  **View and analyze results**:
    ```bash
    yarn start
    ```
    This launches the dashboard at `http://localhost:5173` where you can visualize scores, override ratings, add notes, and export the curated dataset.

