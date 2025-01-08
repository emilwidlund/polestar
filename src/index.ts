import { Polar } from "@polar-sh/sdk";
import { Polestar } from "./polestar";
import { NextRequest } from "next/server";

interface UsageConfig {
	accessToken: string;
	getCustomerId: (req: NextRequest) => Promise<string>;
	server?: "sandbox" | "production";
}

export const Usage = ({ accessToken, getCustomerId, server }: UsageConfig) => {
	const client = new Polar({
		accessToken,
		server,
	});

	return new Polestar(client, {
		getCustomerId: async (req: NextRequest) => {
			return await getCustomerId(req);
		},
		billing: {
			meters: {
				input: "input",
				output: "output",
			},
		},
	});
};

export const POST = Usage({
	accessToken: "",
	getCustomerId: async (req: NextRequest) =>
		req.headers.get("x-polar-customer-id") ?? "",
})
	.increment("test", (ctx) => 1)
	.handler();
