import { openai } from "@ai-sdk/openai";
import { Polar } from "@polar-sh/sdk";
import { Polestar } from "./polestar";
import { convertToCoreMessages, streamText } from "ai";

interface UsageConfig {
	accessToken: string;
	getCustomerId: () => Promise<string>;
	server?: "sandbox" | "production";
}

const Usage = ({ accessToken, getCustomerId, server }: UsageConfig) => {
	const polar = new Polar({
		accessToken,
		server,
	});

	return new Polestar(polar, {
		getCustomerId,
		billing: {
			type: "token",
			meters: {
				input: "input",
				output: "output",
			},
		},
	});
};

const config = { accessToken: "test", getCustomerId: async () => "123" };

export const POST = Usage(config)
	.model(openai("gpt-4o"))
	.increment("gpt-4o-input", (ctx) => ctx.usage.promptTokens)
	.increment("gpt-4o-output", (ctx) => ctx.usage.completionTokens)
	.run(async (req, model) => {
		const { messages } = await req.json();

		const result = await streamText({
			model: model,
			system: SYSTEM_PROMPT,
			messages: convertToCoreMessages(messages),
		});

		return result.toDataStreamResponse();
	});
