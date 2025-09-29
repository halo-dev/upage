import { useStore } from '@nanostores/react';
import { type Change, diffLines } from 'diff';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createHighlighter } from 'shiki';
import '~/styles/diff-view.css';
import { themeStore } from '~/lib/stores/theme';
import { webBuilderStore } from '~/lib/stores/web-builder';
import { formatCode } from '~/utils/prettier';

// 高亮结果缓存，使用 Map 存储已高亮的代码行
const highlightCache = new Map<string, string>();
// 格式化结果缓存，使用 Map 存储已格式化的代码
const formatCache = new Map<string, string>();

// 差异计算结果缓存
const diffCache = new Map<string, ReturnType<typeof processChanges>>();

interface VirtualizedListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  itemHeight: number;
  className?: string;
  overscan?: number;
}

function VirtualizedList<T>({ items, renderItem, itemHeight, className = '', overscan = 20 }: VirtualizedListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 });
  const [renderedItems, setRenderedItems] = useState<React.ReactNode[]>([]);
  const [isRendering, setIsRendering] = useState(false);
  const totalHeight = items.length * itemHeight;

  const handleScroll = useCallback(() => {
    if (!containerRef.current) {
      return;
    }

    const { scrollTop, clientHeight } = containerRef.current;
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const end = Math.min(items.length, Math.ceil((scrollTop + clientHeight) / itemHeight) + overscan);

    setVisibleRange({ start, end });
  }, [items.length, itemHeight, overscan]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    container.addEventListener('scroll', handleScroll);
    handleScroll();

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll]);

  useEffect(() => {
    handleScroll();
  }, [items.length, handleScroll]);

  useEffect(() => {
    if (isRendering) {
      return;
    }

    setIsRendering(true);

    setTimeout(() => {
      const visibleItems = items.slice(visibleRange.start, visibleRange.end);
      const newRenderedItems = visibleItems.map((item, index) => {
        const actualIndex = visibleRange.start + index;
        return (
          <div
            key={actualIndex}
            style={{ position: 'absolute', top: actualIndex * itemHeight, height: itemHeight, width: '100%' }}
          >
            {renderItem(item, actualIndex)}
          </div>
        );
      });

      setRenderedItems(newRenderedItems);
      setIsRendering(false);
    }, 0);
  }, [items, visibleRange, itemHeight, renderItem, isRendering]);

  return (
    <div
      ref={containerRef}
      className={`virtualized-list ${className}`}
      style={{ position: 'relative', height: '100%', overflow: 'hidden' }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>{renderedItems}</div>
    </div>
  );
}

interface CodeComparisonProps {
  beforeCode?: string;
  afterCode: string;
  language: string;
  pageName: string;
  lightTheme: string;
  darkTheme: string;
}

interface DiffBlock {
  lineNumber: number;
  content: string;
  type: 'added' | 'removed' | 'unchanged';
  correspondingLine?: number;
  charChanges?: Array<{
    value: string;
    type: 'added' | 'removed' | 'unchanged';
  }>;
}

interface FullscreenButtonProps {
  onClick: () => void;
  isFullscreen: boolean;
}

const FullscreenButton = memo(({ onClick, isFullscreen }: FullscreenButtonProps) => (
  <button
    onClick={onClick}
    className="ml-4 p-1 rounded hover:bg-upage-elements-background-depth-3 text-upage-elements-textTertiary hover:text-upage-elements-textPrimary transition-colors dark:bg-gray-800"
    title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
  >
    <div className={isFullscreen ? 'i-ph:corners-in' : 'i-ph:corners-out'} />
  </button>
));

const FullscreenOverlay = memo(({ isFullscreen, children }: { isFullscreen: boolean; children: React.ReactNode }) => {
  if (!isFullscreen) {
    return <>{children}</>;
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-6">
      <div className="size-full max-w-[90vw] max-h-[90vh] bg-upage-elements-background-depth-2 rounded-lg border border-upage-elements-borderColor shadow-xl overflow-hidden">
        {children}
      </div>
    </div>
  );
});

const processChanges = (beforeCode?: string, afterCode?: string) => {
  try {
    const normalizeContent = (content: string): string[] => {
      return content
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map((line) => line.trimEnd());
    };

    if (!beforeCode || !afterCode) {
      return {
        beforeLines: [],
        afterLines: [],
        hasChanges: false,
        lineChanges: { before: new Set(), after: new Set() },
        unifiedBlocks: [],
      };
    }

    const beforeLines = normalizeContent(beforeCode);
    const afterLines = normalizeContent(afterCode);

    if (beforeLines.join('\n') === afterLines.join('\n')) {
      return {
        beforeLines,
        afterLines,
        hasChanges: false,
        lineChanges: { before: new Set(), after: new Set() },
        unifiedBlocks: [],
      };
    }

    const lineChanges = {
      before: new Set<number>(),
      after: new Set<number>(),
    };

    const unifiedBlocks: DiffBlock[] = [];

    let i = 0,
      j = 0;

    while (i < beforeLines.length || j < afterLines.length) {
      if (i < beforeLines.length && j < afterLines.length && beforeLines[i] === afterLines[j]) {
        unifiedBlocks.push({
          lineNumber: j,
          content: afterLines[j],
          type: 'unchanged',
          correspondingLine: i,
        });
        i++;
        j++;
      } else {
        let matchFound = false;
        const lookAhead = 3;

        for (let k = 1; k <= lookAhead && i + k < beforeLines.length && j + k < afterLines.length; k++) {
          if (beforeLines[i + k] === afterLines[j]) {
            for (let l = 0; l < k; l++) {
              lineChanges.before.add(i + l);
              unifiedBlocks.push({
                lineNumber: i + l,
                content: beforeLines[i + l],
                type: 'removed',
                correspondingLine: j,
                charChanges: [{ value: beforeLines[i + l], type: 'removed' }],
              });
            }
            i += k;
            matchFound = true;
            break;
          } else if (beforeLines[i] === afterLines[j + k]) {
            for (let l = 0; l < k; l++) {
              lineChanges.after.add(j + l);
              unifiedBlocks.push({
                lineNumber: j + l,
                content: afterLines[j + l],
                type: 'added',
                correspondingLine: i,
                charChanges: [{ value: afterLines[j + l], type: 'added' }],
              });
            }
            j += k;
            matchFound = true;
            break;
          }
        }

        if (!matchFound) {
          if (i < beforeLines.length && j < afterLines.length) {
            const beforeLine = beforeLines[i];
            const afterLine = afterLines[j];

            let prefixLength = 0;

            while (
              prefixLength < beforeLine.length &&
              prefixLength < afterLine.length &&
              beforeLine[prefixLength] === afterLine[prefixLength]
            ) {
              prefixLength++;
            }

            let suffixLength = 0;

            while (
              suffixLength < beforeLine.length - prefixLength &&
              suffixLength < afterLine.length - prefixLength &&
              beforeLine[beforeLine.length - 1 - suffixLength] === afterLine[afterLine.length - 1 - suffixLength]
            ) {
              suffixLength++;
            }

            const prefix = beforeLine.slice(0, prefixLength);
            const beforeMiddle = beforeLine.slice(prefixLength, beforeLine.length - suffixLength);
            const afterMiddle = afterLine.slice(prefixLength, afterLine.length - suffixLength);
            const suffix = beforeLine.slice(beforeLine.length - suffixLength);

            if (beforeMiddle || afterMiddle) {
              if (beforeMiddle) {
                lineChanges.before.add(i);
                unifiedBlocks.push({
                  lineNumber: i,
                  content: beforeLine,
                  type: 'removed',
                  correspondingLine: j,
                  charChanges: [
                    { value: prefix, type: 'unchanged' },
                    { value: beforeMiddle, type: 'removed' },
                    { value: suffix, type: 'unchanged' },
                  ],
                });
                i++;
              }

              if (afterMiddle) {
                lineChanges.after.add(j);
                unifiedBlocks.push({
                  lineNumber: j,
                  content: afterLine,
                  type: 'added',
                  correspondingLine: i - 1,
                  charChanges: [
                    { value: prefix, type: 'unchanged' },
                    { value: afterMiddle, type: 'added' },
                    { value: suffix, type: 'unchanged' },
                  ],
                });
                j++;
              }
            } else {
              if (i < beforeLines.length) {
                lineChanges.before.add(i);
                unifiedBlocks.push({
                  lineNumber: i,
                  content: beforeLines[i],
                  type: 'removed',
                  correspondingLine: j,
                  charChanges: [{ value: beforeLines[i], type: 'removed' }],
                });
                i++;
              }

              if (j < afterLines.length) {
                lineChanges.after.add(j);
                unifiedBlocks.push({
                  lineNumber: j,
                  content: afterLines[j],
                  type: 'added',
                  correspondingLine: i - 1,
                  charChanges: [{ value: afterLines[j], type: 'added' }],
                });
                j++;
              }
            }
          } else {
            // Handle remaining lines
            if (i < beforeLines.length) {
              lineChanges.before.add(i);
              unifiedBlocks.push({
                lineNumber: i,
                content: beforeLines[i],
                type: 'removed',
                correspondingLine: j,
                charChanges: [{ value: beforeLines[i], type: 'removed' }],
              });
              i++;
            }

            if (j < afterLines.length) {
              lineChanges.after.add(j);
              unifiedBlocks.push({
                lineNumber: j,
                content: afterLines[j],
                type: 'added',
                correspondingLine: i - 1,
                charChanges: [{ value: afterLines[j], type: 'added' }],
              });
              j++;
            }
          }
        }
      }
    }

    // Sort blocks by line number
    const processedBlocks = unifiedBlocks.sort((a, b) => a.lineNumber - b.lineNumber);

    return {
      beforeLines,
      afterLines,
      hasChanges: lineChanges.before.size > 0 || lineChanges.after.size > 0,
      lineChanges,
      unifiedBlocks: processedBlocks,
    };
  } catch (error) {
    console.error('Error processing changes:', error);
    return {
      beforeLines: [],
      afterLines: [],
      hasChanges: false,
      lineChanges: { before: new Set(), after: new Set() },
      unifiedBlocks: [],
      error: true,
    };
  }
};

const lineNumberStyles =
  'w-9 shrink-0 pl-2 py-1 text-left font-mono text-upage-elements-textTertiary border-r border-upage-elements-borderColor bg-upage-elements-background-depth-1';
const lineContentStyles =
  'px-1 py-1 font-mono whitespace-pre flex-1 group-hover:bg-upage-elements-background-depth-2 text-upage-elements-textPrimary';
const diffPanelStyles = 'h-full overflow-auto diff-panel-content';

// Updated color styles for better consistency
const diffLineStyles = {
  added: 'bg-green-500/10 dark:bg-green-500/20 border-l-4 border-green-500',
  removed: 'bg-red-500/10 dark:bg-red-500/20 border-l-4 border-red-500',
  unchanged: '',
};

const changeColorStyles = {
  added: 'text-green-700 dark:text-green-500 bg-green-500/10 dark:bg-green-500/20',
  removed: 'text-red-700 dark:text-red-500 bg-red-500/10 dark:bg-red-500/20',
  unchanged: 'text-upage-elements-textPrimary',
};

const renderContentWarning = () => (
  <div className="h-full flex items-center justify-center p-4">
    <div className="text-center text-upage-elements-textTertiary">
      <div className="i-ph:warning-circle text-4xl text-red-400 mb-2 mx-auto" />
      <p className="font-medium text-upage-elements-textPrimary">Error processing page</p>
      <p className="text-sm mt-1">Could not generate diff preview</p>
    </div>
  </div>
);

const NoChangesView = memo(
  ({
    beforeCode,
    language,
    highlighter,
    theme,
  }: {
    beforeCode?: string;
    language: string;
    highlighter: any;
    theme: string;
  }) => {
    const codeBlocks = useMemo(() => {
      if (!beforeCode) {
        return [];
      }
      return beforeCode.split('\n').map((line, index) => ({
        lineNumber: index,
        content: line,
        type: 'unchanged' as const,
        correspondingLine: index,
      }));
    }, [beforeCode]);

    const renderCodeLine = useCallback(
      (block: DiffBlock, index: number) => (
        <CodeLine
          key={`unchanged-${index}`}
          lineNumber={block.lineNumber}
          content={block.content}
          type={block.type}
          highlighter={highlighter}
          language={language}
          block={block}
          theme={theme}
        />
      ),
      [highlighter, language, theme],
    );

    return (
      <div className="h-full flex flex-col items-center justify-center p-4">
        <div className="text-center text-upage-elements-textTertiary">
          <div className="i-ph:files text-4xl text-green-400 mb-2 mx-auto" />
          <p className="font-medium text-upage-elements-textPrimary">页面内容相同</p>
          <p className="text-sm mt-1">两个版本完全相同</p>
        </div>
        <div className="mt-4 w-full max-w-2xl bg-upage-elements-background-depth-1 rounded-lg border border-upage-elements-borderColor overflow-hidden">
          <div className="p-2 text-xs font-bold text-upage-elements-textTertiary border-b border-upage-elements-borderColor">
            当前内容
          </div>
          <div className="overflow-auto max-h-96">
            {codeBlocks.length > 0 ? (
              <VirtualizedList
                items={codeBlocks}
                renderItem={renderCodeLine}
                itemHeight={24}
                className="overflow-x-auto"
                overscan={10}
              />
            ) : (
              <div className="p-4 text-center text-upage-elements-textTertiary">无内容</div>
            )}
          </div>
        </div>
      </div>
    );
  },
);

const useProcessChanges = (beforeCode?: string, afterCode?: string) => {
  return useMemo(() => {
    if (!beforeCode || !afterCode) {
      return processChanges(beforeCode, afterCode);
    }

    const cacheKey = `${beforeCode}:${afterCode}`;

    if (diffCache.has(cacheKey)) {
      return diffCache.get(cacheKey)!;
    }

    const result = processChanges(beforeCode, afterCode);
    diffCache.set(cacheKey, result);
    return result;
  }, [beforeCode, afterCode]);
};

const CodeLine = memo(
  ({
    lineNumber,
    content,
    type,
    highlighter,
    language,
    block,
    theme,
  }: {
    lineNumber: number;
    content: string;
    type: 'added' | 'removed' | 'unchanged';
    highlighter: any;
    language: string;
    block: DiffBlock;
    theme: string;
  }) => {
    const bgColor = diffLineStyles[type];
    const currentTheme = theme === 'dark' ? 'github-dark' : 'github-light';

    const [isHighlighted, setIsHighlighted] = useState(false);
    const [highlightedContent, setHighlightedContent] = useState<string | null>(null);

    useEffect(() => {
      if (!highlighter) {
        return;
      }

      const timeoutId = setTimeout(() => {
        if (type === 'unchanged' || !block.charChanges) {
          const cacheKey = `${content}:${language}:${currentTheme}`;

          if (highlightCache.has(cacheKey)) {
            setHighlightedContent(highlightCache.get(cacheKey)!);
            setIsHighlighted(true);
            return;
          }

          const highlighted = highlighter
            .codeToHtml(content, { lang: language, theme: currentTheme })
            .replace(/<\/?pre[^>]*>/g, '')
            .replace(/<\/?code[^>]*>/g, '');

          highlightCache.set(cacheKey, highlighted);
          setHighlightedContent(highlighted);
          setIsHighlighted(true);
        } else {
          const fragments: string[] = [];

          for (let i = 0; i < block.charChanges!.length; i++) {
            const change = block.charChanges![i];
            const changeClass = changeColorStyles[change.type];

            const cacheKey = `${change.value}:${language}:${currentTheme}:${change.type}`;

            let highlighted;
            if (highlightCache.has(cacheKey)) {
              highlighted = highlightCache.get(cacheKey);
            } else {
              highlighted = highlighter
                .codeToHtml(change.value, { lang: language, theme: currentTheme })
                .replace(/<\/?pre[^>]*>/g, '')
                .replace(/<\/?code[^>]*>/g, '');

              highlightCache.set(cacheKey, highlighted);
            }

            fragments.push(`<span class="${changeClass}">${highlighted}</span>`);
          }

          setHighlightedContent(fragments.join(''));
          setIsHighlighted(true);
        }
      }, 10);

      return () => {
        clearTimeout(timeoutId);
      };
    }, [content, language, currentTheme, highlighter, type, block.charChanges]);

    const renderContent = () => {
      if (isHighlighted && highlightedContent) {
        return <span dangerouslySetInnerHTML={{ __html: highlightedContent }} />;
      }

      if (type === 'unchanged' || !block.charChanges) {
        return <span>{content}</span>;
      }

      return (
        <>
          {block.charChanges.map((change, index) => {
            const changeClass = changeColorStyles[change.type];
            return (
              <span key={index} className={changeClass}>
                {change.value}
              </span>
            );
          })}
        </>
      );
    };

    return (
      <div className="flex group min-w-fit">
        <div className={lineNumberStyles}>{lineNumber + 1}</div>
        <div className={`${lineContentStyles} ${bgColor}`}>
          <span className="mr-2 text-upage-elements-textTertiary">
            {type === 'added' && <span className="text-green-700 dark:text-green-500">+</span>}
            {type === 'removed' && <span className="text-red-700 dark:text-red-500">-</span>}
            {type === 'unchanged' && ' '}
          </span>
          {renderContent()}
        </div>
      </div>
    );
  },
);

// 显示文件信息
const PageInfo = memo(
  ({
    pageName,
    hasChanges,
    onToggleFullscreen,
    isFullscreen,
    beforeCode,
    afterCode,
  }: {
    pageName: string;
    hasChanges: boolean;
    onToggleFullscreen: () => void;
    isFullscreen: boolean;
    beforeCode?: string;
    afterCode: string;
  }) => {
    const { additions, deletions } = useMemo(() => {
      if (!hasChanges) {
        return { additions: 0, deletions: 0 };
      }

      if (!beforeCode || !afterCode) {
        return { additions: 0, deletions: 0 };
      }

      const changes = diffLines(beforeCode, afterCode, {
        newlineIsToken: false,
        ignoreWhitespace: true,
      });

      return changes.reduce(
        (acc: { additions: number; deletions: number }, change: Change) => {
          if (change.added) {
            acc.additions += change.value.split('\n').length;
          }

          if (change.removed) {
            acc.deletions += change.value.split('\n').length;
          }

          return acc;
        },
        { additions: 0, deletions: 0 },
      );
    }, [hasChanges, beforeCode, afterCode]);

    const showStats = additions > 0 || deletions > 0;

    return (
      <div className="flex items-center bg-upage-elements-background-depth-1 p-2 text-sm text-upage-elements-textPrimary shrink-0">
        <div className="i-ph:file mr-2 size-4 shrink-0" />
        <span className="truncate">{pageName}</span>
        <span className="ml-auto shrink-0 flex items-center gap-2">
          {hasChanges ? (
            <>
              {showStats && (
                <div className="flex items-center gap-1 text-xs">
                  {additions > 0 && <span className="text-green-700 dark:text-green-500">+{additions}</span>}
                  {deletions > 0 && <span className="text-red-700 dark:text-red-500">-{deletions}</span>}
                </div>
              )}
              <span className="text-yellow-600 dark:text-yellow-400">已修改</span>
              <span className="text-upage-elements-textTertiary text-xs">{new Date().toLocaleTimeString()}</span>
            </>
          ) : (
            <span className="text-green-700 dark:text-green-400">无变化</span>
          )}
          <FullscreenButton onClick={onToggleFullscreen} isFullscreen={isFullscreen} />
        </span>
      </div>
    );
  },
);

const InlineDiffComparison = memo(({ beforeCode, afterCode, pageName, language }: CodeComparisonProps) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [highlighter, setHighlighter] = useState<any>(null);
  const [isHighlighterLoading, setIsHighlighterLoading] = useState(false);
  const theme = useStore(themeStore);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  const { unifiedBlocks, hasChanges, error } = useProcessChanges(beforeCode, afterCode);

  const loadHighlighter = useCallback(() => {
    if (!highlighter && !isHighlighterLoading && hasChanges) {
      setIsHighlighterLoading(true);
      createHighlighter({
        themes: ['github-dark', 'github-light'],
        langs: ['typescript', 'javascript', 'json', 'html', 'css', 'jsx', 'tsx', 'plaintext'],
      })
        .then(setHighlighter)
        .finally(() => {
          setIsHighlighterLoading(false);
        });
    }
  }, [highlighter, isHighlighterLoading, hasChanges]);

  useEffect(() => {
    if (hasChanges) {
      loadHighlighter();
    }
  }, [hasChanges, loadHighlighter]);

  const renderCodeLine = useCallback(
    (block: DiffBlock, index: number) => (
      <CodeLine
        key={`${block.lineNumber}-${index}`}
        lineNumber={block.lineNumber}
        content={block.content}
        type={block.type}
        highlighter={highlighter}
        language={language}
        block={block}
        theme={theme}
      />
    ),
    [highlighter, language, theme],
  );

  if (error) {
    return renderContentWarning();
  }

  return (
    <FullscreenOverlay isFullscreen={isFullscreen}>
      <div className="size-full flex flex-col">
        <PageInfo
          pageName={pageName}
          hasChanges={hasChanges}
          onToggleFullscreen={toggleFullscreen}
          isFullscreen={isFullscreen}
          beforeCode={beforeCode}
          afterCode={afterCode}
        />
        <div className={diffPanelStyles}>
          {hasChanges ? (
            <div className="overflow-x-auto min-w-full">
              <VirtualizedList
                items={unifiedBlocks}
                renderItem={renderCodeLine}
                itemHeight={24}
                className="overflow-x-auto"
                overscan={30}
              />
            </div>
          ) : (
            <NoChangesView beforeCode={beforeCode} language={language} highlighter={highlighter} theme={theme} />
          )}
        </div>
      </div>
    </FullscreenOverlay>
  );
});

export const DiffView = memo(() => {
  const pageHistory = useStore(webBuilderStore.pagesStore.pageHistory);
  const pages = useStore(webBuilderStore.pagesStore.pages);
  const selectedPage = useStore(webBuilderStore.pagesStore.activePage);
  const currentPage = useStore(webBuilderStore.pagesStore.currentPage);
  const currentView = useStore(webBuilderStore.currentView);
  const [formattedContent, setFormattedContent] = useState<string>('');
  const [effectiveOriginalContent, setEffectiveOriginalContent] = useState<string>('');
  const [shouldProcess, setShouldProcess] = useState(false);

  // 存当前页面内容的键，用于检测内容是否变化缓
  const contentCacheKey = useRef<string | null>(null);

  // 当视图切换到 diff 时，标记需要处理
  useEffect(() => {
    if (currentView === 'diff') {
      setShouldProcess(true);
    }
  }, [currentView]);

  useEffect(() => {
    if (!selectedPage || !currentPage || currentView !== 'diff' || !shouldProcess) {
      return;
    }

    const page = pages[selectedPage];
    const originalContent = page && 'content' in page ? page.content : '';

    const history = pageHistory[selectedPage];
    const originalContentToFormat = history?.originalContent || originalContent;

    if (currentPage?.content) {
      const currentContent = currentPage.content as string;

      if (formatCache.has(currentContent)) {
        setFormattedContent(formatCache.get(currentContent)!);

        contentCacheKey.current = currentContent;
      } else {
        formatCode(currentContent, { parser: 'html' })
          .then((formatted) => {
            formatCache.set(currentContent, formatted);
            setFormattedContent(formatted);

            contentCacheKey.current = currentContent;
          })
          .catch((error) => {
            console.error('格式化当前内容失败:', error);
            setFormattedContent(currentContent);
            contentCacheKey.current = currentContent;
          });
      }
    }

    if (originalContentToFormat) {
      if (formatCache.has(originalContentToFormat)) {
        setEffectiveOriginalContent(formatCache.get(originalContentToFormat)!);
      } else {
        formatCode(originalContentToFormat, { parser: 'html' })
          .then((formatted) => {
            formatCache.set(originalContentToFormat, formatted);
            setEffectiveOriginalContent(formatted);
          })
          .catch((error) => {
            console.error('格式化原始内容失败:', error);
            setEffectiveOriginalContent(originalContentToFormat);
          });
      }
    }

    setShouldProcess(false);
  }, [currentPage?.content, selectedPage, currentView, shouldProcess, pageHistory, pages]);

  if (!selectedPage || !currentPage) {
    return (
      <div className="flex size-full justify-center items-center bg-upage-elements-background-depth-1 text-upage-elements-textPrimary">
        选择一个页面来查看差异
      </div>
    );
  }

  try {
    return (
      <div className="h-full overflow-hidden">
        <InlineDiffComparison
          beforeCode={effectiveOriginalContent}
          afterCode={formattedContent}
          language={'html'}
          pageName={selectedPage}
          lightTheme="github-light"
          darkTheme="github-dark"
        />
      </div>
    );
  } catch (error) {
    console.error('DiffView render error:', error);
    return (
      <div className="flex size-full justify-center items-center bg-upage-elements-background-depth-1 text-red-400">
        <div className="text-center">
          <div className="i-ph:warning-circle text-4xl mb-2" />
          <p>渲染差异视图失败</p>
        </div>
      </div>
    );
  }
});
