import { ChatOpenRouter } from "@langchain/openrouter";

export type SupportedModelName =
  | "gemini-2.5-flash"
  | "gemini-2.0-flash"
  | "gpt-4o-mini"
  | "gpt-4.1-mini"
  | "gpt-3.5-turbo"
  | "anthropic/claude-sonnet-5"
  ;

export class ModelProvider {
  private static readonly cache = new Map<SupportedModelName, ChatOpenRouter>();

  static getModel(modelName: SupportedModelName): ChatOpenRouter {
    let model = ModelProvider.cache.get(modelName);
    if (!model) {
      model = new ChatOpenRouter({
        model: modelName,
        temperature: 0,
        maxTokens: 1024,
      });
      ModelProvider.cache.set(modelName, model);
    }
    return model;
  }
}
