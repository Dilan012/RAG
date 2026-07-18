---
name: develop-api
description: Use when adding or changing any backend code in RAG/ — new resources, endpoints, services, repositories, or error types. Encodes this repo's layering, dependency-injection (tsyringe), and error-handling conventions so new code matches the existing codebase instead of introducing a one-off pattern.
---

# Developing the RAG backend

This backend is layered (`models` → `repositories` → `services` → `controllers` → `routes`), interface-first, wired with `tsyringe` DI, and uses typed `AppError` subclasses instead of plain `Error`/manual `res.status(...)`. Follow the existing pattern exactly — do not introduce a new wiring style, a new error-handling approach, or skip a layer, even for something that looks small.

Read `CLAUDE.md` at the repo root first — it documents the current state of every layer, the folder tree, and env vars. This skill is the *procedure* for extending that state; `CLAUDE.md` is the *reference* for what already exists.

## Layering rules (non-negotiable)

- **`src/models/`** — Mongoose schema/model only. Export `<Thing>Document` interface (include `_id: Types.ObjectId` if repositories will return the raw doc) and `<Thing>Model`.
- **`src/repositories/`** — the *only* layer allowed to import a Mongoose model or call it directly. One file per repository, plus its interface in `repositories/interfaces/<name>.interface.ts`.
- **`src/services/`** — business logic/orchestration. Never imports a Mongoose model directly — if it needs data, it takes a repository interface as a constructor dependency. One file per service, plus its interface in `services/interfaces/<name>.interface.ts`.
- **`src/controllers/`** — HTTP layer only: read already-validated `req.body`/`req.params`/`req.query` (cast to the DTO type — see Input validation below; validation itself runs in the route, not here), get the caller's id with `requireUserId(req)` on any protected route, call exactly one service method, respond with `res.success(data, statusCode?)` (see Response envelope below). No business logic, no direct repository/model access, no try/catch, no raw `res.json(...)`, no manual `typeof` checks, no calling `validate(...)`/zod directly.
- **`src/routes/`** — thin `Router` factories (`createXRouter(controller)`) that bind controller methods to paths, chaining `validateBody`/`validateParams`/`validateQuery` middleware in front of the controller method for any route that takes input (see Input validation below).

A class only ever depends on the **interface** of the layer below it, never the concrete class (except `ModelProvider`, a static factory — see `CLAUDE.md`).

## Adding a new resource end-to-end

Work top-down; each step depends on the previous one existing:

1. **Model** — `src/models/<thing>.ts`: Mongoose schema + `<Thing>Document` + `<Thing>Model`.
2. **Repository interface** — `src/repositories/interfaces/<thing>-repository.interface.ts`: methods the service layer needs (e.g. `findById`, `create`), typed against `<Thing>Document`.
3. **Repository implementation** — `src/repositories/<thing>-repository.ts`: `@injectable()` class implementing that interface, only file allowed to touch `<Thing>Model`.
4. **Service interface** — `src/services/interfaces/<thing>-service.interface.ts`: the business operations the controller needs, in domain terms (not Mongoose shapes).
5. **Service implementation** — `src/services/<thing>-service.ts`: `@injectable()` class implementing the interface. Constructor takes the repository interface (and any other interface dependencies) via `@inject(TOKENS.X)`. Throw `AppError` subclasses for expected failure cases (see below) — never plain `Error` for anything reachable from a request.
6. **DTOs** — `src/dtos/<thing>.dto.ts`: one zod schema per request shape the controller accepts (body/params/query), each with an exported DTO type — the inferred TS shape the controller casts to, named `<Thing>Dto` (`export type CreateXDto = z.infer<typeof createXSchema>`). Reuse `common.dto.ts`'s `objectIdSchema` for any Mongo id coming from a param/query. `src/dtos/` is a top-level layer (like `src/errors/`), not nested under `controllers/`.
7. **Controller** — `src/controllers/<thing>-controller.ts`: `@injectable()` class, constructor takes the service interface via `@inject(TOKENS.X)`, methods are arrow-function class fields (`signup = async (req, res) => {...}`, so they can be passed directly to `router.post(...)` without losing `this`). Read input as `req.body as XDto` (etc.) — validation already happened in the route's middleware, so the controller only casts, never validates. If the route is protected, get the caller's id with `requireUserId(req)` (`src/controllers/require-user-id.ts`) — never trust a client-supplied `userId` in the body/query on a protected route. End each handler with `res.success(data, statusCode?)`, not `res.json(...)`.
8. **Route** — `src/routes/<thing>-routes.ts`: `createXRouter(controller: XController): Router` binding paths to controller methods, with `validateBody`/`validateParams`/`validateQuery(schema)` (`src/middleware/validate-middleware.ts`) chained in front of any method that takes input (see Input validation below). Decide whether the route needs `authMiddleware` (see Authentication below) — apply it when mounting in `index.ts`, not inside the router factory.
9. **DI wiring** — in `src/di/tokens.ts` add a `Symbol.for("<Thing>RepositoryInterface")` / `...ServiceInterface` token for each new interface; in `src/di/container.ts` register each with `container.register(TOKENS.X, { useClass: ConcreteClass })`.
10. **Mount** — in `index.ts`, resolve the controller with `container.resolve(XController)` and `app.use("/<path>", [authMiddleware,] createXRouter(xController))`. Do not manually `new` anything here — everything comes from `configureContainer()` + `container.resolve(...)`.

**Naming collisions**: before naming a new repository/service/interface `<Thing>*`, check `src/services/interfaces/` and `src/repositories/interfaces/` for an existing file with that base name that means something different (e.g. `ConversationService`/`ConversationServiceInterface` already exists for `ChatService`'s message-history logic — an unrelated, persisted "conversation" entity had to be named `ChatConversation*` instead to avoid colliding with it). Controllers/routes are a separate namespace from services/repositories, so `ConversationController`/`conversation-routes.ts` were fine even though `ConversationService` was taken.

Skip steps only when reusing an existing piece (e.g. a new service reusing `UserRepository` doesn't need a new repository).

## Dependency injection (tsyringe) checklist

- `@injectable()` on every repository, service, and controller class.
- `@inject(TOKENS.X)` on every constructor parameter typed as an **interface**. Parameters typed as a concrete class (rare) don't need `@inject`.
- Every interface needs a token in `TOKENS` (`src/di/tokens.ts`) and a registration in `configureContainer()` (`src/di/container.ts`) — `useClass` for implementations, `useValue` for primitive config (secrets, model names, etc.).
- Never `new` a repository/service/controller by hand outside `container.ts` — always resolve via the container (`container.resolve(X)`) or receive it through a constructor.

## Input validation (zod) checklist

- Validation runs in the **route**, as middleware, never inside the controller. `src/middleware/validate-middleware.ts` exports `validateBody(schema)` / `validateParams(schema)` / `validateQuery(schema)` — chain the ones a route needs before its controller method: `router.post("/", validateBody(createXSchema), controller.create)`.
- `validateBody`/`validateParams` mutate `req.body`/`req.params` in place with the parsed result. `validateQuery` **cannot** — Express 5's `req.query` is a getter with no setter — so it only validates for the throw side effect; the controller casts `req.query as unknown as XQueryDto` afterward.
- In the controller, read input as `req.body as XDto` / `req.params as XParamDto` — a cast, not a re-validation. This is only safe because the route's middleware already ran; every route that takes input must have its `validate*` middleware wired, with no exceptions "because it's simple."
- Every `src/dtos/<resource>.dto.ts` file exports its DTO type alongside the schema (`export type XDto = z.infer<typeof xSchema>`) for controllers to cast to. Naming: the zod schema variable is `xSchema` (the validator), the exported type is `XDto` (the shape a controller trusts after validation) — don't conflate the two or reuse "schema" as a type name.
- Never call `validate(...)` (the low-level `src/validation/validate.ts` helper) directly from a controller — that's what `validate-middleware.ts` wraps for you.

## Authentication

`src/middleware/auth-middleware.ts` exports `createAuthMiddleware(jwtSecret)`. Get the secret via `container.resolve<string>(TOKENS.JwtSecret)` in `index.ts`, then mount per-router: `app.use("/things", authMiddleware, createThingRouter(...))`. It verifies the `Authorization: Bearer <token>` header and sets `req.userId`; a protected controller reads it with `requireUserId(req)` (`src/controllers/require-user-id.ts`), never from a client-supplied `userId` body/query field. `/auth` (how you get a token) and `/chat` (not yet migrated) are the only unprotected routes today — any new resource tied to a specific user should be protected by default unless there's a specific reason not to.

## Error handling checklist

- Import errors from the barrel: `import { ValidationError, NotFoundError, ... } from "../errors/index.js"` — never a single error file directly.
- Controllers: `throw new ValidationError("...")` for bad input instead of `res.status(400).json(...)`. No try/catch needed — Express 5 forwards a rejected async-handler promise to `errorHandler` automatically.
- Services: throw the specific `AppError` subclass for each expected failure (e.g. `EmailAlreadyExistsError`, `InvalidCredentialsError`), not a generic `Error`.
- **New failure case that doesn't map to an existing subclass**: add an entry to `ERROR_CODES` in both `src/errors/error-codes.ts` (backend) *and* `Rag-ui/src/errors/error-codes.ts` (frontend, data-only mirror) with a unique `code`, HTTP `status`, and default `message`; add a matching subclass in `src/errors/<name>-error.ts` extending `AppError`; export it from `src/errors/index.ts`. Do not reuse an unrelated error class just to avoid adding a new one — the whole point is that each failure type is distinguishable by `code` on the frontend.
- Plain `Error` is only acceptable for startup/config failures that crash the process before it starts serving requests (see `src/di/container.ts`, `src/services/db.ts` for the existing examples) — never for anything a request can trigger.

## Response envelope

Every route responds with the same shape via two middlewares mounted in `index.ts` (`responseHandler` early, `errorHandler` last) — never call `res.json(...)` / `res.status(...).json(...)` directly in a controller:

- Success: `res.success(data)` → `{ success: true, data }` (200), or `res.success(data, 201)` for a custom status.
- Error: handled automatically by `errorHandler` from a thrown `AppError` → `{ success: false, error, code }`.

If you ever need to extend `Response` again (like `res.success`), augment `express-serve-static-core`, not `express` — augmenting `express` directly breaks `app.use`/`app.post` overload resolution (see `src/types/express.d.ts`).

## After making changes

Always run `npx tsc --noEmit` in `RAG/` before considering the change done — this repo has no test suite or linter, so the type checker is the only automated guard.
