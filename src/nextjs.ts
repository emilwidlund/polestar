import { LanguageModelV1 } from "@ai-sdk/provider";
import { PolestarLLMMeter } from "./llm";

export const LLMUsage = <TRequest>(model: LanguageModelV1) => {
	return new PolestarLLMMeter<TRequest>(model);
};
