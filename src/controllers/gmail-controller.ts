import type { Request, Response } from "express";
import { inject, injectable } from "tsyringe";
import type { GmailOAuthServiceInterface } from "../services/interfaces/gmail-oauth-service.interface.js";
import { TOKENS } from "../di/tokens.js";
import { requireUserId } from "./require-user-id.js";
import type { GmailCallbackQueryDto } from "../dtos/gmail.dto.js";

@injectable()
export class GmailController {
  constructor(
    @inject(TOKENS.GmailOAuthService) private readonly gmailOAuthService: GmailOAuthServiceInterface,
    @inject(TOKENS.FrontendUrl) private readonly frontendUrl: string
  ) {}

  connect = async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    const authUrl = this.gmailOAuthService.getAuthUrl(userId);
    res.success({ authUrl });
  };

  // Hit by the user's browser via Google's redirect — not by our own frontend's axios
  // client — so this responds with an HTTP redirect back to the SPA, not the usual
  // { success, data } JSON envelope.
  callback = async (req: Request, res: Response): Promise<void> => {
    const { code, state } = req.query as unknown as GmailCallbackQueryDto;

    try {
      await this.gmailOAuthService.handleCallback(code, state);
      res.redirect(`${this.frontendUrl}/knowledge-base?gmail=connected`);
    } catch {
      res.redirect(`${this.frontendUrl}/knowledge-base?gmail=error`);
    }
  };

  status = async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    const status = await this.gmailOAuthService.getConnectionStatus(userId);
    res.success(status);
  };

  disconnect = async (req: Request, res: Response): Promise<void> => {
    const userId = requireUserId(req);
    await this.gmailOAuthService.disconnect(userId);
    res.success({ disconnected: true });
  };
}
