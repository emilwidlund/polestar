import { Polar } from "@polar-sh/sdk";
import { Polestar } from "./polestar";

interface UsageConfig {
  accessToken: string;
  getCustomerId: Promise<string>;
  server?: "sandbox" | "production";
}

export const Usage = ({ accessToken, getCustomerId, server }: UsageConfig) => {
  const client = new Polar({
    accessToken,
    server,
  });

  return new Polestar(client, {
    getCustomerId,
  });
};

export const POST = Usage({
  accessToken: '',
  getCustomerId: Promise.resolve("123"),
}).increment("test", ctx => 1).handler();



