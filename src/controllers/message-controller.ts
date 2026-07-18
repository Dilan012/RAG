import type { Request, Response } from "express";
import { inject, injectable } from "tsyringe";
import type { MessageServiceInterface } from "../services/interfaces/message-service.interface.js";
import type { ChatConversationServiceInterface } from "../services/interfaces/chat-conversation-service.interface.js";
import { TOKENS } from "../di/tokens.js";
import { requireUserId } from "./require-user-id.js";
import type { ListMessagesQueryDto } from "../dtos/message.dto.js";

@injectable()
export class MessageController {
  constructor(
    @inject(TOKENS.MessageService) private readonly messageService: MessageServiceInterface,
    @inject(TOKENS.ChatConversationService) private readonly conversationService: ChatConversationServiceInterface
  ) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    // req.query is validated by validateQuery(listMessagesQuerySchema) in message-routes.ts;
    // Express 5's req.query can't be reassigned, so this cast trusts that middleware ran.
    const { conversationId } = req.query as unknown as ListMessagesQueryDto;

    // Confirms the conversation exists and belongs to the caller before returning its messages.
    await this.conversationService.getConversation(conversationId, userId);

    const messages = await this.messageService.listMessages(conversationId);
    res.success(messages);
  };
}
