import "express-serve-static-core";

declare module "express-serve-static-core" {
  interface Response {
    /** Sends a standardized success envelope: `{ success: true, data }`. */
    success<T>(data: T, statusCode?: number): void;
  }
}
