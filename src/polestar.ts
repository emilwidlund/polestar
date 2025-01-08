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

type Item = {
	id: string;
	name: string;
	value: number;
};

type Context =
	| LanguageModelV1StreamPart
	| ReturnType<LanguageModelV1["doGenerate"]>;

type Transformer = (ctx: Context) => number;

type NextHandler = (
	req: NextRequest,
	res: NextResponse,
) => Promise<NextResponse>;

interface PolestarConfig {
	customerId: string;
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
			customerId: this.config.customerId,
			meters: {
				input: "input",
				output: "output",
			},
		});
	}
}

interface PolestarMeterConfig {
	type: "token";
	customerId: string;
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

	public async increment(
		itemName: string,
		transformer: Transformer,
	): Promise<this> {
		return this;
	}

	public async decrement(
		itemName: string,
		transformer: Transformer,
	): Promise<this> {
		return this;
	}

	private bill = async ({
		promptTokens,
		completionTokens,
	}: {
		promptTokens: number;
		completionTokens: number;
	}) => {
		if (this.config.meters.input) {
			await this.client.meterEvents.create({
				event: this.config.meters.input,
				customerId: this.config.customerId,
				value: promptTokens.toString(),
			});
		}

		if (this.config.meters.output) {
			await this.client.meterEvents.create({
				event: this.config.meters.output,
				customerId: this.config.customerId,
				value: completionTokens.toString(),
			});
		}
	};

	public run(
		callback: (
			req: NextRequest,
			model: LanguageModelV1,
		) => Promise<NextResponse>,
	): NextHandler {
		return async (req: NextRequest, res: NextResponse) => {
			const model = wrapLanguageModel({
				model: this.model,
				middleware: this.middleware(),
			});

			return callback(req, model);
		};
	}

	public middleware(): LanguageModelV1Middleware {
		return {
			wrapGenerate: this.wrapGenerate,
			wrapStream: this.wrapStream,
		};
	}

	private async wrapGenerate(options: {
		doGenerate: () => ReturnType<LanguageModelV1["doGenerate"]>;
		params: LanguageModelV1CallOptions;
		model: LanguageModelV1;
	}): Promise<Awaited<ReturnType<LanguageModelV1["doGenerate"]>>> {
		const result = await options.doGenerate();

		await this.bill(result.usage);

		return result;
	}

	private async wrapStream({
		doStream,
		params,
		model,
	}: {
		doStream: () => ReturnType<LanguageModelV1["doStream"]>;
		params: LanguageModelV1CallOptions;
		model: LanguageModelV1;
	}): Promise<Awaited<ReturnType<LanguageModelV1["doStream"]>>> {
		const { stream, ...rest } = await doStream();

		const transformStream = new TransformStream<
			LanguageModelV1StreamPart,
			LanguageModelV1StreamPart
		>({
			async transform(chunk, controller) {
				if (chunk.type === "finish") {
					if (this.config.billing) {
						await this.bill(chunk.usage);
					}
				}

				controller.enqueue(chunk);
			},
		});

		return {
			stream: stream.pipeThrough(transformStream),
			...rest,
		};
	}
}
