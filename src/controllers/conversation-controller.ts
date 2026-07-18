import type { Request, Response } from "express";
import { inject, injectable } from "tsyringe";
import type { ChatConversationServiceInterface } from "../services/interfaces/chat-conversation-service.interface.js";
import { TOKENS } from "../di/tokens.js";
import { requireUserId } from "./require-user-id.js";
import type {
  ConversationIdParamDto,
  CreateConversationDto,
  UpdateConversationDto,
} from "../dtos/conversation.dto.js";

@injectable()
export class ConversationController {
  constructor(
    @inject(TOKENS.ChatConversationService) private readonly conversationService: ChatConversationServiceInterface
  ) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    const conversations = await this.conversationService.listConversations(userId);
    res.success(conversations);
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    const { name } = req.body as CreateConversationDto;

    const conversation = await this.conversationService.createConversation(userId, name);
    res.success(conversation, 201);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    const { id } = req.params as ConversationIdParamDto;
    const { name } = req.body as UpdateConversationDto;

    const conversation = await this.conversationService.renameConversation(id, userId, name);
    res.success(conversation);
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    const { id } = req.params as ConversationIdParamDto;

    await this.conversationService.deleteConversation(id, userId);
    res.success({ id });
  };
}
