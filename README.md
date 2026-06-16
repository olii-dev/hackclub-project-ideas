# Hack Club Project Ideas (fan-made)

A project-idea generator for teen builders, styled after Hack Club's brand.
Pick a category and difficulty, hit **Generate**, and get a fresh batch of build
ideas — web, games, hardware, AI, and more.

> **Not affiliated with Hack Club.** This is an independent fan project. "Hack Club"
> and the Hack Club flag are trademarks of their respective owners. The real thing
> lives at [hackclub.com](https://hackclub.com).

---

## How it works

- **Frontend** — static `index.html` / `style.css` / `script.js`. Host anywhere
  (GitHub Pages or Vercel). Calls `/api/generate`.
- **Backend** — `api/generate.js`, a Vercel Node serverless function. It uses the
  **KeyKing** SDK to unlock your encrypted vault of free provider keys, then makes
  an OpenAI-compatible chat-completion request with automatic provider fallback
  (Groq → Gemini → Mistral → OpenRouter → OpenAI). The AI key never reaches the
  browser.

No API key is ever shipped to the frontend. Per-IP rate limiting + your providers'
free-tier limits keep abuse in check.

---

## 1. Backend setup

### Option A — KeyKing vault (recommended, uses your free providers)

1. Install the [KeyKing desktop app](https://github.com/Malaybhai11/keyking/releases/latest).
2. Add your free keys in the Keys tab (get them free from
   [Groq](https://console.groq.com), [Google Gemini](https://aistudio.google.com),
   [Mistral](https://console.mistral.ai), etc.).
3. Export the vault (Keys tab → **Export Vault**) and save it as `vault.kk`.

### Option B — a single plain provider key (quickest)

Skip KeyKing entirely and just set one provider env var, e.g. `GROQ_API_KEY`.
The function will use it directly.

### Environment variables (set these on Vercel)

| Variable | Required | Purpose |
| --- | --- | --- |
| `KEYKING_MASTER_PASSWORD` | Option A | Password that decrypts your KeyKing vault |
| `KEYKING_VAULT` | Option A | Full contents of your exported `vault.kk` (keeps secrets out of git) |
| `GROQ_API_KEY` (or `GEMINI_API_KEY`, `MISTRAL_API_KEY`, `OPENROUTER_API_KEY`, `OPENAI_API_KEY`) | Option B | A plain provider key, used directly |
| `ALLOWED_ORIGINS` | Optional | Comma-separated allowed origins, e.g. `https://you.github.io,https://your.vercel.app`. Defaults to `*`. |

---

## 2. Run locally

You'll need Node 18+.

```bash
npm install
npm i -g vercel        # one time
vercel dev             # serves frontend at http://localhost:3000 and /api/generate
```

Set the env vars above (a local `.env` works with `vercel dev` after
`vercel link`, or set them in the Vercel dashboard for your dev environment).

---

## 3. Deploy

### Easiest: everything on Vercel (frontend + API, same origin)

1. Push this repo to GitHub.
2. Import it into [Vercel](https://vercel.com/new).
3. Add the env vars from the table above in **Project → Settings → Environment Variables**.
4. Deploy. The static site and the `/api/generate` function ship together — no CORS issues.

### Alternative: frontend on GitHub Pages, backend on Vercel

1. Deploy the **whole repo** to Vercel (this gives you `/api/generate`).
2. Deploy `index.html` / `style.css` / `script.js` to GitHub Pages.
3. In `script.js`, set `API_BASE` to your Vercel URL, e.g.
   `const API_BASE = 'https://your-project.vercel.app';`
4. On Vercel, set `ALLOWED_ORIGINS` to your GitHub Pages URL.

---

## API contract

`POST /api/generate`

```json
{ "category": "games", "difficulty": "Intermediate", "count": 6 }
```

Response:

```json
{
  "ideas": [
    {
      "title": "...",
      "difficulty": "Beginner|Intermediate|Advanced",
      "timeEstimate": "~3 hours",
      "stack": ["HTML", "Canvas", "JavaScript"],
      "description": "...",
      "steps": ["...", "..."]
    }
  ]
}
```

Errors return `429` (rate limited) or `502` (no provider available, with a `details` array).

---

## Notes

- The site loads into an empty "pick filters & generate" state — there is no
  curated fallback list by design.
- The fan-affiliation disclaimer appears in the nav, hero badge, and footer.
- Brand assets (Phantom Sans font, Orpheus flag, color palette) are loaded from
  `assets.hackclub.com` per their [brand page](https://hackclub.com/brand/).

Built by a fan. Go make cool stuff.
