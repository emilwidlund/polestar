import type {
	LanguageModelV1,
	LanguageModelV1CallOptions,
	LanguageModelV1StreamPart,
} from "@ai-sdk/provider";
import { PolestarMeter, type PolestarMeterContext } from "./meter";
import {
	experimental_wrapLanguageModel as wrapLanguageModel,
	type Experimental_LanguageModelV1Middleware as LanguageModelV1Middleware,
} from "ai";

type Handler<TRequest, TResponse> = (
	req: TRequest,
	res: TResponse,
) => Promise<TResponse>;

interface PolestarLLMContext extends PolestarMeterContext {
	usage: {
		promptTokens: number;
		completionTokens: number;
	};
}

export class PolestarLLMMeter<TRequest> {
	private model: LanguageModelV1;
	private meter: PolestarMeter<PolestarLLMContext>;
	private getCustomerId?: (req: TRequest) => Promise<string> | undefined;

	constructor(model: LanguageModelV1) {
		this.model = model;
		this.meter = new PolestarMeter<PolestarLLMContext>();
	}

	public customer(callback: (req: TRequest) => Promise<string>) {
		this.getCustomerId = callback;

		return this;
	}

	public increment(
		meter: string,
		transformer: (ctx: PolestarLLMContext) => number,
	) {
		this.meter.increment(meter, transformer);

		return this;
	}

	public handler<TResponse>(
		callback: (
			req: TRequest,
			res: TResponse,
			model: LanguageModelV1,
		) => Promise<TResponse>,
	): Handler<TRequest, TResponse> {
		return async (req: TRequest, res: TResponse) => {
			const model = wrapLanguageModel({
				model: this.model,
				middleware: await this.middleware(req),
			});

			return callback(req, res, model);
		};
	}

	private async middleware(req: TRequest): Promise<LanguageModelV1Middleware> {
		const meter = await this.createMeterHandler();

		return {
			wrapGenerate: this.wrapGenerate(meter, req),
			wrapStream: this.wrapStream(meter, req),
		};
	}

	private async createMeterHandler() {
		return async (context: PolestarLLMContext) => {
			await this.meter.run(context);
		};
	}

	private wrapGenerate(
		meter: (context: PolestarLLMContext) => Promise<void>,
		req: TRequest,
	) {
		return async (options: {
			doGenerate: () => ReturnType<LanguageModelV1["doGenerate"]>;
			params: LanguageModelV1CallOptions;
			model: LanguageModelV1;
		}): Promise<Awaited<ReturnType<LanguageModelV1["doGenerate"]>>> => {
			const result = await options.doGenerate();

			await meter({
				usage: result.usage,
				customerId: (await this.getCustomerId?.(req)) ?? "",
			});

			return result;
		};
	}

	private wrapStream(
		meter: (context: PolestarLLMContext) => Promise<void>,
		req: TRequest,
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
				transform: async (chunk, controller) => {
					if (chunk.type === "finish") {
						await meter({
							usage: chunk.usage,
							customerId: (await this.getCustomerId?.(req)) ?? "",
						});
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
