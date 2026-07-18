export const TOKENS = {
  MessageRepository: Symbol.for("MessageRepositoryInterface"),
  UserRepository: Symbol.for("UserRepositoryInterface"),
  ConversationRepository: Symbol.for("ConversationRepositoryInterface"),
  SummaryRepository: Symbol.for("SummaryRepositoryInterface"),
  ChatMemoryService: Symbol.for("ChatMemoryServiceInterface"),
  AuthService: Symbol.for("AuthServiceInterface"),
  ConversationService: Symbol.for("ConversationServiceInterface"),
  MessageService: Symbol.for("MessageServiceInterface"),
  SummaryService: Symbol.for("SummaryServiceInterface"),
  ModelName: Symbol.for("SupportedModelName"),
  JwtSecret: Symbol.for("JwtSecret"),
} as const;
