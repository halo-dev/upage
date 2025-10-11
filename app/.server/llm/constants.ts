// see https://docs.anthropic.com/en/docs/about-claude/models
export const MAX_TOKENS = process.env.MAX_TOKENS ? parseInt(process.env.MAX_TOKENS) : 8000;

// limits the number of model responses that can be returned in a single request
export const MAX_RESPONSE_SEGMENTS = process.env.MAX_RESPONSE_SEGMENTS
  ? parseInt(process.env.MAX_RESPONSE_SEGMENTS)
  : 5;
