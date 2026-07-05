import Anthropic from '@anthropic-ai/sdk';

/** The narrow slice of the Anthropic SDK the agent loop depends on. */
export interface AnthropicLike {
  messages: {
    create(body: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message>;
  };
}

/** Real client. Reads ANTHROPIC_API_KEY from the environment. */
export function createAnthropicClient(): AnthropicLike {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set — Vigilis needs an Anthropic API key to run the agent.\n' +
        '  1. Get a key: https://console.anthropic.com/settings/keys\n' +
        '  2. Set it:    export ANTHROPIC_API_KEY=sk-ant-...   (or add it to a .env file)\n' +
        '  Note: this is a pay-as-you-go API key, not a Claude.ai subscription.',
    );
  }
  return new Anthropic();
}
