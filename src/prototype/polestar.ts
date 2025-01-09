import type {
	LanguageModelV1,
	LanguageModelV1CallOptions,
	LanguageModelV1StreamPart,
} from "@ai-sdk/provider";
import type { Polar } from "@polar-sh/sdk";
import type { NextRequest, NextResponse } from "next/server";
import {
	type Experimental_LanguageModelV1Middleware as LanguageModelV1Middleware,
	experimental_wrapLanguageModel as wrapLanguageModel,
} from "ai";

type Context = {
	usage: {
		promptTokens: number;
		completionTokens: number;
	};
};

type Transformer = (ctx: Context) => number;

type NextHandler = (
	req: NextRequest,
	res: NextResponse,
) => Promise<NextResponse>;

interface PolestarConfig {
	getCustomerId: (req: NextRequest) => Promise<string>;
	billing: {
		type?: "token";
		meters: {
			input?: string;
			output?: string;
		};
	};
}

export class Polestar {
	client: Polar;
	config: PolestarConfig;
	transformers: Transformer[] = [];

	constructor(client: Polar, config: PolestarConfig) {
		this.client = client;
		this.config = config;
	}

	public model(model: LanguageModelV1) {
		const meter = new PolestarMeter(this.client, model, {
			type: "token",
			getCustomerId: this.config.getCustomerId,
			meters: {
				input: "input",
				output: "output",
			},
		});

		return meter;
	}
}

interface PolestarMeterConfig {
	type: "token";
	getCustomerId: (req: NextRequest) => Promise<string>;
	meters: {
		input?: string;
		output?: string;
	};
}

class PolestarMeter {
	private client: Polar;
	private model: LanguageModelV1;
	private config: PolestarMeterConfig;

	constructor(
		client: Polar,
		model: LanguageModelV1,
		config: PolestarMeterConfig,
	) {
		this.client = client;
		this.model = model;
		this.config = config;
	}

	public increment(itemName: string, transformer: Transformer) {
		return this;
	}

	public decrement(itemName: string, transformer: Transformer) {
		return this;
	}

	private async createBillingHandler(req: NextRequest) {
		const customerId = await this.config.getCustomerId(req);

		return async ({
			promptTokens,
			completionTokens,
		}: {
			promptTokens: number;
			completionTokens: number;
		}) => {
			if (this.config.meters.input) {
				await this.client.meterEvents.create({
					event: this.config.meters.input,
					customerId,
					value: promptTokens.toString(),
				});
			}

			if (this.config.meters.output) {
				await this.client.meterEvents.create({
					event: this.config.meters.output,
					customerId,
					value: completionTokens.toString(),
				});
			}
		};
	}

	public run(
		callback: (
			req: NextRequest,
			model: LanguageModelV1,
		) => Promise<NextResponse>,
	): NextHandler {
		return async (req: NextRequest, res: NextResponse) => {
			const model = wrapLanguageModel({
				model: this.model,
				middleware: await this.middleware(req),
			});

			return callback(req, model);
		};
	}

	public async middleware(
		req: NextRequest,
	): Promise<LanguageModelV1Middleware> {
		const bill = await this.createBillingHandler(req);

		return {
			wrapGenerate: this.wrapGenerate(bill),
			wrapStream: this.wrapStream(bill),
		};
	}

	private wrapGenerate(
		bill: (usage: {
			promptTokens: number;
			completionTokens: number;
		}) => Promise<void>,
	) {
		return async (options: {
			doGenerate: () => ReturnType<LanguageModelV1["doGenerate"]>;
			params: LanguageModelV1CallOptions;
			model: LanguageModelV1;
		}): Promise<Awaited<ReturnType<LanguageModelV1["doGenerate"]>>> => {
			const result = await options.doGenerate();

			await bill(result.usage);

			return result;
		};
	}

	private wrapStream(
		bill: (usage: {
			promptTokens: number;
			completionTokens: number;
		}) => Promise<void>,
	) {
		return async ({
			doStream,
			params,
			model,
		}: {
			doStream: () => ReturnType<LanguageModelV1["doStream"]>;
			params: LanguageModelV1CallOptions;
			model: LanguageModelV1;
		}) => {
			const { stream, ...rest } = await doStream();

			const transformStream = new TransformStream<
				LanguageModelV1StreamPart,
				LanguageModelV1StreamPart
			>({
				async transform(chunk, controller) {
					if (chunk.type === "finish") {
						if (this.config.billing) {
							await bill(chunk.usage);
						}
					}

					controller.enqueue(chunk);
				},
			});

			return {
				stream: stream.pipeThrough(transformStream),
				...rest,
			};
		};
	}
}
