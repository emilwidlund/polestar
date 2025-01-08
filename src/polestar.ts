import {
	LanguageModelV1,
	LanguageModelV1CallOptions,
	LanguageModelV1StreamPart,
} from "@ai-sdk/provider";
import { Polar } from "@polar-sh/sdk";
import { NextRequest, NextResponse } from "next/server";
import {
	Experimental_LanguageModelV1Middleware as LanguageModelV1Middleware,
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
		const meter = new PolestarMeter(this.client, {
			type: "token",
			customer: "test",
			meters: {
				input: "input",
				output: "output",
			},
		});

		return wrapLanguageModel({
			model,
			middleware: meter.middleware(),
		});
	}
}

interface PolestarMeterConfig {
	type: "token";
	customer: string;
	meters: {
		input?: string;
		output?: string;
	};
}

class PolestarMeter {
	private client: Polar;
	private config: PolestarMeterConfig;

	constructor(client: Polar, config: PolestarMeterConfig) {
		this.client = client;
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
				customerId: await this.config.getCustomerId(),
				value: promptTokens.toString(),
			});
		}

		if (this.config.meters.output) {
			await this.client.meterEvents.create({
				event: this.config.meters.output,
				customerId: await this.config.getCustomerId(),
				value: completionTokens.toString(),
			});
		}
	};

	public handler(): NextHandler {
		return async (req: NextRequest, res: NextResponse) => {
			const { messages } = await req.json();

			for (const transformer of this.transformers) {
				const result = transformer({ request: req });
			}
			return NextResponse.json({ message: "Hello world" });
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
