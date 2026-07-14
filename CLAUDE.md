# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- Typecheck: `npx tsc --noEmit`
- Build: `npm run build` (compiles `src/` and `index.ts` to `dist/`)
- Run compiled server: `npm start` (runs `dist/index.js`)
- Dev (watch mode compile): `npm run dev`
- No test suite is configured yet (`npm test` is a placeholder).

There is no linter configured in this repo.

## Environment

Requires a `.env` file (loaded via `dotenv` in `index.ts`) with:
- `OPENROUTER_API_KEY` — used by `ChatOpenRouter` (via `@langchain/openrouter`)
- `MONGODB_URI` — used by `src/services/db.ts` to connect via Mongoose
- `PORT` — optional, defaults to 3000

## Architecture

This is an Express + LangChain + MongoDB chat backend for a single `/chat` endpoint (e.g. for a WhatsApp-style customer chat integration). Entry point is `index.ts` at the repo root (not under `src/`).

Request flow: `POST /chat` (`index.ts`) → `ChatService.chat()` → `ModelProvider.getModel()` (LLM call) + `ConversationService` (MongoDB history) → returns `{ reply }`.

## Folder structure

```
index.ts                              # Express entry point, wires everything up
src/
  models/
    message.ts                        # Mongoose schema/model: MessageModel, MessageDocument
  services/
    interfaces/
      chat-service.interface.ts       # ChatServiceInterface
      conversation-service.interface.ts  # ConversationServiceInterface, ChatMessage
    chat-service.ts                   # ChatService implements ChatServiceInterface
    conversation-service.ts           # ConversationService implements ConversationServiceInterface
    model-provider.ts                 # ModelProvider (static ChatOpenRouter cache/factory)
    db.ts                             # connectToDatabase() — cached Mongoose connection
  repositories/
    interfaces/
      message-repository.interface.ts # MessageRepositoryInterface
    message-repository.ts             # MessageRepository implements MessageRepositoryInterface
```

Each layer (`services/`, `repositories/`) owns its own `interfaces/` subfolder — interfaces live next to the layer they belong to, not in one shared top-level folder.

- **`src/models/`** — Mongoose schemas/models only.
- **`src/repositories/`** — data-access layer; the only place allowed to call Mongoose/`MessageModel` directly. `message-repository.ts` exposes `findByCustomerId` / `create`.
- **`src/services/`** — business logic/orchestration, built on top of repositories:
  - `model-provider.ts` — `ModelProvider` is a **static** cache/factory over `ChatOpenRouter` instances, keyed by model name (`SupportedModelName`, a fixed union of 5 models: 3 GPT + 2 Gemini Flash). No interface (a static-only class can't implement one), and no `new ModelProvider()` — call `ModelProvider.getModel(name)` directly.
  - `chat-service.ts` — `ChatService` is constructed with a model name and a `ConversationServiceInterface` (dependency injection, not a singleton). `chat()` loads prior history, invokes the model, persists both the user message and the reply.
  - `conversation-service.ts` — `ConversationService` is constructed with a `MessageRepositoryInterface`; contains no direct Mongoose/DB calls itself — it only maps between `ChatMessage` (domain shape) and whatever the repository returns.
  - `db.ts` — `connectToDatabase()` lazily creates and caches a single Mongoose connection promise (the promise itself is cached, not the resolved value, so concurrent early callers share one in-flight connection).

## Development practices

- **Interface-first**: every service and repository class implements an interface, defined in that layer's own `interfaces/` subfolder (e.g. `src/services/interfaces/`, `src/repositories/interfaces/`), not a shared top-level `interfaces/` folder. When adding a new service or repository, write its `*.interface.ts` first, then the implementation.
- **Depend on interfaces, not classes**: consumers (e.g. `ChatService`) type their dependencies as the interface, never the concrete class, so implementations can be swapped or mocked without touching consumers.
- **Services vs. repositories**: services hold business logic and orchestration; repositories are the only layer allowed to talk to Mongoose/`MessageModel` directly. If a service needs new data access, add/extend a repository rather than querying the model from the service.
- **Constructor (dependency) injection**: classes receive their dependencies (model name, repository, conversation service) via the constructor. Avoid static singletons/`getInstance()` patterns for stateful services — `ModelProvider` is the one intentional exception, since it is a pure cache/factory with no per-instance state, and do not bypass it with direct `new ChatOpenRouter(...)` calls.
