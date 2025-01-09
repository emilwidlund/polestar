import { expect, describe, it, vi } from "vitest";
import { Polestar } from "./core";
import { filter } from "rxjs";
import { createMocks } from "node-mocks-http";

describe("Polestar", () => {
	it("should run callback", async () => {
		const polestar = new Polestar();

		const callback = vi.fn();

		const handler = polestar
			.pipe(filter(([req, res]) => req.url === ""))
			.handler(callback);

		const { req, res } = createMocks({
			method: "GET",
		});

		handler(req, res);

		expect(callback).toHaveBeenCalled();
	});
});
