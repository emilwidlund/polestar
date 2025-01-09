import { expect, test, vi } from "vitest";
import { Polestar } from "./core";

test("Polestar", async () => {
	const polestar = new Polestar();

	const incrementUsage = vi.fn();
	const decrementUsage = vi.fn();
	const setUsage = vi.fn();
	const logEvent = vi.fn();

	await polestar
		.pipe(incrementUsage)
		.pipe(decrementUsage)
		.pipe(setUsage)
		.pipe(logEvent)
		.run({ usage: { promptTokens: 100, completionTokens: 100 } });

	const expectedUsage = { usage: { promptTokens: 100, completionTokens: 100 } };

	expect(incrementUsage).toHaveBeenCalledWith(expectedUsage);
	expect(decrementUsage).toHaveBeenCalledWith(expectedUsage);
	expect(setUsage).toHaveBeenCalledWith(expectedUsage);
	expect(logEvent).toHaveBeenCalledWith(expectedUsage);
});
