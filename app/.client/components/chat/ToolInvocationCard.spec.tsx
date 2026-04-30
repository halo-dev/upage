import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ToolInvocationCard } from './ToolInvocationCard';

describe('ToolInvocationCard', () => {
  it('should render summaries for the new preparation tools', () => {
    render(
      <div>
        <ToolInvocationCard
          part={{
            type: 'tool-historySummary',
            toolCallId: 'tool-history-summary-1',
            state: 'output-available',
            input: {},
            output: {
              hasHistory: true,
              summary: '用户希望更新首页文案。',
              reused: false,
              durationMs: 320,
            },
          }}
        />
        <ToolInvocationCard
          part={{
            type: 'tool-selectRelevantPages',
            toolCallId: 'tool-select-pages-1',
            state: 'output-available',
            input: {},
            output: {
              hasPages: true,
              selectedPages: ['index', 'pricing'],
              candidatePages: ['index', 'pricing'],
              reused: false,
              usedFallback: false,
            },
          }}
        />
        <ToolInvocationCard
          part={{
            type: 'tool-buildPageOutlineSnapshot',
            toolCallId: 'tool-page-outline-1',
            state: 'output-available',
            input: {},
            output: {
              hasPages: true,
              selectedPages: ['index'],
              pageSummaryOutline: '首页包含首屏和特性介绍。',
              reused: false,
              usedFallback: true,
            },
          }}
        />
        <ToolInvocationCard
          part={{
            type: 'tool-buildPageDetailedSnapshot',
            toolCallId: 'tool-page-detailed-1',
            state: 'output-available',
            input: {},
            output: {
              hasPages: true,
              selectedPages: ['index'],
              pageSummaryDetailed: '按钮位于首页首屏区域。',
              reused: false,
              usedFallback: false,
            },
          }}
        />
      </div>,
    );

    expect(screen.getByText('生成历史摘要')).toBeTruthy();
    expect(screen.getByText((content) => content.includes('历史摘要已生成'))).toBeTruthy();
    expect(screen.getByText('筛选相关页面')).toBeTruthy();
    expect(screen.getByText((content) => content.includes('相关页面：index、pricing'))).toBeTruthy();
    expect(screen.getByText('构建页面概览')).toBeTruthy();
    expect(screen.getByText((content) => content.includes('页面结构概览已生成'))).toBeTruthy();
    expect(screen.getByText((content) => content.includes('页面概览使用了默认候选页面'))).toBeTruthy();
    expect(screen.getByText('精确定位页面')).toBeTruthy();
    expect(screen.getByText((content) => content.includes('页面精定位结果已生成'))).toBeTruthy();
  });

  it('should render finish run summary', () => {
    render(
      <ToolInvocationCard
        part={{
          type: 'tool-finishRun',
          toolCallId: 'tool-finish-run-1',
          state: 'output-available',
          input: {
            reason: '页面变更已完成',
            requiresMutation: true,
          },
          output: {
            acknowledged: true,
            reason: '页面变更已完成',
            requiresMutation: true,
            effectiveMutationCount: 2,
            invalidStepCount: 1,
          },
        }}
      />,
    );

    expect(screen.getByText('结束运行')).toBeTruthy();
    expect(screen.getByText((content) => content.includes('页面变更数：2'))).toBeTruthy();
    expect(screen.getByText((content) => content.includes('无效步骤：1'))).toBeTruthy();
    expect(screen.getByText((content) => content.includes('页面变更已完成'))).toBeTruthy();
  });

  it('should render a friendly upage validation error', () => {
    render(
      <ToolInvocationCard
        part={{
          type: 'tool-upage',
          toolCallId: 'tool-upage-error-1',
          state: 'output-error',
          input: {
            pages: [],
          },
          errorText:
            'Invalid input for tool upage: Type validation failed: Value: {"pages":[{"artifact":{"id":"index","name":"index","title":"首页"},"actions":[{"patches":[{"type":"set-attr"}]}]}]}. Error message: [{"path":["actions",0,"patches",0,"name"]},{"path":["actions",0,"patches",0,"value"]}]',
        }}
      />,
    );

    expect(screen.getByText('应用页面变更')).toBeTruthy();
    expect(screen.getByText('页面变更校验失败：删除节点时请使用 remove-node，不要用 set-attr。')).toBeTruthy();
  });
});
