type Transformer<T> = (ctx: T) => Promise<void>;

export class Polestar<T> {
	transformers: Transformer<T>[] = [];

	public pipe(transformer: Transformer<T>) {
		this.transformers.push(transformer);

		return this;
	}

	public async run(ctx: T) {
		for (const transformer of this.transformers) {
			await transformer(ctx);
		}
	}
}
