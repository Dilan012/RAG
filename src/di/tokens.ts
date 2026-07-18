export const TOKENS = {
  MessageRepository: Symbol.for("MessageRepositoryInterface"),
  UserRepository: Symbol.for("UserRepositoryInterface"),
  ChatConversationRepository: Symbol.for("ChatConversationRepositoryInterface"),
  ConversationService: Symbol.for("ConversationServiceInterface"),
  AuthService: Symbol.for("AuthServiceInterface"),
  ChatConversationService: Symbol.for("ChatConversationServiceInterface"),
  MessageService: Symbol.for("MessageServiceInterface"),
  ModelName: Symbol.for("SupportedModelName"),
  JwtSecret: Symbol.for("JwtSecret"),
} as const;
