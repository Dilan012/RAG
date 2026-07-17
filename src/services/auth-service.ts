import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { inject, injectable } from "tsyringe";
import type { UserRepositoryInterface } from "../repositories/interfaces/user-repository.interface.js";
import type { AuthResult, AuthServiceInterface } from "./interfaces/auth-service.interface.js";
import { TOKENS } from "../di/tokens.js";

const SALT_ROUNDS = 10;
const JWT_EXPIRES_IN = "7d";

@injectable()
export class AuthService implements AuthServiceInterface {
  constructor(
    @inject(TOKENS.UserRepository) private readonly userRepository: UserRepositoryInterface,
    @inject(TOKENS.JwtSecret) private readonly jwtSecret: string
  ) {}

  async signup(name: string, email: string, password: string): Promise<AuthResult> {
    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await this.userRepository.findByEmail(normalizedEmail);
    if (existingUser) {
      throw new Error("A user with this email already exists");
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await this.userRepository.create({ name, email: normalizedEmail, passwordHash });

    return this.buildAuthResult(user._id.toString(), user.name, user.email);
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.userRepository.findByEmail(normalizedEmail);
    if (!user) {
      throw new Error("Invalid email or password");
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new Error("Invalid email or password");
    }

    return this.buildAuthResult(user._id.toString(), user.name, user.email);
  }

  private buildAuthResult(id: string, name: string, email: string): AuthResult {
    const token = jwt.sign({ sub: id, email }, this.jwtSecret, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
    return { user: { id, name, email }, token };
  }
}
