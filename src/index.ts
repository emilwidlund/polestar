import { openai } from "@ai-sdk/openai";
import { Usage } from "./usage";

export const POST = LLMMeter()
	.customerId((req) => "123")
	.model(openai("gpt-4"))
	.increment("gpt-4-input", "input", (ctx) => ctx.usage.promptTokens)
	.increment("gpt-4-output", "output", (ctx) => ctx.usage.completionTokens)
	.decrement("gpt-4-calls", 1)
	.handler(async (req, model) => {
		// Do your usual AI model stuff
	});
