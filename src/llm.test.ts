import { expect, test, vi, describe, beforeEach } from "vitest";
import { PolestarLLMMeter, type PolestarLLMMeterConfig } from "./llm";
import { createMocks } from "node-mocks-http";
import { streamText } from "ai";
import { convertToCoreMessages } from "ai";
import { NextRequest, NextResponse } from "next/server";

describe("PolestarMeter", () => {
	let meter: PolestarLLMMeter<NextRequest>;
	let mockOpenAIClient: any;

	beforeEach(() => {
		// Mock the openai client
		mockOpenAIClient = vi.fn(() => ({
			doGenerate: vi.fn().mockResolvedValue({
				usage: { promptTokens: 10, completionTokens: 20 },
				toDataStreamResponse: vi.fn().mockResolvedValue({
					text: vi.fn().mockResolvedValue("The weather in Tokyo is sunny."),
				}),
			}),
			doStream: vi.fn().mockResolvedValue({
				stream: new ReadableStream(),
				usage: { promptTokens: 10, completionTokens: 20 },
			}),
		}));

		meter = new PolestarLLMMeter<NextRequest>(mockOpenAIClient("gpt-4o"));
	});

	test("should return a valid nextjs handler", async () => {
		const { req, res } = createMocks({
			method: "GET",
		});

		const incrementInput = vi.fn(() => 1);
		const incrementOutput = vi.fn(() => 1);

		const handler = meter
			.increment("gpt-4-input", "input", incrementInput)
			.increment("gpt-4-output", "output", incrementOutput)
			.handler<NextResponse>(async (req, res, model) => {
				const result = await streamText({
					model: model,
					system: "You are a helpful assistant",
					messages: convertToCoreMessages([
						{ role: "user", content: "What is the weather in Tokyo?" },
					]),
				});

				return result.toDataStreamResponse() as NextResponse;
			});

		const response = await handler(req, res);
		await response.text();

		expect(incrementInput).toHaveBeenCalled();
		expect(incrementOutput).toHaveBeenCalled();
	});
});
