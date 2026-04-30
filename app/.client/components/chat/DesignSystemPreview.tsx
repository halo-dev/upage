import classNames from 'classnames';
import { useEffect, useMemo, useRef, useState } from 'react';
import { parseDesignSystem } from '~/.client/utils/design-system';
import { RunningStatus } from './RunningStatus';

export function DesignSystemPreview({ content, isStreaming = false }: { content: string; isStreaming?: boolean }) {
  const designSystem = useMemo(() => parseDesignSystem(content), [content]);
  const [isExpanded, setIsExpanded] = useState(isStreaming);
  const contentRef = useRef<HTMLDivElement>(null);
  const colorTokens = Object.entries(designSystem.colors);
  const typographyTokens = Object.entries(designSystem.typography);
  const roundedTokens = Object.entries(designSystem.rounded);
  const spacingTokens = Object.entries(designSystem.spacing);
  const componentTokens = Object.entries(designSystem.components);
  const rawBody = useMemo(() => stripFrontmatter(content), [content]);
  const hasRawBody = rawBody.length > 0;
  const parsedTokenCount =
    colorTokens.length + typographyTokens.length + roundedTokens.length + spacingTokens.length + componentTokens.length;
  const hasMeaningfulPreview = parsedTokenCount > 0 || Boolean(designSystem.overview) || hasRawBody;
  const expanded = isStreaming || isExpanded;
  const streamingDetail = useMemo(
    () =>
      getStreamingDetail({
        content,
        hasMeaningfulPreview,
        parsedTokenCount,
        parsedTokenGroups: buildParsedTokenGroups({
          colorCount: colorTokens.length,
          typographyCount: typographyTokens.length,
          roundedCount: roundedTokens.length,
          spacingCount: spacingTokens.length,
          componentCount: componentTokens.length,
        }),
      }),
    [
      colorTokens.length,
      componentTokens.length,
      content,
      hasMeaningfulPreview,
      parsedTokenCount,
      roundedTokens.length,
      spacingTokens.length,
      typographyTokens.length,
    ],
  );
  const readyDetail = useMemo(() => {
    const parsedTokenGroups = buildParsedTokenGroups({
      colorCount: colorTokens.length,
      typographyCount: typographyTokens.length,
      roundedCount: roundedTokens.length,
      spacingCount: spacingTokens.length,
      componentCount: componentTokens.length,
    });

    return parsedTokenGroups.length > 0 ? `已解析 ${parsedTokenGroups.join('、')}` : '点击展开查看设计系统细节';
  }, [colorTokens.length, componentTokens.length, roundedTokens.length, spacingTokens.length, typographyTokens.length]);

  useEffect(() => {
    if (isStreaming) {
      setIsExpanded(true);
      return;
    }

    setIsExpanded(false);
  }, [isStreaming]);

  useEffect(() => {
    if (!expanded || !contentRef.current) {
      return;
    }

    contentRef.current.scrollTop = contentRef.current.scrollHeight;
  }, [content, expanded]);

  return (
    <section className="overflow-hidden rounded-lg border border-upage-elements-borderColor/55 bg-upage-elements-background/78">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => {
          if (isStreaming) {
            return;
          }

          setIsExpanded((value) => !value);
        }}
        className="flex w-full items-start justify-between gap-3 px-3.5 py-3 text-left transition-colors hover:bg-upage-elements-background-depth-2/30"
      >
        <div className="min-w-0">
          <div className="text-[11px] font-medium text-upage-elements-textSecondary tracking-wide">设计系统</div>
          <h3 className="mt-1 text-[14px] font-semibold text-upage-elements-textPrimary break-words">
            {designSystem.name}
          </h3>
          {designSystem.description ? (
            <p className="mt-1 text-[12px] leading-[1.45] text-upage-elements-textSecondary">
              {designSystem.description}
            </p>
          ) : null}
          <p className="mt-1 text-[11px] leading-[1.45] text-upage-elements-textSecondary">
            {isStreaming ? streamingDetail : expanded ? '点击收起' : readyDetail}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isStreaming ? (
            <div className="rounded-full bg-upage-elements-background px-2 py-0.75 text-[10px] text-upage-elements-textSecondary">
              <div className="inline-flex items-center gap-1.5">
                <RunningStatus label="设计系统生成中" iconClassName="text-sm" />
                <span>设计系统生成中</span>
              </div>
            </div>
          ) : (
            <div className="rounded-full bg-upage-elements-background px-2 py-0.75 text-[10px] text-upage-elements-textSecondary">
              已准备好
            </div>
          )}
          <div
            className={classNames(
              'i-ph:caret-down shrink-0 text-sm text-upage-elements-textSecondary transition-transform',
              expanded && 'rotate-180',
            )}
          />
        </div>
      </button>

      <div
        className={classNames(
          'border-t border-upage-elements-borderColor/60 bg-upage-elements-background-depth-1/20',
          !expanded && 'hidden',
        )}
      >
        <div ref={contentRef} className="max-h-[34rem] overflow-y-auto p-4 flex flex-col gap-4">
          {designSystem.overview ? (
            <div className="border-l-2 border-upage-elements-borderColor/70 pl-3">
              <div className="text-[11px] font-medium text-upage-elements-textSecondary tracking-wide">风格概览</div>
              <p className="mt-2 text-[13px] leading-6 text-upage-elements-textPrimary whitespace-pre-wrap">
                {designSystem.overview}
              </p>
            </div>
          ) : null}

          {colorTokens.length > 0 ? (
            <div>
              <div className="text-[13px] font-medium text-upage-elements-textPrimary">颜色</div>
              <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                {colorTokens.map(([name, value]) => (
                  <div
                    key={name}
                    className="rounded-lg border border-upage-elements-borderColor/60 bg-upage-elements-background-depth-2/35 p-2.5"
                  >
                    <div
                      className="h-14 rounded-md border border-upage-elements-borderColor/60"
                      style={{ backgroundColor: value }}
                    />
                    <div className="mt-2 text-[13px] font-medium text-upage-elements-textPrimary">{name}</div>
                    <div className="mt-0.5 text-[11px] text-upage-elements-textSecondary">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {typographyTokens.length > 0 ? (
            <div>
              <div className="text-[13px] font-medium text-upage-elements-textPrimary">字体层级</div>
              <div className="mt-2.5 grid gap-2.5">
                {typographyTokens.map(([name, token]) => (
                  <div
                    key={name}
                    className="rounded-lg border border-upage-elements-borderColor/60 bg-upage-elements-background-depth-2/35 p-3"
                  >
                    <div
                      className="break-words text-upage-elements-textPrimary"
                      style={{
                        fontFamily: token.fontFamily,
                        fontSize: token.fontSize,
                        fontWeight: token.fontWeight,
                        lineHeight: token.lineHeight,
                        letterSpacing: token.letterSpacing,
                      }}
                    >
                      {name} Aa 字体示例
                    </div>
                    <div className="mt-2.5 flex flex-wrap gap-1.5 text-[11px] text-upage-elements-textSecondary">
                      {Object.entries(token).map(([key, value]) => (
                        <span key={key} className="rounded-full bg-upage-elements-background px-2 py-1">
                          {key}: {value}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {(roundedTokens.length > 0 || spacingTokens.length > 0) && (
            <div className="grid gap-3 lg:grid-cols-2">
              {roundedTokens.length > 0 ? (
                <div className="rounded-lg border border-upage-elements-borderColor/60 bg-upage-elements-background-depth-2/35 p-3">
                  <div className="text-[13px] font-medium text-upage-elements-textPrimary">圆角</div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {roundedTokens.map(([name, value]) => (
                      <div
                        key={name}
                        className="rounded-full bg-upage-elements-background px-2.5 py-1 text-[11px] text-upage-elements-textSecondary"
                      >
                        {name}: {value}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {spacingTokens.length > 0 ? (
                <div className="rounded-lg border border-upage-elements-borderColor/60 bg-upage-elements-background-depth-2/35 p-3">
                  <div className="text-[13px] font-medium text-upage-elements-textPrimary">间距</div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {spacingTokens.map(([name, value]) => (
                      <div
                        key={name}
                        className="rounded-full bg-upage-elements-background px-2.5 py-1 text-[11px] text-upage-elements-textSecondary"
                      >
                        {name}: {value}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {componentTokens.length > 0 ? (
            <div>
              <div className="text-[13px] font-medium text-upage-elements-textPrimary">组件规则</div>
              <div className="mt-2.5 grid gap-2.5 lg:grid-cols-2">
                {componentTokens.map(([name, token]) => (
                  <div
                    key={name}
                    className="rounded-lg border border-upage-elements-borderColor/60 bg-upage-elements-background-depth-2/35 p-3"
                  >
                    <div className="text-[13px] font-medium text-upage-elements-textPrimary break-words">{name}</div>
                    <div className="mt-2.5 flex flex-wrap gap-1.5 text-[11px] text-upage-elements-textSecondary">
                      {Object.entries(token).map(([key, value]) => (
                        <span key={key} className="rounded-full bg-upage-elements-background px-2 py-1">
                          {key}: {value}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {!designSystem.overview && parsedTokenCount === 0 && hasRawBody ? (
            <div className="rounded-lg border border-upage-elements-borderColor/60 bg-upage-elements-background-depth-2/20 p-3">
              <div className="text-[13px] font-medium text-upage-elements-textPrimary">设计说明</div>
              <p className="mt-2 whitespace-pre-wrap break-words text-[13px] leading-6 text-upage-elements-textPrimary">
                {rawBody}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function getStreamingDetail({
  content,
  hasMeaningfulPreview,
  parsedTokenCount,
  parsedTokenGroups,
}: {
  content: string;
  hasMeaningfulPreview: boolean;
  parsedTokenCount: number;
  parsedTokenGroups: string[];
}) {
  const hasClosedFrontmatter = /^---\n[\s\S]*?\n---\n?/m.test(content);

  if (!hasClosedFrontmatter) {
    return parsedTokenGroups.length > 0
      ? `正在继续解析设计 token，当前已识别 ${parsedTokenGroups.join('、')}`
      : '正在逐步解析 DESIGN.md 的设计 token...';
  }

  if (!hasMeaningfulPreview) {
    return '正在补充设计系统说明...';
  }

  if (parsedTokenCount > 0) {
    return `预览已可用，当前已识别 ${parsedTokenGroups.join('、')}`;
  }

  return '预览已可用，仍在继续生成剩余规范内容...';
}

function buildParsedTokenGroups({
  colorCount,
  typographyCount,
  roundedCount,
  spacingCount,
  componentCount,
}: {
  colorCount: number;
  typographyCount: number;
  roundedCount: number;
  spacingCount: number;
  componentCount: number;
}) {
  return [
    colorCount > 0 ? `${colorCount} 个颜色` : '',
    typographyCount > 0 ? `${typographyCount} 个字体层级` : '',
    roundedCount > 0 ? `${roundedCount} 组圆角` : '',
    spacingCount > 0 ? `${spacingCount} 组间距` : '',
    componentCount > 0 ? `${componentCount} 组组件规则` : '',
  ].filter(Boolean);
}

function stripFrontmatter(content: string) {
  if (!content.startsWith('---\n')) {
    return content.trim();
  }

  const rest = content.slice(4);
  const closingIndex = rest.search(/\n---\n?/);

  if (closingIndex === -1) {
    return '';
  }

  const closingMatch = rest.slice(closingIndex).match(/^\n---\n?/);
  const bodyStartIndex = closingIndex + (closingMatch?.[0].length ?? 0);
  return rest.slice(bodyStartIndex).trim();
}
