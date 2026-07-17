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
- `JWT_SECRET` — required; used by `AuthService` to sign/verify login tokens
- `PORT` — optional, defaults to 3000

## Architecture

This is an Express + LangChain + MongoDB chat backend with a `/chat` endpoint (e.g. for a WhatsApp-style customer chat integration) and `/auth` signup/login endpoints. Entry point is `index.ts` at the repo root (not under `src/`).

Request flow (chat): `POST /chat` (`index.ts`) → `ChatService.chat()` → `ModelProvider.getModel()` (LLM call) + `ConversationService` (MongoDB history) → returns `{ reply }`.

Request flow (auth): `POST /auth/signup` | `POST /auth/login` (`src/routes/auth-routes.ts`) → `AuthController` (validates body shape, maps errors to HTTP status) → `AuthService` (hashing/JWT/business rules) → `UserRepository` (Mongoose) → returns `{ user, token }`.

## Dependency injection (tsyringe)

Wiring is done with `tsyringe`, not manual `new` chains. `src/di/container.ts` exports `configureContainer()`, which registers every interface token against its concrete implementation (and primitive config like `JWT_SECRET`/model name as `useValue`). `index.ts` calls `configureContainer()` once at startup, then gets fully-wired instances via `container.resolve(SomeClass)` instead of constructing dependency graphs by hand.

- `src/di/tokens.ts` — `TOKENS`, a `Symbol.for(...)` per interface (and per primitive config value), since TS interfaces don't exist at runtime and can't be used as DI keys directly.
- Every injectable class is decorated `@injectable()`; constructor params typed as an interface are decorated `@inject(TOKENS.X)` so tsyringe knows which token to resolve. Params typed as a concrete class (no interface) don't need `@inject` — tsyringe resolves those by type automatically via `emitDecoratorMetadata`.
- `reflect-metadata` is imported once (top of `src/di/container.ts`) — required by tsyringe's decorator metadata reflection. `tsconfig.json` has `experimentalDecorators`/`emitDecoratorMetadata` enabled to support this.
- **When adding a new interface + implementation**: add a token in `tokens.ts`, `@injectable()` the class, `@inject(TOKENS.X)` any interface-typed constructor params, then register it in `configureContainer()`. Nothing in `index.ts` needs to change beyond resolving the new top-level class if it's an entry point (e.g. a controller).

## Folder structure

```
index.ts                              # Express entry point: configureContainer() + resolve + mount routes
src/
  di/
    tokens.ts                         # TOKENS — Symbol per interface/config value used with @inject
    container.ts                      # configureContainer() — registers all interface tokens/values
  models/
    message.ts                        # Mongoose schema/model: MessageModel, MessageDocument
    user.ts                           # Mongoose schema/model: UserModel, UserDocument
  controllers/
    auth-controller.ts                # AuthController — HTTP layer for /auth routes
  routes/
    auth-routes.ts                    # createAuthRouter(authController) -> Router
  services/
    interfaces/
      chat-service.interface.ts       # ChatServiceInterface
      conversation-service.interface.ts  # ConversationServiceInterface, ChatMessage
      auth-service.interface.ts       # AuthServiceInterface, AuthUser, AuthResult
    chat-service.ts                   # ChatService implements ChatServiceInterface
    conversation-service.ts           # ConversationService implements ConversationServiceInterface
    auth-service.ts                   # AuthService implements AuthServiceInterface (bcrypt + jwt)
    model-provider.ts                 # ModelProvider (static ChatOpenRouter cache/factory)
    db.ts                             # connectToDatabase() — cached Mongoose connection
  repositories/
    interfaces/
      message-repository.interface.ts # MessageRepositoryInterface
      user-repository.interface.ts    # UserRepositoryInterface
    message-repository.ts             # MessageRepository implements MessageRepositoryInterface
    user-repository.ts                # UserRepository implements UserRepositoryInterface
```

Each layer (`services/`, `repositories/`) owns its own `interfaces/` subfolder — interfaces live next to the layer they belong to, not in one shared top-level folder.

- **`src/models/`** — Mongoose schemas/models only.
- **`src/repositories/`** — data-access layer; the only place allowed to call Mongoose/`MessageModel`/`UserModel` directly. `message-repository.ts` exposes `findByCustomerId` / `create`; `user-repository.ts` exposes `findByEmail` / `create`.
- **`src/controllers/`** — HTTP layer; parses/validates `req.body`, calls a service, maps thrown errors to status codes. Holds no business logic itself.
- **`src/routes/`** — thin Express `Router` factories that bind controller methods to paths (e.g. `createAuthRouter`).
- **`src/services/`** — business logic/orchestration, built on top of repositories:
  - `model-provider.ts` — `ModelProvider` is a **static** cache/factory over `ChatOpenRouter` instances, keyed by model name (`SupportedModelName`, a fixed union of 5 models: 3 GPT + 2 Gemini Flash). No interface (a static-only class can't implement one), and no `new ModelProvider()` — call `ModelProvider.getModel(name)` directly.
  - `chat-service.ts` — `ChatService` is constructed with a model name and a `ConversationServiceInterface` (dependency injection, not a singleton). `chat()` loads prior history, invokes the model, persists both the user message and the reply.
  - `conversation-service.ts` — `ConversationService` is constructed with a `MessageRepositoryInterface`; contains no direct Mongoose/DB calls itself — it only maps between `ChatMessage` (domain shape) and whatever the repository returns.
  - `auth-service.ts` — `AuthService` is constructed with a `UserRepositoryInterface`, the JWT secret, and an optional expiry. `signup()` rejects duplicate emails and hashes the password with bcrypt; `login()` verifies the hash; both return `{ user, token }` with a signed JWT.
  - `db.ts` — `connectToDatabase()` lazily creates and caches a single Mongoose connection promise (the promise itself is cached, not the resolved value, so concurrent early callers share one in-flight connection).

## Development practices

- **Interface-first**: every service and repository class implements an interface, defined in that layer's own `interfaces/` subfolder (e.g. `src/services/interfaces/`, `src/repositories/interfaces/`), not a shared top-level `interfaces/` folder. When adding a new service or repository, write its `*.interface.ts` first, then the implementation.
- **Depend on interfaces, not classes**: consumers (e.g. `ChatService`) type their dependencies as the interface, never the concrete class, so implementations can be swapped or mocked without touching consumers.
- **Services vs. repositories**: services hold business logic and orchestration; repositories are the only layer allowed to talk to Mongoose/`MessageModel` directly. If a service needs new data access, add/extend a repository rather than querying the model from the service.
- **Constructor (dependency) injection**: classes receive their dependencies (model name, repository, conversation service) via the constructor. Avoid static singletons/`getInstance()` patterns for stateful services — `ModelProvider` is the one intentional exception, since it is a pure cache/factory with no per-instance state, and do not bypass it with direct `new ChatOpenRouter(...)` calls.
