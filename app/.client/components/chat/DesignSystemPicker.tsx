import * as RadixDialog from '@radix-ui/react-dialog';
import classNames from 'classnames';
import { motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildDesignSystemPreviewModel, extractBrandNameFromDesignMd } from '~/.client/utils/design-system';
import { DialogTitle, dialogBackdropVariants, dialogVariants } from '../ui/Dialog';

export type DesignSystemItem = {
  brand: string;
  file: string;
  description: string;
  sourceUpdatedAt: string;
};

interface DesignSystemPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (brand: string, content: string) => void;
}

function LivePreview({ content, description }: { content: string; description: string }) {
  const previewModel = useMemo(() => buildDesignSystemPreviewModel(content, description), [content, description]);
  const {
    brandName,
    allColors,
    fontFamily,
    resolvedDescription,
    canvasHex,
    surfaceHex,
    inkHex,
    bodyHex,
    borderHex,
    accentHex,
    accentText,
    secondAccentHex,
  } = previewModel;

  return (
    <div className="p-4 flex flex-col gap-4">
      <div className="rounded-xl overflow-hidden border" style={{ borderColor: borderHex }}>
        <div
          className="h-14 flex items-end px-4 pb-3"
          style={{ background: `linear-gradient(135deg, ${accentHex}30 0%, ${secondAccentHex}50 100%)` }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-base font-bold shadow-sm flex-shrink-0"
            style={{ background: accentHex, color: accentText }}
          >
            {brandName[0]}
          </div>
        </div>
        <div className="px-4 py-3" style={{ backgroundColor: canvasHex }}>
          <div className="text-sm font-bold" style={{ color: inkHex, fontFamily: fontFamily ?? undefined }}>
            {brandName}
          </div>
          <div className="mt-0.5 line-clamp-2 text-xs leading-relaxed" style={{ color: bodyHex }}>
            {resolvedDescription}
          </div>
        </div>
      </div>

      <div>
        <div className="text-[11px] font-semibold text-upage-elements-textTertiary uppercase tracking-wider mb-2">
          组件预览
        </div>
        <div
          className="rounded-xl border p-4 flex flex-col gap-3"
          style={{ borderColor: borderHex, backgroundColor: canvasHex }}
        >
          <div className="flex flex-wrap gap-2">
            <button
              className="px-4 py-1.5 text-sm font-semibold rounded-lg"
              style={{ background: accentHex, color: accentText, fontFamily: fontFamily ?? undefined }}
            >
              主按钮
            </button>
            <button
              className="px-4 py-1.5 text-sm font-semibold rounded-lg border-2"
              style={{ borderColor: accentHex, color: accentHex, fontFamily: fontFamily ?? undefined }}
            >
              次按钮
            </button>
            <button
              className="px-4 py-1.5 text-sm font-semibold rounded-lg"
              style={{ background: surfaceHex, color: bodyHex, fontFamily: fontFamily ?? undefined }}
            >
              幽灵按钮
            </button>
          </div>
          <div className="rounded-lg border p-3" style={{ borderColor: borderHex, backgroundColor: surfaceHex }}>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-5 h-5 rounded-full flex-shrink-0" style={{ background: accentHex }} />
              <div className="text-sm font-semibold" style={{ color: inkHex, fontFamily: fontFamily ?? undefined }}>
                {brandName} 卡片
              </div>
            </div>
            <div className="text-xs leading-relaxed" style={{ color: bodyHex }}>
              这是一张用于展示字体、层级与间距的示例卡片。
            </div>
            <div className="mt-1.5 text-xs font-semibold" style={{ color: accentHex }}>
              了解更多 →
            </div>
          </div>
        </div>
      </div>

      {allColors.length > 0 && (
        <div>
          <div className="text-[11px] font-semibold text-upage-elements-textTertiary uppercase tracking-wider mb-2">
            色板 · {allColors.length} 色
          </div>
          <div className="grid grid-cols-5 gap-2">
            {allColors.map((color) => (
              <div key={color.hex} title={`${color.name}\n${color.hex}`}>
                <div className="w-full h-9 rounded-lg border border-black/10 mb-1" style={{ background: color.hex }} />
                <div className="text-[9px] text-upage-elements-textTertiary font-mono leading-tight truncate text-center">
                  {color.hex}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {fontFamily && (
        <div>
          <div className="text-[11px] font-semibold text-upage-elements-textTertiary uppercase tracking-wider mb-2">
            字体
          </div>
          <div className="rounded-xl border p-4" style={{ borderColor: borderHex, backgroundColor: surfaceHex }}>
            <div className="mb-2 font-mono text-[11px]" style={{ color: bodyHex }}>
              {fontFamily}
            </div>
            <div className="text-2xl font-bold leading-tight" style={{ color: inkHex, fontFamily }}>
              展示标题
            </div>
            <div className="mt-1 text-sm" style={{ color: bodyHex, fontFamily }}>
              正文字体清晰易读，并兼顾可访问性。
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-widest" style={{ color: bodyHex, fontFamily }}>
              标签 · 说明 · 元信息
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function DesignSystemPicker({ isOpen, onClose, onSelect }: DesignSystemPickerProps) {
  const [designs, setDesigns] = useState<DesignSystemItem[]>([]);
  const [search, setSearch] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'raw'>('preview');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setIsLoadingList(true);
    fetch('/api/design-system/list')
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.message || '加载设计系统列表失败');
        }
        return data;
      })
      .then((data) => setDesigns(data.data || []))
      .catch(() => setDesigns([]))
      .finally(() => setIsLoadingList(false));
    setTimeout(() => searchRef.current?.focus(), 100);
  }, [isOpen]);

  const handleSelectBrand = useCallback(
    async (brand: string) => {
      if (selectedBrand === brand) {
        return;
      }
      setSelectedBrand(brand);
      setPreviewContent(null);
      setIsLoadingContent(true);
      setActiveTab('preview');
      try {
        const res = await fetch(`/api/design-system/content?brand=${encodeURIComponent(brand)}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || '加载设计系统详情失败');
        }
        setPreviewContent(data.content || null);
      } catch {
        setPreviewContent(null);
      } finally {
        setIsLoadingContent(false);
      }
    },
    [selectedBrand],
  );

  const handleConfirm = () => {
    if (selectedBrand && previewContent) {
      const brandDisplayName = displayName || selectedBrand.charAt(0).toUpperCase() + selectedBrand.slice(1);
      onSelect(brandDisplayName, previewContent);
      onClose();
    }
  };

  const handleClose = () => {
    setSearch('');
    setSelectedBrand(null);
    setPreviewContent(null);
    onClose();
  };

  const filtered = designs.filter(
    (d) =>
      d.brand.toLowerCase().includes(search.toLowerCase()) ||
      d.description.toLowerCase().includes(search.toLowerCase()),
  );

  const selectedItem = designs.find((d) => d.brand === selectedBrand);
  const displayName = previewContent ? extractBrandNameFromDesignMd(previewContent) : '';
  let previewPanel = (
    <div className="flex flex-col items-center justify-center h-full text-upage-elements-textTertiary">
      <span className="i-ph:paint-brush w-10 h-10 mb-3 opacity-30" />
      <p className="text-sm">从左侧选择一个设计系统</p>
      <p className="text-xs mt-1 opacity-70">预览将在此显示</p>
    </div>
  );

  if (selectedBrand && isLoadingContent) {
    previewPanel = (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-upage-elements-textTertiary">加载设计系统内容...</span>
        </div>
      </div>
    );
  } else if (selectedBrand && previewContent) {
    previewPanel = (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex items-center gap-1 px-4 pt-3 pb-0 border-b border-upage-elements-borderColor flex-shrink-0">
          <div className="flex gap-1">
            {(
              [
                { key: 'preview', label: '预览', icon: 'i-ph:eye' },
                { key: 'raw', label: 'DESIGN.md', icon: 'i-ph:file-text' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={classNames(
                  'flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg border border-b-0 transition-colors',
                  activeTab === tab.key
                    ? 'bg-white dark:bg-gray-950 border-upage-elements-borderColor text-upage-elements-textPrimary -mb-px'
                    : 'bg-transparent border-transparent text-upage-elements-textTertiary hover:text-upage-elements-textSecondary',
                )}
              >
                <span className={classNames(tab.icon, 'w-3.5 h-3.5')} />
                {tab.label}
              </button>
            ))}
          </div>
          {displayName && (
            <span className="ml-auto text-xs text-upage-elements-textTertiary pb-2 pr-1">{displayName}</span>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {activeTab === 'preview' ? (
            <LivePreview content={previewContent} description={selectedItem?.description ?? ''} />
          ) : (
            <pre className="p-4 text-xs text-upage-elements-textSecondary font-mono leading-relaxed whitespace-pre-wrap break-words">
              {previewContent}
            </pre>
          )}
        </div>
      </div>
    );
  }

  return (
    <RadixDialog.Root open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay asChild>
          <motion.div
            className="fixed inset-0 z-[9999] bg-black/70 dark:bg-black/80 backdrop-blur-sm"
            initial="closed"
            animate="open"
            exit="closed"
            variants={dialogBackdropVariants}
          />
        </RadixDialog.Overlay>
        <RadixDialog.Content asChild>
          <motion.div
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-950 rounded-xl shadow-xl border border-upage-elements-borderColor z-[9999] w-[920px] max-w-[95vw] max-h-[88vh] flex flex-col overflow-hidden"
            initial="closed"
            animate="open"
            exit="closed"
            variants={dialogVariants}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-upage-elements-borderColor flex-shrink-0">
              <div>
                <DialogTitle className="text-base font-semibold text-upage-elements-textPrimary">
                  选择设计风格
                </DialogTitle>
                <p className="text-xs text-upage-elements-textSecondary mt-0.5">
                  来自 getdesign.md 的精选设计系统，AI 将严格按照所选风格生成网页
                </p>
              </div>
              <RadixDialog.Close asChild>
                <button
                  className="w-7 h-7 flex items-center justify-center rounded-md text-upage-elements-textTertiary hover:text-upage-elements-textSecondary hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  onClick={handleClose}
                >
                  <span className="i-ph:x w-4 h-4" />
                </button>
              </RadixDialog.Close>
            </div>

            <div className="px-5 py-3 border-b border-upage-elements-borderColor flex-shrink-0">
              <div className="relative">
                <span className="i-ph:magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-upage-elements-textTertiary" />
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="搜索品牌或描述..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-upage-elements-borderColor rounded-lg text-upage-elements-textPrimary placeholder-upage-elements-textTertiary focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            <div className="flex flex-1 min-h-0 overflow-hidden">
              <div className="w-[260px] flex-shrink-0 border-r border-upage-elements-borderColor overflow-y-auto">
                {isLoadingList ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-sm text-upage-elements-textTertiary">
                    <span className="i-ph:magnifying-glass w-6 h-6 mb-2" />
                    未找到匹配的设计系统
                  </div>
                ) : (
                  <div className="p-2">
                    {filtered.map((item) => {
                      const isSelected = selectedBrand === item.brand;
                      const label = item.brand.charAt(0).toUpperCase() + item.brand.slice(1);
                      return (
                        <button
                          key={item.brand}
                          onClick={() => handleSelectBrand(item.brand)}
                          className={classNames(
                            'w-full text-left px-3 py-2.5 rounded-lg transition-colors mb-0.5',
                            isSelected
                              ? 'bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-900 border border-transparent',
                          )}
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className={classNames(
                                'w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0',
                                isSelected
                                  ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'
                                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
                              )}
                            >
                              {label[0]}
                            </div>
                            <div className="min-w-0">
                              <div
                                className={classNames(
                                  'text-sm font-medium truncate leading-tight',
                                  isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-upage-elements-textPrimary',
                                )}
                              >
                                {label}
                              </div>
                              <div className="text-[11px] text-upage-elements-textTertiary truncate mt-0.5 leading-tight">
                                {item.description}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex-1 flex flex-col min-w-0 overflow-hidden">{previewPanel}</div>
            </div>

            <div className="flex items-center justify-between px-5 py-3.5 border-t border-upage-elements-borderColor flex-shrink-0 bg-gray-50 dark:bg-gray-900/50">
              <div className="text-xs text-upage-elements-textTertiary">
                数据来源：
                <a
                  href="https://getdesign.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline ml-1"
                >
                  getdesign.md
                </a>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-sm text-upage-elements-textSecondary hover:text-upage-elements-textPrimary hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={!selectedBrand || !previewContent}
                  className={classNames(
                    'px-4 py-2 text-sm rounded-lg transition-colors font-medium',
                    selectedBrand && previewContent
                      ? 'bg-blue-500 hover:bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-upage-elements-textTertiary cursor-not-allowed',
                  )}
                >
                  使用此设计风格
                </button>
              </div>
            </div>
          </motion.div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
