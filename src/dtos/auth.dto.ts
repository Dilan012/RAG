import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().min(1, "name is required"),
  email: z.email("email must be a valid email address"),
  password: z.string().min(8, "password must be at least 8 characters"),
});
export type SignupDto = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z.email("email must be a valid email address"),
  password: z.string().min(1, "password is required"),
});
export type LoginDto = z.infer<typeof loginSchema>;
