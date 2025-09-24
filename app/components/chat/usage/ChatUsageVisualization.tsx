import { useStore } from '@nanostores/react';
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js';
import classNames from 'classnames';
import { useMemo } from 'react';
import { Doughnut, Line, Pie } from 'react-chartjs-2';
import type { ChatUsageStats } from '~/lib/hooks/useChatUsage';
import { themeStore } from '~/lib/stores/theme';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement);

type ChatUsageVisualizationProps = {
  usageStats: ChatUsageStats;
};

export function ChatUsageVisualization({ usageStats }: ChatUsageVisualizationProps) {
  const theme = useStore(themeStore);

  const isDarkMode = useMemo(() => theme === 'dark', [theme]);

  const getThemeColor = (varName: string): string => {
    if (typeof document !== 'undefined') {
      return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    }
    return isDarkMode ? '#FFFFFF' : '#000000';
  };

  const chartColors = {
    grid: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
    text: getThemeColor('--upage-elements-textPrimary'),
    textSecondary: getThemeColor('--upage-elements-textSecondary'),
    background: getThemeColor('--upage-elements-bg-depth-1'),
    accent: getThemeColor('--upage-elements-button-primary-text'),
    border: getThemeColor('--upage-elements-borderColor'),
    success: isDarkMode ? 'rgba(34, 197, 94, 0.7)' : 'rgba(34, 197, 94, 0.6)', // 绿色
    successBorder: isDarkMode ? 'rgba(34, 197, 94, 0.9)' : 'rgba(34, 197, 94, 0.8)',
    failed: isDarkMode ? 'rgba(239, 68, 68, 0.7)' : 'rgba(239, 68, 68, 0.6)', // 红色
    failedBorder: isDarkMode ? 'rgba(239, 68, 68, 0.9)' : 'rgba(239, 68, 68, 0.8)',
    pending: isDarkMode ? 'rgba(234, 179, 8, 0.7)' : 'rgba(234, 179, 8, 0.6)', // 黄色
    pendingBorder: isDarkMode ? 'rgba(234, 179, 8, 0.9)' : 'rgba(234, 179, 8, 0.8)',
    aborted: isDarkMode ? 'rgba(107, 114, 128, 0.7)' : 'rgba(107, 114, 128, 0.6)', // 灰色
    abortedBorder: isDarkMode ? 'rgba(107, 114, 128, 0.9)' : 'rgba(107, 114, 128, 0.8)',
  };

  const getChartColors = (index: number) => {
    const baseColors = [
      {
        base: getThemeColor('--upage-elements-button-primary-text'),
      },
      {
        base: isDarkMode ? 'rgb(244, 114, 182)' : 'rgb(236, 72, 153)',
      },
      {
        base: getThemeColor('--upage-elements-icon-success'),
      },
      {
        base: isDarkMode ? 'rgb(250, 204, 21)' : 'rgb(234, 179, 8)',
      },
      {
        base: isDarkMode ? 'rgb(56, 189, 248)' : 'rgb(14, 165, 233)',
      },
    ];

    const color = baseColors[index % baseColors.length].base;

    let r = 0,
      g = 0,
      b = 0;

    const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    const rgbaMatch = color.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([0-9.]+)\)/);

    if (rgbMatch) {
      [, r, g, b] = rgbMatch.map(Number);
    } else if (rgbaMatch) {
      [, r, g, b] = rgbaMatch.map(Number);
    } else if (color.startsWith('#')) {
      const hex = color.slice(1);
      const bigint = parseInt(hex, 16);
      r = (bigint >> 16) & 255;
      g = (bigint >> 8) & 255;
      b = bigint & 255;
    }

    return {
      bg: `rgba(${r}, ${g}, ${b}, ${isDarkMode ? 0.7 : 0.5})`,
      border: `rgba(${r}, ${g}, ${b}, ${isDarkMode ? 0.9 : 0.8})`,
    };
  };

  const formatStatus = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return '成功';
      case 'FAILED':
        return '失败';
      case 'PENDING':
        return '处理中';
      case 'ABORTED':
        return '中止';
      default:
        return status;
    }
  };

  const getStatusColor = (status: string, isBackground = true) => {
    switch (status) {
      case 'SUCCESS':
        return isBackground ? chartColors.success : chartColors.successBorder;
      case 'FAILED':
        return isBackground ? chartColors.failed : chartColors.failedBorder;
      case 'PENDING':
        return isBackground ? chartColors.pending : chartColors.pendingBorder;
      case 'ABORTED':
        return isBackground ? chartColors.aborted : chartColors.abortedBorder;
      default:
        return isBackground ? getChartColors(0).bg : getChartColors(0).border;
    }
  };

  const statusDistributionData = {
    labels: usageStats.byStatus.map((status) => formatStatus(status.status)),
    datasets: [
      {
        label: '请求状态',
        data: usageStats.byStatus.map((status) => status._count),
        backgroundColor: usageStats.byStatus.map((status) => getStatusColor(status.status)),
        borderColor: usageStats.byStatus.map((status) => getStatusColor(status.status, false)),
        borderWidth: 1,
      },
    ],
  };

  const tokenUsageData = {
    labels: ['输入 Token', '输出 Token', '缓存 Token'],
    datasets: [
      {
        label: 'Token 使用量',
        data: [
          usageStats.total._sum.inputTokens || 0,
          usageStats.total._sum.outputTokens || 0,
          usageStats.total._sum.cachedTokens || 0,
        ],
        backgroundColor: [getChartColors(1).bg, getChartColors(2).bg, getChartColors(4).bg],
        borderColor: [getChartColors(1).border, getChartColors(2).border, getChartColors(4).border],
        borderWidth: 1,
      },
    ],
  };

  const dailyRequestsData = {
    labels: usageStats.byDate.map((day) => day.date),
    datasets: [
      {
        label: '每日请求数',
        data: usageStats.byDate.map((day) => day.count),
        borderColor: getChartColors(4).border,
        backgroundColor: 'transparent',
        borderWidth: 2,
        tension: 0.4, // 添加曲线平滑
        pointBackgroundColor: getChartColors(4).border,
        pointBorderColor: chartColors.background,
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        fill: false,
      },
      {
        label: '每日 Token 用量',
        data: usageStats.byDate.map((day) => day.totalTokens),
        borderColor: getChartColors(2).border,
        backgroundColor: 'transparent',
        borderWidth: 2,
        tension: 0.4,
        pointBackgroundColor: getChartColors(2).border,
        pointBorderColor: chartColors.background,
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        fill: false,
      },
    ],
  };

  const baseChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    color: chartColors.text,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: chartColors.text,
          font: {
            weight: 'bold' as const,
            size: 12,
          },
          padding: 16,
          usePointStyle: true,
        },
      },
      title: {
        display: true,
        color: chartColors.text,
        font: {
          size: 16,
          weight: 'bold' as const,
        },
        padding: 16,
      },
      tooltip: {
        titleColor: chartColors.text,
        bodyColor: chartColors.text,
        backgroundColor: isDarkMode ? 'rgba(23, 23, 23, 0.8)' : 'rgba(255, 255, 255, 0.8)',
        borderColor: chartColors.border,
        borderWidth: 1,
      },
    },
  };

  const statusPieOptions = {
    ...baseChartOptions,
    plugins: {
      ...baseChartOptions.plugins,
      title: {
        ...baseChartOptions.plugins.title,
        text: '请求状态分布',
      },
      legend: {
        ...baseChartOptions.plugins.legend,
        position: 'right' as const,
      },
    },
  };

  const doughnutOptions = {
    ...baseChartOptions,
    plugins: {
      ...baseChartOptions.plugins,
      title: {
        ...baseChartOptions.plugins.title,
        text: 'Token 使用分布',
      },
      legend: {
        ...baseChartOptions.plugins.legend,
        position: 'right' as const,
      },
    },
  };

  const lineChartOptions = {
    ...baseChartOptions,
    plugins: {
      ...baseChartOptions.plugins,
      title: {
        ...baseChartOptions.plugins.title,
        text: '每日请求统计',
      },
      legend: {
        ...baseChartOptions.plugins.legend,
        onClick: function (_e: any, legendItem: any, legend: any) {
          const index = legendItem.datasetIndex;
          const ci = legend.chart;

          const datasets = ci.data.datasets;
          const visibleCount = datasets.reduce((count: number, _dataset: any, i: number) => {
            return count + (ci.getDatasetMeta(i).hidden ? 0 : 1);
          }, 0);

          const meta = ci.getDatasetMeta(index);
          const isCurrentlyVisible = !meta.hidden;

          if (isCurrentlyVisible && visibleCount === 1) {
            meta.hidden = true;

            datasets.forEach((_dataset: any, i: number) => {
              if (i !== index) {
                ci.getDatasetMeta(i).hidden = false;
              }
            });
          } else if (visibleCount === 0) {
            datasets.forEach((_dataset: any, i: number) => {
              ci.getDatasetMeta(i).hidden = i !== index;
            });
          } else {
            meta.hidden = !meta.hidden;
          }

          ci.update();
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: chartColors.grid,
          drawBorder: false,
        },
        border: {
          display: false,
        },
        ticks: {
          color: chartColors.text,
          font: {
            weight: 500,
          },
          maxRotation: 45,
          minRotation: 45,
        },
      },
      y: {
        grid: {
          color: chartColors.grid,
          drawBorder: false,
        },
        border: {
          display: false,
        },
        ticks: {
          color: chartColors.text,
          font: {
            weight: 500,
          },
        },
        beginAtZero: true,
      },
    },
  };

  const cardClasses = classNames(
    'p-6 rounded-lg shadow-sm',
    'bg-upage-elements-bg-depth-1',
    'border border-upage-elements-borderColor',
  );

  return (
    <div className="space-y-8">
      <div className={cardClasses}>
        <h3 className="text-base font-medium text-upage-elements-textPrimary mb-3">每日请求统计</h3>
        <div className="h-64">
          <Line data={dailyRequestsData} options={lineChartOptions} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className={cardClasses}>
          <h3 className="text-base font-medium text-upage-elements-textPrimary mb-3">请求状态分布</h3>
          <div className="h-64">
            <Pie data={statusDistributionData} options={statusPieOptions} />
          </div>
        </div>

        <div className={cardClasses}>
          <h3 className="text-base font-medium text-upage-elements-textPrimary mb-3">Token 使用分布</h3>
          <div className="h-64">
            <Doughnut data={tokenUsageData} options={doughnutOptions} />
          </div>
        </div>
      </div>
    </div>
  );
}
