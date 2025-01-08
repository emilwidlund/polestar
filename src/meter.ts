import { Polestar } from "./core";

interface PolestarMeterConfig {
	meter: string;
}

export class PolestarMeter<T> extends Polestar<T> {
	config: PolestarMeterConfig;

	constructor(config: PolestarMeterConfig) {
		super();

		this.config = config;
	}

	private async meter({
		type,
		value,
	}: {
		type: "increment" | "decrement" | "set";
		value: number;
	}) {
		console.log("Meter event", {
			type,
			value,
		});
		// Meter event
	}

	public increment(transformer: (ctx: T) => number) {
		return this.pipe(async (ctx) => {
			await this.meter({
				type: "increment",
				value: transformer(ctx),
			});
		});
	}

	public decrement(transformer: (ctx: T) => number) {
		return this.pipe(async (ctx) => {
			await this.meter({
				type: "decrement",
				value: transformer(ctx),
			});
		});
	}

	public set(transformer: (ctx: T) => number) {
		return this.pipe(async (ctx) => {
			await this.meter({
				value: transformer(ctx),
				type: "set",
			});
		});
	}
}
