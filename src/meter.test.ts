import { expect, test, vi } from "vitest";
import { PolestarMeter } from "./meter";
import { Polar } from "@polar-sh/sdk";

test("Polestar", async () => {
	const polestar = new PolestarMeter<{
		usage: { promptTokens: number; completionTokens: number };
	}>({ meter: "test" });

	const incrementUsage = vi.fn(() => 1);
	const decrementUsage = vi.fn(() => 1);
	const setUsage = vi.fn(() => 100);
	const logEvent = vi.fn();

	await polestar
		.increment("input", incrementUsage)
		.decrement("output", decrementUsage)
		.set("input", setUsage)
		.pipe(logEvent)
		.run({ usage: { promptTokens: 100, completionTokens: 100 } });

	const expectedUsage = { usage: { promptTokens: 100, completionTokens: 100 } };

	expect(incrementUsage).toHaveBeenCalledWith(expectedUsage);
	expect(decrementUsage).toHaveBeenCalledWith(expectedUsage);
	expect(setUsage).toHaveBeenCalledWith(expectedUsage);
	expect(logEvent).toHaveBeenCalledWith(expectedUsage);
});
