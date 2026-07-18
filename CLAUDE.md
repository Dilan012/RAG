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

Request flow (chat): `POST /chat` (`index.ts`, behind `authMiddleware`) → `chatService.chat(requireUserId(req), message)` → `ModelProvider.getModel()` (LLM call) + `ConversationService` (MongoDB history, keyed by the authenticated user's id) → returns `{ reply }`.

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
  types/
    express.d.ts                      # module augmentation: res.success, req.userId on Express's types
  di/
    tokens.ts                         # TOKENS — Symbol per interface/config value used with @inject
    container.ts                      # configureContainer() — registers all interface tokens/values
  models/
    message.ts                        # Mongoose schema/model: MessageModel, MessageDocument
    user.ts                           # Mongoose schema/model: UserModel, UserDocument
    chat-conversation.ts              # Mongoose schema/model: ChatConversationModel, ChatConversationDocument
  controllers/
    require-user-id.ts                # requireUserId(req) — reads req.userId, throws UnauthorizedError if absent
    auth-controller.ts                # AuthController — HTTP layer for /auth routes (public, no authMiddleware)
    conversation-controller.ts        # ConversationController — /conversations CRUD, behind authMiddleware
    message-controller.ts             # MessageController — GET /messages, behind authMiddleware
  routes/
    auth-routes.ts                    # createAuthRouter(authController) -> Router
    conversation-routes.ts            # createConversationRouter(conversationController) -> Router
    message-routes.ts                 # createMessageRouter(messageController) -> Router
  services/
    interfaces/
      chat-service.interface.ts       # ChatServiceInterface
      conversation-service.interface.ts  # ConversationServiceInterface, ChatMessage (message-history logic, keyed by userId)
      auth-service.interface.ts       # AuthServiceInterface, AuthUser, AuthResult
      chat-conversation-service.interface.ts  # ChatConversationServiceInterface, ConversationSummary (persisted conversation entity)
      message-service.interface.ts    # MessageServiceInterface, MessageSummary
    chat-service.ts                   # ChatService implements ChatServiceInterface
    conversation-service.ts           # ConversationService implements ConversationServiceInterface
    auth-service.ts                   # AuthService implements AuthServiceInterface (bcrypt + jwt)
    chat-conversation-service.ts      # ChatConversationService implements ChatConversationServiceInterface
    message-service.ts                # MessageService implements MessageServiceInterface
    model-provider.ts                 # ModelProvider (static ChatOpenRouter cache/factory)
    db.ts                             # connectToDatabase() — cached Mongoose connection
  repositories/
    interfaces/
      message-repository.interface.ts # MessageRepositoryInterface
      user-repository.interface.ts    # UserRepositoryInterface
      chat-conversation-repository.interface.ts  # ChatConversationRepositoryInterface, CreateChatConversationInput
    message-repository.ts             # MessageRepository implements MessageRepositoryInterface
    user-repository.ts                # UserRepository implements UserRepositoryInterface
    chat-conversation-repository.ts   # ChatConversationRepository implements ChatConversationRepositoryInterface
```

**Naming note**: the persisted `userId` + `name` conversation entity is named `ChatConversation*` throughout (model/repository/service), *not* `Conversation*` — that name was already taken by the pre-existing `ConversationService`/`ConversationServiceInterface`, which is unrelated message-history-loading logic for `ChatService` (keyed by `userId`, not the same thing as a `ChatConversation` document). The HTTP-facing `ConversationController`/`conversation-routes.ts` names are fine since no controller/route previously used that name.

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
  - `chat-conversation-service.ts` — `ChatConversationService` is constructed with a `ChatConversationRepositoryInterface`. `renameConversation`/`deleteConversation`/`getConversation` all go through a private `getOwnedConversation(id, userId)` first, throwing `NotFoundError` (not `UnauthorizedError`) if the conversation doesn't exist or isn't owned by that user — avoids confirming a conversation id exists to a non-owner.
  - `message-service.ts` — `MessageService` is constructed with a `MessageRepositoryInterface`; `listMessages(conversationId, userId)` maps raw documents to `MessageSummary`. Two independent layers enforce that a user can only ever see their own messages: `MessageController` checks conversation ownership via `ChatConversationService.getConversation` *before* calling this, **and** `MessageRepository.findByConversationId(conversationId, userId)` filters by `userId` at the database query itself — so even a bug that skipped the ownership check, or a future caller of the repository that forgets it, still can't leak another user's messages. Always pass `userId` all the way to the repository query for anything message-related; never filter by `conversationId` alone.
  - `db.ts` — `connectToDatabase()` lazily creates and caches a single Mongoose connection promise (the promise itself is cached, not the resolved value, so concurrent early callers share one in-flight connection).

## Development practices

- **Interface-first**: every service and repository class implements an interface, defined in that layer's own `interfaces/` subfolder (e.g. `src/services/interfaces/`, `src/repositories/interfaces/`), not a shared top-level `interfaces/` folder. When adding a new service or repository, write its `*.interface.ts` first, then the implementation.
- **Depend on interfaces, not classes**: consumers (e.g. `ChatService`) type their dependencies as the interface, never the concrete class, so implementations can be swapped or mocked without touching consumers.
- **Services vs. repositories**: services hold business logic and orchestration; repositories are the only layer allowed to talk to Mongoose/`MessageModel` directly. If a service needs new data access, add/extend a repository rather than querying the model from the service.
- **Constructor (dependency) injection**: classes receive their dependencies (model name, repository, conversation service) via the constructor. Avoid static singletons/`getInstance()` patterns for stateful services — `ModelProvider` is the one intentional exception, since it is a pure cache/factory with no per-instance state, and do not bypass it with direct `new ChatOpenRouter(...)` calls.
