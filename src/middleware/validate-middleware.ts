import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";
import { validate } from "../validation/validate.js";

export function validateBody<T>(schema: ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    req.body = validate(schema, req.body);
    next();
  };
}

export function validateParams<T>(schema: ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    // req.params is writable in Express 5, unlike req.query — mutate in place
    // rather than reassign so the object stays the same ParamsDictionary instance.
    Object.assign(req.params, validate(schema, req.params));
    next();
  };
}

export function validateQuery<T>(schema: ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    // Express 5's req.query is a getter with no setter — it can't be reassigned or
    // mutated in place. Validate for the throw-on-failure side effect only; the
    // controller reads req.query as usual afterwards, now guaranteed to match the schema.
    validate(schema, req.query);
    next();
  };
}
