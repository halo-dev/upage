import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { convertToModelMessages, type LanguageModel, type LanguageModelUsage, streamText } from 'ai';
import type { ModelCapabilities } from '~/.server/modules/llm/capabilities';
import { createScopedLogger } from '~/.server/utils/logger';
import {
  accumulateUsageSnapshot,
  createEmptyTokenUsage,
  estimateTextStreamAbortUsage,
  type TokenUsageSnapshot,
} from '~/.server/utils/token';
import type { ChatUIMessage } from '~/types/message';
import { createAbortError, isAbortError, throwIfAborted } from './abort';
import { consumeStreamTextFullStream, type StreamTextUIEvent } from './ui-message-stream';
import { createVisionAnalysisMessage, getUserMessageContent, hasUserImageParts } from './utils';

const logger = createScopedLogger('generate-design-md');

let _specCache: string | null = null;
const DESIGN_MD_SPEC_RELATIVE_PATH = 'app/.server/prompts/design-md-spec.md';
const DESIGN_MD_SPEC_CANDIDATES = [
  join(process.cwd(), DESIGN_MD_SPEC_RELATIVE_PATH),
  join(dirname(fileURLToPath(import.meta.url)), '../prompts/design-md-spec.md'),
];

function getDesignMdSpec(): string {
  if (_specCache) {
    return _specCache;
  }
  const specPath = DESIGN_MD_SPEC_CANDIDATES.find((candidate) => existsSync(candidate));
  if (!specPath) {
    throw new Error(`找不到 DESIGN.md 规范文件，已尝试路径：${DESIGN_MD_SPEC_CANDIDATES.join(', ')}`);
  }
  _specCache = readFileSync(specPath, 'utf-8');
  return _specCache;
}

export async function generateDesignMd({
  userMessage,
  visualSummary,
  templateReferenceAnalysis,
  modelCapabilities,
  model,
  abortSignal,
  onStreamEvent,
  onAbortUsage,
}: {
  userMessage: Omit<ChatUIMessage, 'id'>;
  visualSummary?: string;
  templateReferenceAnalysis?: string;
  modelCapabilities: ModelCapabilities;
  model: LanguageModel;
  abortSignal?: AbortSignal;
  onStreamEvent?: (event: StreamTextUIEvent) => void;
  onAbortUsage?: (usage: TokenUsageSnapshot) => void;
}): Promise<{
  content: string;
  totalUsage: LanguageModelUsage;
}> {
  throwIfAborted(abortSignal);
  logger.info('开始根据用户描述生成 DESIGN.md');

  const spec = getDesignMdSpec();
  const normalizedTemplateReferenceAnalysis = templateReferenceAnalysis?.trim();
  const hasTemplateReferenceAnalysis = Boolean(normalizedTemplateReferenceAnalysis);
  const system = `你是一名专业的 UI 设计系统专家，精通品牌设计、视觉语言和设计规范。
你需要根据用户的网站描述，生成一份完整、专业的 DESIGN.md 设计系统文档。

以下是 DESIGN.md 的官方格式规范，你必须严格遵循：

${spec}

生成要求：
1. YAML frontmatter 必须包含完整的 colors（至少包含 primary 颜色）、typography（至少 3 个层级：headline、body、label）、rounded、spacing
2. 颜色选择要体现网站的调性和用途，text 与 background 的对比度必须符合 WCAG AA 标准（≥4.5:1）
3. Typography 各层级必须给出具体的 fontFamily、fontSize、fontWeight、lineHeight
4. Markdown 正文各章节默认使用用户描述所用的语言；如果用户明确指定了输出语言，则按用户指定的语言描述设计意图，解释"为什么"而不只是"是什么"
5. Do's and Don'ts 章节给出 4-6 条具体可执行的守则
6. 只有当当前输入里实际包含可读取的图片视觉参考，或已明确提供视觉摘要时，才能把它们作为视觉事实依据；若用户文字中提到“上面的图片/参考图”等，但当前输入并无图片也无视觉摘要，不要臆测任何图片内容
7. 当存在图片或视觉摘要时，优先依据这些视觉事实完成风格判断；当不存在时，只能依据文字需求生成，并对未被确认的视觉细节保持克制、通用、不过度推断
8. 不要围绕“我是否看到了图片”做元解释，不要和用户争论是否上传了图片；只根据当前可用输入生成结果
9. 直接输出 DESIGN.md 文件内容，不要有任何额外前言，从 --- 开始
10. ${
    hasTemplateReferenceAnalysis
      ? '当前已提供模板参考分析，必须优先以该分析作为设计风格的主要来源，从中提取颜色、字体、间距、风格调性等信息；用户的文字说明仅作为方向补充；即使用户描述非常简短（如"创建一个类似的页面"），也应依据模板分析直接生成完整规范，不要报错或要求用户提供更多信息'
      : '当前未提供模板参考分析，必须忽略任何依赖模板分析的前提，不要因为缺少模板参考、参考网站、图片或视觉摘要而报错、拒答或要求用户补充；即使用户描述非常简短（如"创建一个类似的网站"），也要仅基于现有文字需求直接生成一份稳妥、完整、通用的设计系统规范'
  }`;
  const userMessageContent = getUserMessageContent(userMessage, {
    includeVisualHint: true,
    visualSummary,
  });
  const prompt = hasTemplateReferenceAnalysis
    ? `请基于以下模板参考分析，结合用户的补充说明，生成一份完整的 DESIGN.md 设计系统文档。

模板参考分析（主要设计依据）：
${normalizedTemplateReferenceAnalysis}

用户补充说明：
${userMessageContent}

直接输出符合规范的完整文件，从 YAML frontmatter 的 --- 开始。`
    : `根据以下网站描述，生成一份完整的 DESIGN.md 设计系统文档：

当前没有提供模板参考分析。不要把缺少模板参考分析、参考网站、图片或视觉摘要当作阻塞条件；如果用户描述较短，请基于现有文字需求直接生成一份稳妥、完整、通用的设计系统规范。

${userMessageContent}

直接输出符合规范的完整文件，从 YAML frontmatter 的 --- 开始。`;
  const completedUsage = createEmptyTokenUsage();
  let stepCompleted = false;
  let streamedText = '';

  const hasImageReference = hasUserImageParts(userMessage);
  const supportsOriginalImage = modelCapabilities.supportsVisionInput && hasImageReference;

  const result = supportsOriginalImage
    ? streamText({
        model,
        abortSignal,
        system,
        messages: await convertToModelMessages([
          createVisionAnalysisMessage(
            userMessage,
            '请基于当前输入中实际提供的图片视觉参考和文字需求，生成一份完整的 DESIGN.md 设计系统文档。从 YAML frontmatter 的 --- 开始直接输出完整文件，不要输出任何额外说明。',
          ),
        ]),
        onStepFinish: ({ usage }) => {
          stepCompleted = true;
          accumulateUsageSnapshot(completedUsage, usage);
        },
      })
    : streamText({
        model,
        abortSignal,
        system,
        prompt,
        onStepFinish: ({ usage }) => {
          stepCompleted = true;
          accumulateUsageSnapshot(completedUsage, usage);
        },
      });

  try {
    const content = await consumeStreamTextFullStream({
      fullStream: result.fullStream,
      abortSignal,
      onEvent: (event) => {
        streamedText = event.text;
        onStreamEvent?.(event);
      },
    });
    const totalUsage = await result.totalUsage;

    throwIfAborted(abortSignal);
    logger.info('DESIGN.md 生成完成');
    return {
      content,
      totalUsage,
    };
  } catch (error) {
    if (isAbortError(error, abortSignal)) {
      if (!stepCompleted) {
        const abortedUsage = estimateTextStreamAbortUsage({
          system,
          prompt,
          streamedText,
        });
        onAbortUsage?.(abortedUsage);
      } else {
        onAbortUsage?.(completedUsage);
      }
      logger.info('DESIGN.md 生成已中断');
      throw createAbortError();
    }

    throw error;
  }
}
