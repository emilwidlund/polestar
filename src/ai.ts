import { openai } from '@ai-sdk/openai';
import { LanguageModelV1, LanguageModelV1StreamPart } from '@ai-sdk/provider';
import { Experimental_LanguageModelV1Middleware as LanguageModelV1Middleware } from 'ai';

interface LLMConfig {
    model: LanguageModelV1
}

const LLM = (config: LLMConfig) => {
    config.model.doStream({
        
    })
}

type StripeMiddlewareConfig = {
    billing?: {
      type?: 'token';
      customer: string;
      meters: {
        input?: string;
        output?: string;
      };
    };
  };









export async function POST(req: Request) {
    const { messages } = await req.json();
  
    // Wrap the language model and include the
    // billing middleware.
    const model = LLM({
      model: openai('gpt-4o'),
      middleware: stripeAgentToolkit.middleware({
        billing: {
          customer: process.env.STRIPE_CUSTOMER_ID!,
          meters: {
            input: process.env.STRIPE_METER_INPUT!,
            output: process.env.STRIPE_METER_OUTPUT!,
          },
        },
      }),
    });
  
    // Call the model and stream back the results.
    const result = await streamText({
      model: model,
      system: SYSTEM_PROMPT,
      messages: convertToCoreMessages(messages),
    });
  
    return result.toDataStreamResponse();
  }