import { NextRequest, NextResponse } from "next/server";
import { of, type OperatorFunction, first } from "rxjs";

export class Polestar {
	private operators: OperatorFunction<
		[NextRequest, NextResponse],
		[NextRequest, NextResponse]
	>[] = [];

	pipe(
		...operators: OperatorFunction<
			[NextRequest, NextResponse],
			[NextRequest, NextResponse]
		>[]
	): this {
		this.operators.push(...operators);
		return this;
	}

	handler(callback: (req: NextRequest, res: NextResponse) => NextResponse) {
		return (req: NextRequest, res: NextResponse): void => {
			of([req, res] as const)
				.pipe(first())
				.pipe(...this.operators)
				.subscribe({
					next: ([request, response]) => callback(request, response),
				});
		};
	}
}
