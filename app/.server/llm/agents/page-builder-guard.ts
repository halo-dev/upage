import type { PageBuilderAgentState } from './page-builder';

export function shouldBlockPrematureFinishRun(
  state: Pick<PageBuilderAgentState, 'effectiveMutationCount' | 'hasRejectedPageMutation'>,
  requiresMutation: boolean,
) {
  return state.effectiveMutationCount === 0 && (requiresMutation || state.hasRejectedPageMutation);
}
