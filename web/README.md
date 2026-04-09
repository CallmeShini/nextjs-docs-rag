## A-RAG Next.js Web

Companion web application for A-RAG Next.js.

This app is the user-facing layer for the API module in [`api`](../api/). It provides:

- a focused chat UI for asking questions about Next.js
- markdown answer rendering
- evidence and cache status badges
- citation cards that open the official source or download the local `.mdx`
- a `/docs` route that explains the product, architecture, and design decisions

This module is not intended to stand alone as the primary engineering artifact. Its purpose is to make the core runtime explorable, testable, and easier to present as a portfolio demo.

Created by Gabriel R. ([CallmeShini](https://github.com/CallmeShini)).

## Routes

- `/` — chat interface
- `/docs` — product and architecture documentation

## Local Setup

```bash
cd web
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

The web app expects the API module to expose:

- `POST /ask`
- `GET /health`
- `GET /source/download`

## Full-stack local test

API:

```bash
cd api
source ../.venv/bin/activate
uvicorn api.main:app --reload
```

Web:

```bash
cd web
npm run dev
```

## Docker

The workspace includes a root compose file:

- [../docker-compose.yml](../docker-compose.yml)

From the workspace root:

```bash
docker compose up --build
```

By default, the web image is built with:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

To point the built web app at a public API URL:

```bash
NEXT_PUBLIC_API_BASE_URL=https://your-domain.com docker compose up --build
```

In portfolio mode, the default expectation is still local demo execution rather than a continuously hosted deployment.

## Scripts

```bash
npm run dev
npm run lint
npm run build
```
