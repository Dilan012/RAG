# Multi-tenancy: automatic tenant scoping

This documents **how to implement** tenant isolation using global Mongoose hooks +
`AsyncLocalStorage` (Option B from the multi-tenancy discussion). It is a design doc,
not yet implemented — nothing described here exists in the codebase today. Follow it
top-to-bottom when the app actually needs multi-tenancy.

## Goal

Every query issued through Mongoose should automatically be scoped to the current
tenant, without every repository method having to remember to pass `tenantId`
explicitly (the way `userId` is passed today in `ChatConversationRepository`).

## How it works, end to end

```
Request → auth middleware extracts tenantId → tenant-context middleware stores it in
AsyncLocalStorage → repository calls Model.find(...) as normal → Mongoose pre-hook
(from a schema plugin) reads tenantId out of AsyncLocalStorage → hook injects
{ tenantId } into the query filter (or the document, for writes) before it reaches
MongoDB.
```

The key idea: repositories don't change at all on the surface — they still call
`Model.find({ ... })` like today — but a global hook silently narrows every one of
those calls to the current tenant. The "current tenant" travels implicitly through
the async call stack via `AsyncLocalStorage`, the same way `req`/`res` travel through
Express's middleware chain, so it's available deep inside a service/repository call
without threading it through every function signature.

## 1. Add `tenantId` to every tenant-scoped schema

Every Mongoose schema that holds tenant-owned data (e.g. `ChatConversationDocument`,
`MessageDocument` — **not** a global/shared collection like a system config table)
gets a `tenantId` field:

```ts
tenantId: { type: Schema.Types.ObjectId, required: true, index: true }
```

Add it to compound indexes too — e.g. `{ tenantId: 1, userId: 1 }` on
`chat-conversation.ts`, `{ tenantId: 1, customerId: 1 }` on `message.ts` — so tenant
scoping doesn't turn every query into a collection scan.

## 2. Request-scoped tenant context (`AsyncLocalStorage`)

New file, e.g. `src/tenancy/tenant-context.ts`:

```ts
import { AsyncLocalStorage } from "node:async_hooks";

interface TenantContext {
  tenantId: string;
}

const storage = new AsyncLocalStorage<TenantContext>();

export function runWithTenant<T>(tenantId: string, fn: () => T): T {
  return storage.run({ tenantId }, fn);
}

export function getCurrentTenantId(): string {
  const context = storage.getStore();
  if (!context) {
    throw new Error("No tenant context is active for this request");
  }
  return context.tenantId;
}

// Explicit, auditable escape hatch for legitimate cross-tenant work
// (system jobs, admin tooling) — see "Escape hatch" section below.
export function runWithoutTenantScope<T>(fn: () => T): T {
  return storage.run({ tenantId: "__SYSTEM_BYPASS__" }, fn);
}
```

Throwing when there's no active context (rather than silently allowing an
unscoped query) is the important part — it turns "forgot to set up tenant context
for this code path" into a loud failure instead of a silent cross-tenant leak.

## 3. Middleware that populates the context per request

New file, e.g. `src/middleware/tenant-context-middleware.ts`, mounted early in
`index.ts` (after auth, since it needs the authenticated user's tenant):

```ts
import type { NextFunction, Request, Response } from "express";
import { runWithTenant } from "../tenancy/tenant-context.js";

export function tenantContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const tenantId = req.user?.tenantId; // wherever auth middleware puts it
  if (!tenantId) {
    return next(new UnauthorizedError("No tenant context for this request"));
  }
  runWithTenant(tenantId, next);
}
```

This assumes an auth middleware exists that decodes the JWT and puts `tenantId` on
`req.user` — that middleware doesn't exist yet either (routes are currently
unauthenticated past login), so it's a prerequisite, not part of this doc.

## 4. The Mongoose plugin that does the actual scoping

New file, e.g. `src/tenancy/tenant-scope-plugin.ts`:

```ts
import type { Schema } from "mongoose";
import { getCurrentTenantId } from "./tenant-context.js";

const SCOPED_QUERY_HOOKS = [
  "find",
  "findOne",
  "findOneAndUpdate",
  "findOneAndDelete",
  "updateOne",
  "updateMany",
  "deleteOne",
  "deleteMany",
  "countDocuments",
] as const;

export function tenantScopePlugin(schema: Schema): void {
  for (const hook of SCOPED_QUERY_HOOKS) {
    schema.pre(hook, function (this: any) {
      const filter = this.getFilter();
      if (filter.tenantId === undefined) {
        this.setQuery({ ...filter, tenantId: getCurrentTenantId() });
      }
    });
  }

  // Stamp tenantId onto new documents automatically, so callers never set it by hand.
  schema.pre("save", function (this: any) {
    if (this.isNew && !this.tenantId) {
      this.tenantId = getCurrentTenantId();
    }
  });

  // Same for Model.create(...) / insertMany(...), which don't always go through 'save'.
  schema.pre("insertMany", function (_next, docs: any[]) {
    const tenantId = getCurrentTenantId();
    for (const doc of docs) {
      if (!doc.tenantId) doc.tenantId = tenantId;
    }
  });
}
```

## 5. Apply the plugin to every tenant-scoped schema

```ts
// src/models/chat-conversation.ts
chatConversationSchema.plugin(tenantScopePlugin);
```

Do this for every schema that holds tenant data. This is the one manual step that
doesn't get compiler-enforced — see "Weak points" below for how to guard it.

## Escape hatch for legitimate cross-tenant access

Some code legitimately needs to cross tenant boundaries — an internal admin tool, a
scheduled job aggregating stats across tenants, a support-impersonation feature. Route
all of that through an explicit function (e.g. `runWithoutTenantScope`, or better, a
named function per legitimate use case: `runAsSystemJob(...)`) rather than letting
call sites quietly omit `tenantId` from a filter. Grep-ability matters here — anyone
auditing the codebase should be able to find every place tenant isolation is
intentionally bypassed by searching for one function name.

## Weak points to know about (this pattern doesn't cover everything)

- **New schemas that forget `.plugin(tenantScopePlugin)`** — nothing fails loudly if
  you add a new tenant-scoped model and forget the plugin line. Mitigate with a test
  that iterates `mongoose.modelNames()` and asserts every non-exempt model has the
  plugin's hooks registered (Mongoose exposes `schema.s.hooks` — or simpler, keep an
  explicit allowlist/denylist of "not tenant-scoped" model names and assert every
  other model has been through the plugin).
- **Aggregation pipelines (`Model.aggregate([...])`)** — the hooks above do not cover
  `aggregate()`; a `$match: { tenantId }` stage has to be added by hand at the start
  of every pipeline. This is the biggest real gap in this approach.
- **Raw driver access** (`mongoose.connection.db.collection(...)`) bypasses Mongoose
  entirely, and with it every hook. Shouldn't happen given the "only repositories
  touch Mongoose" rule already in this codebase, but worth knowing it's an escape
  hatch that isn't audited by anything above.
- **Background jobs / cron / message-queue consumers** that aren't triggered by an
  HTTP request need to explicitly call `runWithTenant(tenantId, ...)` themselves
  (there's no middleware to do it for them) — easy to forget when adding a new job.
- **This is defense by convention, not by the database.** MongoDB itself has no
  concept of tenant isolation here — everything above is application-level. For
  anything with strict compliance requirements (e.g. contractually-required tenant
  data isolation), this pattern alone may not be sufficient; that's where physical
  isolation (separate DB per tenant) becomes the safer choice despite the extra
  operational cost.

## Suggested rollout order

1. Add `tenantId` to schemas + indexes (nullable/optional at first if migrating
   existing data — see below).
2. Build `tenant-context.ts` + the plugin, but don't wire the middleware yet — write
   unit tests against the plugin directly (mock `AsyncLocalStorage`'s store) to prove
   it injects/rejects correctly before it's live on any real route.
3. Add the auth middleware that resolves `tenantId` from the JWT (if it doesn't exist
   yet), then the `tenantContextMiddleware` right after it.
4. Backfill `tenantId` on existing documents (a one-off migration script) before
   making the field `required: true` — otherwise the plugin will start rejecting
   reads/writes against untagged legacy rows the moment it's turned on.
5. Flip `tenantId` to `required: true` on every schema once backfilled.
6. Add the "every model has the plugin" regression test described above.
