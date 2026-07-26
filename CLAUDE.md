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
- `OPENROUTER_API_KEY` — used by `ChatOpenRouter` (via `@langchain/openrouter`) for chat, **and** by `EmbeddingService` for embeddings (OpenRouter exposes an OpenAI-compatible `/embeddings` endpoint, so `EmbeddingService` points LangChain's `OpenAIEmbeddings` at OpenRouter's base URL instead of OpenAI's — see the embedding-service.ts note below).
- `MONGODB_URI` — used by `src/services/db.ts` to connect via Mongoose
- `JWT_SECRET` — required; used by `AuthService` to sign/verify login tokens
- `PINECONE_API_KEY`, `PINECONE_INDEX_NAME` — required; used by `EmbeddingService` for vector storage/similarity search. The Pinecone index must already exist (created via the Pinecone dashboard/API, not by this app) with a dimension matching `appConfig.embedding.dimensions` (`1024`) and a compatible metric (cosine).
- `PORT` — optional, defaults to `appConfig.server.defaultPort` (3000)

`EmbeddingService.ingest()` writes uploaded/ingested files to `<project root>/uploads/` (created automatically, not configurable via env var yet). Ignored by git — never commit anything that lands there.

## Application configuration

`src/config/app-config.ts` exports a single `appConfig` object — every tunable, same-across-environments constant in the app (chunk sizes, thresholds, prompts, default models, salt rounds, upload limits, ...), grouped hierarchically by feature so a value's location matches where you'd look for it: `appConfig.embedding.chunkSize`, `appConfig.auth.bcryptSaltRounds`, `appConfig.chat.baseSystemPrompt`, etc.

- **What belongs here**: any magic number/string that would otherwise be a bare `const FOO = ...` sitting at the top of whichever file happens to use it — chunk size/overlap, embedding model name/dimensions, summarization thresholds, system prompts, JWT expiry, bcrypt salt rounds, file size limits, default ports/models.
- **What does NOT belong here**: secrets and per-environment values — API keys, connection strings, `JWT_SECRET`, Pinecone/index names. Those stay in `.env`, read via `configureContainer()`'s `requireEnv()` pattern (see Dependency injection below) and injected through `TOKENS`, never hardcoded in `app-config.ts`.
- **When adding a new tunable constant**: add it to the relevant (or a new) section of `appConfig` instead of declaring a local `const` in the file that uses it — even if only one file uses it today. Import `{ appConfig }` from `../config/app-config.js` and reference it as `appConfig.<section>.<name>`.
- Values are typed by inference (`as const`), so `appConfig.chat.defaultModel` is narrowed to `SupportedModelName`, not a bare `string` — the config file imports that type from `model-provider.ts` rather than redeclaring it.

## Architecture

This is an Express + LangChain + MongoDB chat backend with a `/chat` endpoint (e.g. for a WhatsApp-style customer chat integration) and `/auth` signup/login endpoints. Entry point is `index.ts` at the repo root (not under `src/`).

Request flow (chat): `POST /chat` (`index.ts`, behind `authMiddleware`) → `chatService.chat(requireUserId(req), message)` → `EmbeddingService.similaritySearch()` (RAG retrieval from Pinecone, scoped to the user's own knowledge base) + `ChatMemoryService` (MongoDB history, keyed by the authenticated user's id) → `ModelProvider.getModel()` (LLM call, given retrieved context + history) → returns `{ reply }`.

Request flow (auth): `POST /auth/signup` | `POST /auth/login` (`src/routes/auth-routes.ts`) → `AuthController` (validates body shape, maps errors to HTTP status) → `AuthService` (hashing/JWT/business rules) → `UserRepository` (Mongoose) → returns `{ user, token }`.

## Dependency injection (tsyringe)

Wiring is done with `tsyringe`, not manual `new` chains. `src/di/container.ts` exports `configureContainer()`, which registers every interface token against its concrete implementation (and primitive config like `JWT_SECRET`/model name as `useValue`). `index.ts` calls `configureContainer()` once at startup, then gets fully-wired instances via `container.resolve(SomeClass)` instead of constructing dependency graphs by hand.

- `src/di/tokens.ts` — `TOKENS`, a `Symbol.for(...)` per interface (and per primitive config value), since TS interfaces don't exist at runtime and can't be used as DI keys directly.
- Every injectable class is decorated `@injectable()`; constructor params typed as an interface are decorated `@inject(TOKENS.X)` so tsyringe knows which token to resolve. Params typed as a concrete class (no interface) don't need `@inject` — tsyringe resolves those by type automatically via `emitDecoratorMetadata`.
- `reflect-metadata` is imported once (top of `src/di/container.ts`) — required by tsyringe's decorator metadata reflection. `tsconfig.json` has `experimentalDecorators`/`emitDecoratorMetadata` enabled to support this.
- **When adding a new interface + implementation**: add a token in `tokens.ts`, `@injectable()` the class, `@inject(TOKENS.X)` any interface-typed constructor params, then register it in `configureContainer()`. Nothing in `index.ts` needs to change beyond resolving the new top-level class if it's an entry point (e.g. a controller).

## Error handling

Request-context errors are thrown as typed `AppError` subclasses, never plain `Error`. Express 5 auto-forwards rejected promises from async route handlers to error middleware, so services/controllers just `throw`; nothing needs try/catch for this.

- `src/errors/error-codes.ts` — `ERROR_CODES`, one entry per error type: `{ code, status, message }`. Mirrored (data only, no classes) in the frontend at `Rag-ui/src/errors/error-codes.ts` so both sides agree on codes/messages.
- `src/errors/app-error.ts` — abstract `AppError extends Error` base (`code`, `statusCode`, `message`).
- One subclass per error type, each defaulting its message from `ERROR_CODES` but overridable via constructor arg: `ValidationError` (400), `EmailAlreadyExistsError` (409), `InvalidCredentialsError` (401), `UnauthorizedError` (401), `NotFoundError` (404), `InternalError` (500).
- `src/errors/index.ts` — barrel re-exporting everything above; import from `../errors/index.js`, not individual files.
- `src/middleware/error-handler.ts` — `errorHandler`, the last middleware mounted in `index.ts`. `AppError` instances map to their own `statusCode`/`code`/`message`; anything else is logged and collapsed to a generic `INTERNAL_ERROR` 500 (never leaks internal error details to the client).
- **When adding a new failure case**: add an entry to `ERROR_CODES` (both backend and frontend copies), add a subclass in `src/errors/`, export it from `src/errors/index.ts`, then `throw` it directly from the service/controller — don't catch it locally just to translate it into a manual `res.status(...).json(...)` call.

## Response envelope

Every JSON response — success or error — has the same top-level shape, so the frontend can branch on `success` without guessing a response's structure per endpoint:
- Success: `{ success: true, data: T }`
- Error: `{ success: false, error: string, code: string }`

- `src/types/express.d.ts` — module augmentation adding `res.success<T>(data: T, statusCode = 200)` to Express's `Response` type. Augments `express-serve-static-core` (where `@types/express`'s `Response` is actually declared), not `express` itself — augmenting `express` directly breaks the `app.use`/`app.post` overload resolution.
- `src/middleware/response-handler.ts` — `responseHandler`, mounted early in `index.ts` (right after `express.json()`), attaches `res.success` to every response.
- Controllers call `res.success(result)` / `res.success(result, 201)` instead of `res.json(...)` / `res.status(...).json(...)`.
- `errorHandler` (see Error handling above) independently emits the matching `{ success: false, ... }` shape for the error case — the two middlewares together are what make the envelope consistent across every route.
- Frontend mirrors this with `Rag-ui/src/types/api.ts` (`ApiSuccessResponse<T>`); API functions (e.g. `auth-api.ts`) unwrap `res.data.data` to get back to the plain domain type.

## Authentication middleware

`src/middleware/auth-middleware.ts` exports `createAuthMiddleware(jwtSecret)`, a factory (not a DI-managed class, same style as `responseHandler`/`errorHandler`) returning an Express middleware that:
1. Requires an `Authorization: Bearer <token>` header — throws `UnauthorizedError` if missing/malformed.
2. Verifies the token with `jsonwebtoken` against `jwtSecret` — throws `UnauthorizedError` if invalid/expired.
3. Reads the `sub` claim (the user id — `AuthService` signs tokens with `{ sub: id, email }`) and sets `req.userId`.

Get the secret via `container.resolve<string>(TOKENS.JwtSecret)` in `index.ts`, then pass the middleware instance into each router factory that needs it: `createConversationRouter(controller, authMiddleware)`. **Applied per-route inside the router factory** (`router.get("/", authMiddleware, controller.list)` etc.), not once at the `app.use(path, authMiddleware, router)` level — mounting it at the router-group level would make it all-or-nothing for every path under that prefix, with no way for a future route on the same router (e.g. a public preview endpoint) to opt out. `/chat` (a plain inline handler, not a router) is mounted the same way, directly on its one route: `app.post("/chat", authMiddleware, validateBody(chatSchema), handler)`. Only `/auth` is intentionally NOT behind it — it's how you get a token in the first place. `/chat` derives its `userId` from `requireUserId(req)`, not from the request body — `chatSchema` never accepted a `userId`/`customerId` field.

`req.userId` is typed via the same module augmentation file as `res.success` — `src/types/express.d.ts` — augmenting `express-serve-static-core`.

In a protected controller, read the id with the shared helper `src/controllers/require-user-id.ts`'s `requireUserId(req)` (throws `UnauthorizedError` if somehow called without the middleware having run) rather than trusting a client-supplied `userId` in the body/query — see `ConversationController`/`MessageController` for the pattern. Never accept `userId` as client input on a route this middleware protects.

## Input validation (zod)

Validation happens in the **route**, as middleware — not inside the controller. Controllers trust that if they were reached, the request already matches the schema.

- `src/validation/validate.ts` — `validate(schema, data)`: the core `schema.safeParse(data)` + throw-`ValidationError`-on-failure helper. Not called directly from controllers/routes; it's what the middleware below is built on.
- `src/middleware/validate-middleware.ts` — `validateBody(schema)`, `validateParams(schema)`, `validateQuery(schema)`: each returns Express middleware. `validateBody`/`validateParams` reassign/mutate `req.body`/`req.params` in place with the parsed (and thus type-narrowed) result. **`validateQuery` cannot do that** — Express 5 makes `req.query` a getter with no setter — so it only validates for the throw-on-failure side effect; the controller still reads `req.query` afterwards (now guaranteed to match the schema, but requires a cast — see below).
- `src/dtos/<resource>.dto.ts` — one file per resource. Each file exports the zod schema(s) (variable name suffixed `Schema`, e.g. `signupSchema`) plus the corresponding **DTO** — the inferred TypeScript type the controller casts to, named `<Thing>Dto` (`export type SignupDto = z.infer<typeof signupSchema>`). `common.dto.ts` holds `objectIdSchema` (a `z.string().refine(isValidObjectId, ...)`) shared by every resource that validates a Mongo id from a param/query. This is its own top-level layer (like `errors/`, `middleware/`), not nested under `controllers/` — both routes (which consume the schemas) and controllers (which consume the DTO types) import from it.
- In the route: `router.post("/", validateBody(createXSchema), controller.create)` (chain as many `validate*` middlewares as the route needs, before the controller method).
- In the controller: `const { field } = req.body as XDto;` (or `req.params as XParamDto` / `req.query as unknown as XQueryDto` for query, per the getter caveat above) — a type assertion, not re-validation. The assertion is safe *because* the route already validated; a controller method reached without its route's `validate*` middleware would silently trust unvalidated data, so never skip wiring the middleware when adding a route.
- **Documented exception**: `EmbeddingController.ingest` (`POST /embeddings/ingest`) accepts *either* a multipart file upload *or* a JSON `{ text }` body on the same route — which input arrives isn't known until after `multer` has run, so there's no single request shape a route-level `validate*` middleware could check beforehand. When `req.file` is absent, the controller calls `validate(ingestTextSchema, req.body)` (`src/dtos/embedding.dto.ts`) itself — the *only* controller allowed to call `validate()` directly. Still zod-backed (validates presence + a 200,000-character cap), just invoked from the wrong layer out of necessity. Don't copy this pattern for a route that has one predictable body shape.
  - Both paths converge on the same shape before reaching the service: a file already saved to disk. `multer`'s `diskStorage` (see `embedding-routes.ts`) writes an uploaded file straight to `UPLOADS_DIR` and the controller just forwards `req.file.path`; for the text path, the controller calls `saveTextToDisk(text)` (`src/utils/save-text-to-disk.ts`) itself to write the text out the same way. `EmbeddingService.ingest()` never *writes* to the filesystem (no `mkdir`/`writeFile`) — it only ever receives a `filePath` that's guaranteed to already exist, then reads it back with `readFile`.
- **When adding a new endpoint**: write its zod schema + exported `<Thing>Dto` type in `src/dtos/`, wire `validateBody`/`validateParams`/`validateQuery` into the route, then read `req.body`/`req.params`/`req.query` in the controller with the DTO cast. Don't reintroduce manual `typeof x !== "string"` checks, don't call `isValidObjectId` ad hoc outside a schema, and don't call `validate(...)` directly from a controller.

## Folder structure

```
index.ts                              # Express entry point: configureContainer() + resolve + mount routes
src/
  errors/
    error-codes.ts                    # ERROR_CODES — code/status/message per error type
    app-error.ts                      # AppError abstract base class
    validation-error.ts               # ValidationError (400)
    email-already-exists-error.ts     # EmailAlreadyExistsError (409)
    invalid-credentials-error.ts      # InvalidCredentialsError (401)
    unauthorized-error.ts             # UnauthorizedError (401)
    not-found-error.ts                # NotFoundError (404)
    internal-error.ts                 # InternalError (500)
    index.ts                          # barrel export of all of the above
  middleware/
    error-handler.ts                  # errorHandler — maps AppError -> HTTP response, last middleware mounted
    response-handler.ts               # responseHandler — attaches res.success(data, status?), mounted early
    auth-middleware.ts                # createAuthMiddleware(jwtSecret) — verifies JWT, sets req.userId
    validate-middleware.ts            # validateBody/validateParams/validateQuery — route-level zod validation
  validation/
    validate.ts                       # validate(schema, data) — zod safeParse -> ValidationError on failure (used by validate-middleware.ts, not called directly from controllers)
  dtos/
    common.dto.ts                     # objectIdSchema — shared Mongo id validator
    auth.dto.ts                       # signupSchema/SignupDto, loginSchema/LoginDto
    conversation.dto.ts               # create/update/idParam schemas + CreateConversationDto, UpdateConversationDto, ConversationIdParamDto
    message.dto.ts                    # listMessagesQuerySchema, ListMessagesQueryDto
    chat.dto.ts                       # chatSchema, ChatDto (used directly in index.ts's /chat handler)
    embedding.dto.ts                  # ingestTextSchema, IngestTextDto — used directly in EmbeddingController (see Input validation exception)
  types/
    express.d.ts                      # module augmentation: res.success, req.userId on Express's types
  utils/
    uploads-dir.ts                    # UPLOADS_DIR, sanitizeFileName(fileName) — shared by embedding-routes.ts and save-text-to-disk.ts
    save-text-to-disk.ts               # saveTextToDisk(text, fileName?) -> filePath — the text-input equivalent of multer's diskStorage
  config/
    app-config.ts                     # appConfig — every tunable non-secret constant, grouped hierarchically by feature (see Application configuration above)
  di/
    tokens.ts                         # TOKENS — Symbol per interface/config value used with @inject
    container.ts                      # configureContainer() — registers all interface tokens/values
  models/
    message.ts                        # Mongoose schema/model: MessageModel, MessageDocument
    user.ts                           # Mongoose schema/model: UserModel, UserDocument
    conversation.ts                    # Mongoose schema/model: ConversationModel, ConversationDocument
    summary.ts                         # Mongoose schema/model: SummaryModel, SummaryDocument (one row per conversation, upserted)
  controllers/
    require-user-id.ts                # requireUserId(req) — reads req.userId, throws UnauthorizedError if absent
    auth-controller.ts                # AuthController — HTTP layer for /auth routes (public, no authMiddleware)
    conversation-controller.ts        # ConversationController — /conversations CRUD, behind authMiddleware
    message-controller.ts             # MessageController — GET /messages, behind authMiddleware
    embedding-controller.ts           # EmbeddingController — POST /embeddings/ingest, behind authMiddleware (file-or-text exception, see Input validation)
  routes/
    auth-routes.ts                    # createAuthRouter(authController) -> Router
    conversation-routes.ts            # createConversationRouter(conversationController) -> Router
    message-routes.ts                 # createMessageRouter(messageController) -> Router
    embedding-routes.ts               # createEmbeddingRouter(embeddingController) -> Router; multer diskStorage writes straight to UPLOADS_DIR, file size limit from appConfig.uploads.maxFileSizeBytes, MulterError mapped to ValidationError
  services/
    interfaces/
      chat-service.interface.ts       # ChatServiceInterface
      chat-memory-service.interface.ts  # ChatMemoryServiceInterface, ChatMessage (LLM memory: message-history load/append, keyed by userId)
      auth-service.interface.ts       # AuthServiceInterface, AuthUser, AuthResult
      conversation-service.interface.ts  # ConversationServiceInterface, ConversationSummary (persisted conversation entity — CRUD, not LLM memory)
      message-service.interface.ts    # MessageServiceInterface, MessageSummary
      summary-service.interface.ts    # SummaryServiceInterface, SummaryRecord
      embedding-service.interface.ts  # EmbeddingServiceInterface, IngestSource — embed()/ingest() both currently stubs, not implemented yet
    chat-service.ts                   # ChatService implements ChatServiceInterface
    chat-memory-service.ts             # ChatMemoryService implements ChatMemoryServiceInterface
    auth-service.ts                   # AuthService implements AuthServiceInterface (bcrypt + jwt)
    conversation-service.ts            # ConversationService implements ConversationServiceInterface
    message-service.ts                # MessageService implements MessageServiceInterface
    summary-service.ts                # SummaryService implements SummaryServiceInterface (LLM summarization)
    embedding-service.ts              # EmbeddingService implements EmbeddingServiceInterface — owns both embedding generation (embed(), via LangChain's OpenAIEmbeddings pointed at OpenRouter) and vector storage/search (ingest(), similaritySearch()), via LangChain's PineconeStore (@langchain/pinecone) rather than the raw Pinecone SDK. No separate VectorStoreService — kept inline here deliberately, as a quick/pragmatic choice rather than introducing another layer.
    model-provider.ts                 # ModelProvider (static ChatOpenRouter cache/factory)
    db.ts                             # connectToDatabase() — cached Mongoose connection
  repositories/
    interfaces/
      message-repository.interface.ts # MessageRepositoryInterface
      user-repository.interface.ts    # UserRepositoryInterface
      conversation-repository.interface.ts  # ConversationRepositoryInterface, CreateConversationInput
      summary-repository.interface.ts # SummaryRepositoryInterface, UpsertSummaryInput
    message-repository.ts             # MessageRepository implements MessageRepositoryInterface
    user-repository.ts                # UserRepository implements UserRepositoryInterface
    conversation-repository.ts         # ConversationRepository implements ConversationRepositoryInterface
    summary-repository.ts             # SummaryRepository implements SummaryRepositoryInterface
```

**Naming history** (matters if old code/docs/branches reference former names): the persisted `userId` + `name` conversation entity's model/repository/service were briefly named `ChatConversation*` because the plain `Conversation*` name was, at the time, taken by the LLM message-history load/append logic used by `ChatService`. That logic was renamed `ChatMemoryService`/`ChatMemoryServiceInterface` (clearer: it's the LLM-memory layer, not conversation CRUD) specifically to free up `Conversation*` for the entity, which was then renamed back from `ChatConversation*` to the current `Conversation*`. The HTTP-facing `ConversationController`/`conversation-routes.ts` names never changed — they were never in conflict with either.

Each layer (`services/`, `repositories/`) owns its own `interfaces/` subfolder — interfaces live next to the layer they belong to, not in one shared top-level folder.

- **`src/models/`** — Mongoose schemas/models only.
- **`src/repositories/`** — data-access layer; the only place allowed to call Mongoose/`MessageModel`/`UserModel` directly. `message-repository.ts` exposes `findByCustomerId` / `create`; `user-repository.ts` exposes `findByEmail` / `create`.
- **`src/controllers/`** — HTTP layer; parses/validates `req.body`, calls a service, maps thrown errors to status codes. Holds no business logic itself.
- **`src/routes/`** — thin Express `Router` factories that bind controller methods to paths (e.g. `createAuthRouter`).
- **`src/services/`** — business logic/orchestration, built on top of repositories:
  - `model-provider.ts` — `ModelProvider` is a **static** cache/factory over `ChatOpenRouter` instances, keyed by model name (`SupportedModelName`, a fixed union of 5 models: 3 GPT + 2 Gemini Flash). No interface (a static-only class can't implement one), and no `new ModelProvider()` — call `ModelProvider.getModel(name)` directly.
  - `chat-service.ts` — `ChatService` is constructed with a model name, a `ChatMemoryServiceInterface`, and an `EmbeddingServiceInterface` (dependency injection, not a singleton). `chat()`: builds the base system prompt, retrieves relevant knowledge-base context via `EmbeddingService.similaritySearch(userId, userMessage)` and injects it as an additional `role: "system"` message (`buildKnowledgeBaseContext`, private) *before* conversation history — this is the RAG retrieval step, scoped by `userId` the same way every other embedding query is — then loads prior history, invokes the model, and persists both the user message and the reply. If the similarity search returns no results (empty knowledge base, or nothing relevant), no extra context is added — this is not treated as an error.
  - `chat-memory-service.ts` — `ChatMemoryService` (the LLM memory layer — manages what context gets fed back into the model) is constructed with a `MessageRepositoryInterface`, `SummaryRepositoryInterface`, and `SummaryServiceInterface`; contains no direct Mongoose/DB calls itself — it only maps between `ChatMessage` (domain shape) and whatever the repositories return.
    - `getHistory(userId, conversationId?)` builds **full context = summary + messages since that summary**, not just raw messages: it looks up any existing `Summary` for the conversation, then fetches only the messages created *after* that summary's `createdAt` (via `MessageRepository.findByConversationIdSince`). If a summary exists, it's prepended as a `role: "system"` entry (`ChatMessage.role` includes `"system"` for exactly this) before the recent messages. Without a `conversationId` (the legacy/unscoped case), it falls back to all of the user's messages with no summary involved.
    - `appendMessage(userId, message, conversationId?)` saves the message, then (if `conversationId` is set) calls private `maybeSummarize()`: counts messages since the last summary via `MessageRepository.countByConversationIdSince`, and once that count reaches `appConfig.memory.summarizationMessageThreshold` (currently 10), fetches those messages and calls `SummaryService.summarizeConversation(conversationId, userId, messages)` — which itself independently loads the prior summary and folds it in before upserting (see `summary-service.ts` below), so summaries keep accumulating context rather than being replaced wholesale each time.
  - `auth-service.ts` — `AuthService` is constructed with a `UserRepositoryInterface`, the JWT secret, and an optional expiry. `signup()` rejects duplicate emails and hashes the password with bcrypt; `login()` verifies the hash; both return `{ user, token }` with a signed JWT.
  - `conversation-service.ts` — `ConversationService` is constructed with a `ConversationRepositoryInterface`. `renameConversation`/`deleteConversation`/`getConversation` all go through a private `getOwnedConversation(id, userId)` first, throwing `NotFoundError` (not `UnauthorizedError`) if the conversation doesn't exist or isn't owned by that user — avoids confirming a conversation id exists to a non-owner. Not to be confused with `chat-memory-service.ts`'s `ChatMemoryService` — this one is CRUD for the conversation entity itself, that one is LLM message-history load/append.
  - `message-service.ts` — `MessageService` is constructed with a `MessageRepositoryInterface`; `listMessages(conversationId, userId)` maps raw documents to `MessageSummary`. Two independent layers enforce that a user can only ever see their own messages: `MessageController` checks conversation ownership via `ConversationService.getConversation` *before* calling this, **and** `MessageRepository.findByConversationId(conversationId, userId)` filters by `userId` at the database query itself — so even a bug that skipped the ownership check, or a future caller of the repository that forgets it, still can't leak another user's messages. Always pass `userId` all the way to the repository query for anything message-related; never filter by `conversationId` alone.
  - `summary-service.ts` — `SummaryService` is constructed with a model name and a `SummaryRepositoryInterface`. `summarizeConversation(conversationId, userId, messages)` loads any existing `Summary` for the conversation, feeds it back to the LLM as prior context alongside the new `messages` (so the summary accumulates rather than resets), and `upsert`s the result — one `Summary` row per conversation, not a history log. Only called from `ChatMemoryService.maybeSummarize` today (see below); no controller/route yet.
  - `embedding-service.ts` — `EmbeddingService` is constructed with `PineconeApiKey`/`PineconeIndexName`/`OpenRouterApiKey`. Owns a LangChain `OpenAIEmbeddings` client (embedding generation) and a LangChain `PineconeStore` (`@langchain/pinecone`, vector storage/search — not the raw `@pinecone-database/pinecone` SDK directly, though that SDK is still used once, to build the underlying `pineconeIndex` handle `PineconeStore.fromExistingIndex` wraps). No repository layer — Pinecone is the persistence, not Mongo. No separate `VectorStoreService`; embedding generation and vector storage/search were deliberately kept in one file for a quick implementation.
    - **`@pinecone-database/pinecone` is pinned to `^5.0.2`**, not the latest major (v8 at time of writing) — `@langchain/pinecone`'s peer dependency only supports v5, and v8 has breaking API changes (e.g. `pc.index()` takes an options object, `upsert()` requires `{ records }`) that would silently break `PineconeStore`'s internals if the SDK were upgraded without `@langchain/pinecone` also supporting it. Don't bump this package without checking `@langchain/pinecone`'s peer range first.
    - `embed(text)` — calls `this.embeddings.embedQuery(text)` (LangChain's `OpenAIEmbeddings`, from `@langchain/openai`) to turn text into a dense vector. **Not actually calling OpenAI** — the client is constructed with `configuration: { baseURL: "https://openrouter.ai/api/v1" }` and the `OPENROUTER_API_KEY`, since OpenRouter exposes an OpenAI-compatible `/embeddings` endpoint (`appConfig.embedding.model = "openai/text-embedding-3-small"`, routed through OpenRouter). `dimensions: appConfig.embedding.dimensions` (1024) is set explicitly — `text-embedding-3` models support a custom output size via Matryoshka representation, which is what lets this match the Pinecone index's configured dimension without needing a larger/different index. This is a real embedding call, not a stub — unlike `ChatService`'s `ModelProvider` (LangChain chat models via `@langchain/openrouter`'s `ChatOpenRouter`), embeddings go through `@langchain/openai`'s client instead, since `@langchain/openrouter` doesn't ship an `Embeddings` class.
    - `ingest(source)` — `extractText()` branches on `source.mimeType`: `"application/pdf"` uses `@langchain/community`'s `PDFLoader` (all pages joined into one string), everything else is read as plain UTF-8 text (`readFile`) — no other format-specific extraction yet, so e.g. `.docx` will silently produce garbled text. The extracted text is chunked via `@langchain/textsplitters`' `RecursiveCharacterTextSplitter` (`appConfig.embedding.chunkSize=1000`, `appConfig.embedding.chunkOverlap=200`), turned into LangChain `Document`s (`{ pageContent: chunk, metadata: { userId, fileName } }`), and added via `vectorStore.addDocuments(documents, { ids })` — `PineconeStore` handles embedding + upserting internally (using the injected `OpenAIEmbeddings`), so `ingest()` never calls `embed()` or touches Pinecone directly itself.
    - `similaritySearch(userId, query, topK?)` — calls `vectorStore.similaritySearchWithScore(query, topK, { userId: { $eq: userId } })` — **always scope Pinecone queries by `userId`** the same way Mongo queries are scoped elsewhere in this codebase (see `MessageRepository.findByConversationId`'s defense-in-depth note) — never query without it, or one user's search could return another user's ingested content. Returns `[Document, score][]`, mapped to `{ content: doc.pageContent, score, metadata: doc.metadata }`.
    - No controller/route exposes `similaritySearch` yet — only `ingest` is reachable via `POST /embeddings/ingest`.
  - `db.ts` — `connectToDatabase()` lazily creates and caches a single Mongoose connection promise (the promise itself is cached, not the resolved value, so concurrent early callers share one in-flight connection).

## Development practices

- **Interface-first**: every service and repository class implements an interface, defined in that layer's own `interfaces/` subfolder (e.g. `src/services/interfaces/`, `src/repositories/interfaces/`), not a shared top-level `interfaces/` folder. When adding a new service or repository, write its `*.interface.ts` first, then the implementation.
- **Depend on interfaces, not classes**: consumers (e.g. `ChatService`) type their dependencies as the interface, never the concrete class, so implementations can be swapped or mocked without touching consumers.
- **Services vs. repositories**: services hold business logic and orchestration; repositories are the only layer allowed to talk to Mongoose/`MessageModel` directly. If a service needs new data access, add/extend a repository rather than querying the model from the service.
- **Constructor (dependency) injection**: classes receive their dependencies (model name, repository, conversation service) via the constructor. Avoid static singletons/`getInstance()` patterns for stateful services — `ModelProvider` is the one intentional exception, since it is a pure cache/factory with no per-instance state, and do not bypass it with direct `new ChatOpenRouter(...)` calls.
