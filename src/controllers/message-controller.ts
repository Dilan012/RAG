import type { Request, Response } from "express";
import { inject, injectable } from "tsyringe";
import { isValidObjectId } from "mongoose";
import type { MessageServiceInterface } from "../services/interfaces/message-service.interface.js";
import { TOKENS } from "../di/tokens.js";
import { ValidationError } from "../errors/index.js";

@injectable()
export class MessageController {
  constructor(@inject(TOKENS.MessageService) private readonly messageService: MessageServiceInterface) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const { conversationId } = req.query;

    if (typeof conversationId !== "string") {
      throw new ValidationError("conversationId query parameter is required");
    }
    if (!isValidObjectId(conversationId)) {
      throw new ValidationError("conversationId must be a valid id");
    }

    const messages = await this.messageService.listMessages(conversationId);
    res.success(messages);
  };
}
