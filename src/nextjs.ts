import { openai } from "@ai-sdk/openai";
import { Polar } from "@polar-sh/sdk";
import { Polestar } from "./polestar";
import { convertToCoreMessages, streamText } from "ai";
import { NextRequest } from "next/server";

interface UsageConfig {
	accessToken: string;
	getCustomerId: (req: NextRequest) => Promise<string>;
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
}

export const POST = Usage({ accessToken: '', getCustomerId: async (req) => '123' })
	.model(openai("gpt-4o"))
	.increment("gpt-4o-input", (ctx) => ctx.usage.promptTokens)
	.increment("gpt-4o-output", (ctx) => ctx.usage.completionTokens)
	.decrement('gpt-4o-included-calls', 1)
	.run(async (req, model) => /** Do your usual AI model stuff */);
