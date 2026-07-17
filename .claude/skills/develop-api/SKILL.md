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
- **`src/controllers/`** — HTTP layer only: read `req.body`/`req.params`, `throw new ValidationError(...)` on bad input, call exactly one service method, shape the response. No business logic, no direct repository/model access, no try/catch (see Error handling below).
- **`src/routes/`** — thin `Router` factories (`createXRouter(controller)`) that bind controller methods to paths. No logic.

A class only ever depends on the **interface** of the layer below it, never the concrete class (except `ModelProvider`, a static factory — see `CLAUDE.md`).

## Adding a new resource end-to-end

Work top-down; each step depends on the previous one existing:

1. **Model** — `src/models/<thing>.ts`: Mongoose schema + `<Thing>Document` + `<Thing>Model`.
2. **Repository interface** — `src/repositories/interfaces/<thing>-repository.interface.ts`: methods the service layer needs (e.g. `findById`, `create`), typed against `<Thing>Document`.
3. **Repository implementation** — `src/repositories/<thing>-repository.ts`: `@injectable()` class implementing that interface, only file allowed to touch `<Thing>Model`.
4. **Service interface** — `src/services/interfaces/<thing>-service.interface.ts`: the business operations the controller needs, in domain terms (not Mongoose shapes).
5. **Service implementation** — `src/services/<thing>-service.ts`: `@injectable()` class implementing the interface. Constructor takes the repository interface (and any other interface dependencies) via `@inject(TOKENS.X)`. Throw `AppError` subclasses for expected failure cases (see below) — never plain `Error` for anything reachable from a request.
6. **Controller** — `src/controllers/<thing>-controller.ts`: `@injectable()` class, constructor takes the service interface via `@inject(TOKENS.X)`, methods are arrow-function class fields (`signup = async (req, res) => {...}`, so they can be passed directly to `router.post(...)` without losing `this`).
7. **Route** — `src/routes/<thing>-routes.ts`: `createXRouter(controller: XController): Router` binding paths to controller methods.
8. **DI wiring** — in `src/di/tokens.ts` add a `Symbol.for("<Thing>RepositoryInterface")` / `...ServiceInterface` token for each new interface; in `src/di/container.ts` register each with `container.register(TOKENS.X, { useClass: ConcreteClass })`.
9. **Mount** — in `index.ts`, resolve the controller with `container.resolve(XController)` and `app.use("/<path>", createXRouter(xController))`. Do not manually `new` anything here — everything comes from `configureContainer()` + `container.resolve(...)`.

Skip steps only when reusing an existing piece (e.g. a new service reusing `UserRepository` doesn't need a new repository).

## Dependency injection (tsyringe) checklist

- `@injectable()` on every repository, service, and controller class.
- `@inject(TOKENS.X)` on every constructor parameter typed as an **interface**. Parameters typed as a concrete class (rare) don't need `@inject`.
- Every interface needs a token in `TOKENS` (`src/di/tokens.ts`) and a registration in `configureContainer()` (`src/di/container.ts`) — `useClass` for implementations, `useValue` for primitive config (secrets, model names, etc.).
- Never `new` a repository/service/controller by hand outside `container.ts` — always resolve via the container (`container.resolve(X)`) or receive it through a constructor.

## Error handling checklist

- Import errors from the barrel: `import { ValidationError, NotFoundError, ... } from "../errors/index.js"` — never a single error file directly.
- Controllers: `throw new ValidationError("...")` for bad input instead of `res.status(400).json(...)`. No try/catch needed — Express 5 forwards a rejected async-handler promise to `errorHandler` automatically.
- Services: throw the specific `AppError` subclass for each expected failure (e.g. `EmailAlreadyExistsError`, `InvalidCredentialsError`), not a generic `Error`.
- **New failure case that doesn't map to an existing subclass**: add an entry to `ERROR_CODES` in both `src/errors/error-codes.ts` (backend) *and* `Rag-ui/src/errors/error-codes.ts` (frontend, data-only mirror) with a unique `code`, HTTP `status`, and default `message`; add a matching subclass in `src/errors/<name>-error.ts` extending `AppError`; export it from `src/errors/index.ts`. Do not reuse an unrelated error class just to avoid adding a new one — the whole point is that each failure type is distinguishable by `code` on the frontend.
- Plain `Error` is only acceptable for startup/config failures that crash the process before it starts serving requests (see `src/di/container.ts`, `src/services/db.ts` for the existing examples) — never for anything a request can trigger.

## After making changes

Always run `npx tsc --noEmit` in `RAG/` before considering the change done — this repo has no test suite or linter, so the type checker is the only automated guard.
