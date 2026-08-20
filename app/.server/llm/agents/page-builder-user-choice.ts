import { tool } from 'ai';
import { z } from 'zod';

export function createRequestUserChoiceTool(markEffectiveTool: (toolName: string) => void) {
  return tool({
    description:
      '当用户需要在多个有意义的方案中做决定时调用。适用于项目初始风格、布局方向、内容策略或后续存在明显取舍的决策。给出 2-5 个差异明确且适合当前任务的选项；不要用它询问琐碎细节，也不要重复询问用户已经明确回答的决定。调用后当前运行会暂停，等待用户选择或输入自定义方案。',
    inputSchema: z.object({
      question: z.string().trim().min(1).describe('用用户能直接理解的语言描述当前需要决定的问题。'),
      options: z
        .array(
          z.object({
            id: z.string().trim().min(1).describe('稳定且唯一的英文 kebab-case 选项标识。'),
            label: z.string().trim().min(1).describe('简短、可直接选择的方案名称。'),
            description: z.string().trim().min(1).optional().describe('一句话说明方案特征及主要取舍。'),
          }),
        )
        .min(2)
        .max(5)
        .describe('2-5 个有实质差异、互不重复的方案。'),
      mode: z.enum(['single', 'multiple']).default('single').describe('单选或多选；风格方向通常使用 single。'),
      allowCustomInput: z.boolean().default(true).describe('是否允许用户输入选项之外的自定义方案。'),
      customInputPlaceholder: z.string().trim().min(1).optional().describe('自定义输入框的简短提示。'),
    }),
    execute: async (_input, { toolCallId }) => {
      markEffectiveTool('requestUserChoice');
      return {
        acknowledged: true as const,
        awaitingUserResponse: true as const,
        choiceId: toolCallId,
      };
    },
  });
}
