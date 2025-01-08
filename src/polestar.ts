import { LanguageModelV1StreamPart } from "@ai-sdk/provider";
import { Polar } from "@polar-sh/sdk";
import { NextRequest, NextResponse } from "next/server";
import { Experimental_LanguageModelV1Middleware as LanguageModelV1Middleware } from 'ai';

type Item = {
    id: string;
    name: string;
    value: number;
  };
  
  type Context = {
    request: NextRequest;
  };
  
  type Transformer = (ctx: Context) => number;
  
  type NextHandler = (req: NextRequest, res: NextResponse) => Promise<NextResponse>;
  
  interface PolestarConfig {
    getCustomerId: (req: NextRequest) => Promise<string>;
    billing: {
        type?: 'token';
        meters: {
            input?: string;
            output?: string;
        };
    }
  }
  
 export class Polestar {
    client: Polar;
    config: PolestarConfig;
    transformers: Transformer[] = [];
  
    constructor(client: Polar, config: PolestarConfig) {
      this.client = client;
      this.config = config;
    }
  
    public increment(itemName: string, transformer: Transformer): this {
      return this;
    }
  
    public decrement(itemName: string, transformer: Transformer): this {
      return this;
    }
  
    public handler(): NextHandler {
      return async (req: NextRequest, res: NextResponse) => {
        for (const transformer of this.transformers) {
          const result = transformer({ request: req });
        }
        return NextResponse.json({ message: "Hello world" });
      };
    }

    private bill = async ({
        promptTokens,
        completionTokens,
      }: {
        promptTokens: number;
        completionTokens: number;
      }) => {
        if (this.config.billing) {
          if (this.config.billing.meters.input) {
  
            await this.client.meterEvents.create({
              event: this.config.billing.meters.input,
              customerId: await this.config.getCustomerId(),
              value: promptTokens.toString(),
            });
          }
          if (this.config.billing.meters.output) {
            await this.client.meterEvents.create({
              event: this.config.billing.meters.output,
              customerId: await this.config.getCustomerId(),
              value: completionTokens.toString(),
            });
          }
        }
      };

    private middleware(): LanguageModelV1Middleware {
        return {
          wrapGenerate: async ({ doGenerate }) => {
            const result = await doGenerate();
    
            if (this.config.billing) {
              await this.bill(result.usage);
            }
    
            return result;
          },
          wrapStream: async ({ doStream }) => {
            const {stream, ...rest} = await doStream();
    
            const transformStream = new TransformStream<
              LanguageModelV1StreamPart,
              LanguageModelV1StreamPart
            >({
              async transform(chunk, controller) {
                if (chunk.type === 'finish') {
                  if (this.config.billing) {
                    await this.bill(chunk.usage);
                  }
                }
    
                controller.enqueue(chunk);
              },
            });
    
            return {
              stream: stream.pipeThrough(transformStream),
              ...rest,
            };
          },
        };
      }    
  }