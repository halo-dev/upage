export type ModelCapabilityConfidence = 'declared' | 'mapped' | 'probed' | 'unknown';

export type ModelCapabilities = {
  supportsVisionInput: boolean;
  supportsFileReference: boolean;
  supportsImageUrl: boolean;
  supportsBase64Image: boolean;
  capabilityConfidence: ModelCapabilityConfidence;
};

export const UNKNOWN_MODEL_CAPABILITIES: ModelCapabilities = {
  supportsVisionInput: false,
  supportsFileReference: false,
  supportsImageUrl: false,
  supportsBase64Image: false,
  capabilityConfidence: 'unknown',
};

export function createVisionCapabilities(
  confidence: ModelCapabilityConfidence,
  options?: Partial<ModelCapabilities>,
): ModelCapabilities {
  return {
    supportsVisionInput: true,
    supportsFileReference: false,
    supportsImageUrl: true,
    supportsBase64Image: true,
    capabilityConfidence: confidence,
    ...options,
  };
}

export function mergeModelCapabilities(
  capabilities: Partial<ModelCapabilities> | null | undefined,
  fallback: ModelCapabilities = UNKNOWN_MODEL_CAPABILITIES,
): ModelCapabilities {
  return {
    ...fallback,
    ...capabilities,
  };
}

export function getModelCapabilities(
  provider: {
    resolveModelCapabilities?: (model: string) => ModelCapabilities | Partial<ModelCapabilities> | null | undefined;
  },
  model: string,
): ModelCapabilities {
  return mergeModelCapabilities(provider.resolveModelCapabilities?.(model));
}

export function modelSupportsVision(
  provider: {
    resolveModelCapabilities?: (model: string) => ModelCapabilities | Partial<ModelCapabilities> | null | undefined;
  },
  model: string,
) {
  return getModelCapabilities(provider, model).supportsVisionInput;
}
