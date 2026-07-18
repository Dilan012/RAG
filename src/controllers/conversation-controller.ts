import type { Request, Response } from "express";
import { inject, injectable } from "tsyringe";
import { isValidObjectId } from "mongoose";
import type { ChatConversationServiceInterface } from "../services/interfaces/chat-conversation-service.interface.js";
import { TOKENS } from "../di/tokens.js";
import { ValidationError } from "../errors/index.js";

@injectable()
export class ConversationController {
  constructor(
    @inject(TOKENS.ChatConversationService) private readonly conversationService: ChatConversationServiceInterface
  ) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.query;

    if (typeof userId !== "string") {
      throw new ValidationError("userId query parameter is required");
    }
    if (!isValidObjectId(userId)) {
      throw new ValidationError("userId must be a valid id");
    }

    const conversations = await this.conversationService.listConversations(userId);
    res.success(conversations);
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const { userId, name } = req.body ?? {};

    if (typeof userId !== "string" || typeof name !== "string") {
      throw new ValidationError("userId and name are required strings");
    }
    if (!isValidObjectId(userId)) {
      throw new ValidationError("userId must be a valid id");
    }

    const conversation = await this.conversationService.createConversation(userId, name);
    res.success(conversation, 201);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { userId, name } = req.body ?? {};

    if (typeof id !== "string" || typeof userId !== "string" || typeof name !== "string") {
      throw new ValidationError("id param and userId/name body fields are required strings");
    }
    if (!isValidObjectId(id) || !isValidObjectId(userId)) {
      throw new ValidationError("id and userId must be valid ids");
    }

    const conversation = await this.conversationService.renameConversation(id, userId, name);
    res.success(conversation);
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { userId } = req.body ?? {};

    if (typeof id !== "string" || typeof userId !== "string") {
      throw new ValidationError("id param and userId body field are required strings");
    }
    if (!isValidObjectId(id) || !isValidObjectId(userId)) {
      throw new ValidationError("id and userId must be valid ids");
    }

    await this.conversationService.deleteConversation(id, userId);
    res.success({ id });
  };
}
