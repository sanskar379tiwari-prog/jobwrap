# Jobwrap

Text-only web app: enter a tech job role → get a brutally honest, structured career roadmap (India-focused salary reality).

## Requirements

- Node.js 18+ (uses built-in `fetch`)

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create your `.env` from the example:

```bash
copy .env.example .env
```

3. Fill in `AI_API_KEY` (Hugging Face token with “Inference Providers” permission).  
   Use a **chat model** (e.g. `Qwen/Qwen2.5-7B-Instruct`). FLAN-T5 is not supported on the Router; pick a model from [Inference Models](https://huggingface.co/inference/models).

## Run (backend)

```bash
npm run dev
```

Backend runs on `http://localhost:3000` (or your `PORT`).

## Run (frontend)

Open [`frontend/index.html`](frontend/index.html) in your browser.

If your browser blocks cross-origin requests from `file://`, run a tiny static server in the project root (one option):

```bash
npx serve .
```

Then open the `frontend/` page from the local server and keep the backend running.

