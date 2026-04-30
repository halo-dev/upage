import { tool } from 'ai';
import { z } from 'zod';
import type { UPagePagePart } from '~/types/message';

const nonEmptyString = z.string().trim().min(1);

const patchTargetSchema = z.object({
  domId: nonEmptyString.describe('目标节点的稳定 domId。'),
  selector: nonEmptyString.optional().describe('可选的补充选择器，仅在 domId 无法唯一定位时使用。'),
});

const patchOpSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('insert-node'),
    opId: nonEmptyString,
    reason: nonEmptyString.optional(),
    parentDomId: nonEmptyString.describe('插入目标的父节点 domId。'),
    html: nonEmptyString.describe('要插入的完整 HTML，必须只有一个根元素且根元素带 id。'),
    position: z.enum(['append', 'prepend', 'before', 'after']).optional(),
    relativeToDomId: nonEmptyString.optional(),
    sort: z.number().optional(),
  }),
  z.object({
    type: z.literal('replace-node'),
    opId: nonEmptyString,
    reason: nonEmptyString.optional(),
    target: patchTargetSchema,
    html: nonEmptyString.describe('用于替换目标节点的完整 HTML，根元素必须保留稳定 id。'),
  }),
  z.object({
    type: z.literal('remove-node'),
    opId: nonEmptyString,
    reason: nonEmptyString.optional(),
    target: patchTargetSchema,
  }),
  z.object({
    type: z.literal('remove-page'),
    opId: nonEmptyString,
    reason: nonEmptyString.optional(),
  }),
  z.object({
    type: z.literal('move-node'),
    opId: nonEmptyString,
    reason: nonEmptyString.optional(),
    target: patchTargetSchema,
    parentDomId: nonEmptyString.optional(),
    position: z.enum(['append', 'prepend']).optional(),
    sort: z.number().optional(),
  }),
  z.object({
    type: z.literal('set-attr'),
    opId: nonEmptyString,
    reason: nonEmptyString.optional(),
    target: patchTargetSchema,
    name: nonEmptyString,
    value: z.string(),
  }),
  z.object({
    type: z.literal('remove-attr'),
    opId: nonEmptyString,
    reason: nonEmptyString.optional(),
    target: patchTargetSchema,
    name: nonEmptyString,
  }),
  z.object({
    type: z.literal('set-text'),
    opId: nonEmptyString,
    reason: nonEmptyString.optional(),
    target: patchTargetSchema,
    text: z.string(),
  }),
]);

const actionSchema = z
  .object({
    id: nonEmptyString.describe('当前页面区块的唯一标识符，使用 kebab-case。'),
    action: z.enum(['add', 'update', 'remove']).describe('当前区块的操作类型。'),
    pageName: nonEmptyString.describe('当前区块所属页面名称。'),
    domId: nonEmptyString.describe('当前操作节点或父节点的 domId。更新或删除时必须是实际被修改节点自身的 domId。'),
    rootDomId: nonEmptyString.describe('当前区块根节点的 domId。删除操作时与 domId 相同；更新时必须与 domId 一致。'),
    sort: z.number().optional().describe('当前元素在同级中的排序位置。'),
    validRootDomId: z.boolean().optional().default(false).describe('根节点 domId 是否已经确认有效。'),
    contentKind: z
      .enum(['html', 'patch'])
      .optional()
      .default('html')
      .describe('当前 action 的载荷类型。html 为完整节点内容，patch 为原始 patch ops。'),
    content: z
      .string()
      .optional()
      .default('')
      .describe('当前区块的完整 HTML、style 或 script 内容。删除操作时传空字符串。'),
    patches: z.array(patchOpSchema).optional().describe('当 contentKind 为 patch 时使用的原始 patch ops。'),
  })
  .superRefine((action, ctx) => {
    if (action.contentKind === 'patch') {
      if (!Array.isArray(action.patches) || action.patches.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'patch action 必须提供至少一个 patch op。',
          path: ['patches'],
        });
        return;
      }

      const containsRemovePagePatch = action.patches.some((patch) => patch.type === 'remove-page');
      if (containsRemovePagePatch) {
        if (action.action !== 'remove') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'remove-page patch 只能用于 remove 操作。',
            path: ['action'],
          });
        }

        if (action.patches.length !== 1) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'remove-page patch 不能与其他 patch op 混用。',
            path: ['patches'],
          });
        }

        if (action.content.trim() !== '') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'remove-page patch 对应 action 的 content 必须为空字符串。',
            path: ['content'],
          });
        }

        if (action.rootDomId !== action.domId) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'remove-page patch 对应 action 的 rootDomId 必须与 domId 相同。',
            path: ['rootDomId'],
          });
        }

        return;
      }

      for (const [index, patch] of action.patches.entries()) {
        if (patch.type === 'insert-node' || patch.type === 'replace-node') {
          const rootElementId = extractRootElementId(patch.html);
          if (!rootElementId) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `${patch.type} 的 html 根节点必须带有稳定 id。`,
              path: ['patches', index, 'html'],
            });
          }
        }
      }

      return;
    }

    const rootElementId = extractRootElementId(action.content);

    if (action.action === 'remove') {
      if (action.content.trim() !== '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'remove 操作的 content 必须为空字符串。',
          path: ['content'],
        });
      }

      if (action.rootDomId !== action.domId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'remove 操作的 rootDomId 必须与 domId 相同。',
          path: ['rootDomId'],
        });
      }

      return;
    }

    if (action.action === 'update') {
      if (!rootElementId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'update 操作的 content 根节点必须带有稳定 id。',
          path: ['content'],
        });
        return;
      }

      if (action.domId !== rootElementId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'update 操作的 domId 必须与 content 根节点 id 一致。',
          path: ['domId'],
        });
      }

      if (action.rootDomId !== rootElementId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'update 操作的 rootDomId 必须与 content 根节点 id 一致。',
          path: ['rootDomId'],
        });
      }
    }

    if (action.action === 'add' && rootElementId && action.rootDomId !== rootElementId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'add 操作的 rootDomId 必须与 content 根节点 id 一致。',
        path: ['rootDomId'],
      });
    }
  });

const pageSchema = z.object({
  artifact: z.object({
    id: nonEmptyString.describe('页面唯一标识符，使用 kebab-case，并在后续迭代中保持稳定。'),
    name: nonEmptyString.describe('页面名称，例如 index、pricing、contact。首个页面必须是 index。'),
    title: nonEmptyString.describe('页面标题，使用对用户友好的页面名称。'),
  }),
  actions: z.array(actionSchema).max(3).describe('当前页面本批次的新增、更新或删除区块。单次最多提交 3 个区块。'),
  summary: nonEmptyString.optional().describe('当前页面改动的简短总结，语言默认跟随用户最新消息。'),
});

const legacySectionSchema = z.object({
  nodeId: nonEmptyString.describe('区块根节点 id。'),
  html: z.string().optional().default('').describe('HTML 内容。'),
  css: z.string().optional().default('').describe('CSS 内容。'),
  js: z.string().optional().default('').describe('JS 内容。'),
});

const legacyPageSchema = z.object({
  id: nonEmptyString.describe('页面唯一标识符。'),
  name: nonEmptyString.describe('页面名称。'),
  title: nonEmptyString.describe('页面标题。'),
  sections: z.array(legacySectionSchema).min(1).describe('页面区块列表。'),
});

export const upageInputSchema = z
  .object({
    pages: z
      .array(z.union([z.preprocess(normalizeStructuredPageInput, pageSchema), legacyPageSchema]))
      .min(1)
      .describe('本次需要提交的所有页面变更。'),
  })
  .transform(({ pages }) => ({
    pages: pages.map((page) => normalizePageInput(page)),
  }));

export function createUPageTool(onPage: (page: UPagePagePart) => void) {
  return tool({
    description:
      '当你需要创建、更新或删除页面内容时，必须调用此工具输出结构化页面数据。请使用小批次提交：每次只处理少量区块，优先单页提交，单页单次最多 3 个区块。使用 artifact/actions 组织页面与区块变更。优先用 contentKind=patch + patches 表达局部修改；只有新增大块结构或无法安全 patch 时才回退到 html。该工具输出是最终页面结果的唯一结构化真相，不要重复提交已经发过的 actionId。调用完成后，不要立即在当前工具步骤里重复总结；最终只在 finishRun 之后输出一次简短自然语言说明。面向普通用户描述结果，不要重复任何页面内部标识、工具参数或技术实现细节。',
    inputSchema: upageInputSchema,
    execute: async ({ pages }) => {
      const normalizedPages = pages.map((page) =>
        normalizePageInput(page as z.infer<typeof pageSchema> | z.infer<typeof legacyPageSchema>),
      );

      for (const page of normalizedPages) {
        onPage(page);
      }

      return {
        pages: normalizedPages,
        emittedPages: normalizedPages.map((page) => page.artifact.name),
        pageCount: normalizedPages.length,
      };
    },
  });
}

export function extractRootElementId(content: string): string | undefined {
  const match = content.match(/^\s*<[\w:-]+\b[^>]*\bid=(["'])([^"']+)\1/i);
  return match?.[2];
}

function normalizeStructuredPageInput(page: unknown) {
  if (
    !page ||
    typeof page !== 'object' ||
    !('artifact' in page) ||
    !('actions' in page) ||
    !Array.isArray(page.actions)
  ) {
    return page;
  }

  return {
    ...page,
    actions: page.actions.map(normalizeStructuredActionInput),
  };
}

function normalizeStructuredActionInput(action: unknown) {
  if (!action || typeof action !== 'object' || !('patches' in action) || !Array.isArray(action.patches)) {
    return action;
  }

  return {
    ...action,
    patches: action.patches.map(normalizePatchInput),
  };
}

function normalizePatchInput(patch: unknown) {
  return patch;
}

function normalizePageInput(page: z.infer<typeof pageSchema> | z.infer<typeof legacyPageSchema>): UPagePagePart {
  if ('artifact' in page) {
    return {
      ...page,
      actions: page.actions.map((action) => ({
        ...action,
        contentKind: action.contentKind === 'patch' ? 'patch' : 'html',
        content: typeof action.content === 'string' ? action.content : '',
      })),
    };
  }

  return {
    artifact: {
      id: page.id,
      name: page.name,
      title: page.title,
    },
    actions: page.sections.flatMap((section, index) => {
      const normalizedActions = [];

      if (section.html.trim()) {
        normalizedActions.push({
          id: section.nodeId,
          action: 'add' as const,
          pageName: page.name,
          contentKind: 'html' as const,
          content: section.html,
          domId: 'main',
          rootDomId: section.nodeId,
          sort: index,
          validRootDomId: true,
        });
      }

      if (section.css.trim()) {
        normalizedActions.push({
          id: `${section.nodeId}-style`,
          action: 'add' as const,
          pageName: page.name,
          contentKind: 'html' as const,
          content: `<style id="${section.nodeId}-style">${section.css}</style>`,
          domId: 'main',
          rootDomId: `${section.nodeId}-style`,
          sort: index,
          validRootDomId: true,
        });
      }

      if (section.js.trim()) {
        normalizedActions.push({
          id: `${section.nodeId}-script`,
          action: 'add' as const,
          pageName: page.name,
          contentKind: 'html' as const,
          content: `<script id="${section.nodeId}-script">${section.js}</script>`,
          domId: 'main',
          rootDomId: `${section.nodeId}-script`,
          sort: index,
          validRootDomId: true,
        });
      }

      return normalizedActions;
    }),
  };
}
