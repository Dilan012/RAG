export const TOKENS = {
  MessageRepository: Symbol.for("MessageRepositoryInterface"),
  UserRepository: Symbol.for("UserRepositoryInterface"),
  ConversationService: Symbol.for("ConversationServiceInterface"),
  AuthService: Symbol.for("AuthServiceInterface"),
  ModelName: Symbol.for("SupportedModelName"),
  JwtSecret: Symbol.for("JwtSecret"),
} as const;
