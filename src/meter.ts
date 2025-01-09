import { Polestar } from "./core";

export interface PolestarMeterContext {
	customerId: string;
}

export class PolestarMeter<
	TContext extends PolestarMeterContext,
> extends Polestar<TContext> {
	public async meter({
		type,
		value,
		meter,
		customerId,
	}: {
		type: "increment" | "decrement" | "set";
		value: number;
		meter: string;
		customerId: string;
	}) {
		console.log("Meter event", {
			type,
			value,
			meter,
			customerId,
		});
	}

	public increment(meter: string, transformer: (ctx: TContext) => number) {
		return this.pipe(async (ctx) => {
			await this.meter({
				meter,
				type: "increment",
				value: transformer(ctx),
				customerId: ctx.customerId,
			});
		});
	}

	public decrement(meter: string, transformer: (ctx: TContext) => number) {
		return this.pipe(async (ctx) => {
			await this.meter({
				meter,
				type: "decrement",
				value: transformer(ctx),
				customerId: ctx.customerId,
			});
		});
	}

	public set(meter: string, transformer: (ctx: TContext) => number) {
		return this.pipe(async (ctx) => {
			await this.meter({
				meter,
				value: transformer(ctx),
				type: "set",
				customerId: ctx.customerId,
			});
		});
	}
}
