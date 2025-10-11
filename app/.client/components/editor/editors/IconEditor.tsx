import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { EditorProps } from './EditorProps';

/**
 * 生成 iconify 图标的 HTML
 *
 * @param icon 图标名称
 * @param style 样式对象
 * @returns 包含 iconify 图标的 HTML 字符串
 */
const iconifyIcon = (icon: string, style: string = '') => {
  return `<iconify-icon icon="${icon}" ${style ? `style="${style}"` : ''}></iconify-icon>`;
};

const API_BASE_URLS = ['https://api.iconify.design', 'https://api.simplesvg.com', 'https://api.unisvg.com'];

const API_ENDPOINTS = {
  COLLECTIONS: '/collections',
  COLLECTION: '/collection',
  SEARCH: '/search',
};

// 每页加载的图标数量
const ICONS_PER_PAGE = 20;

interface IconSetInfo {
  name: string;
  total?: number;
  author?: {
    name: string;
    url?: string;
  };
  license?: {
    title: string;
    url?: string;
  };
  samples?: string[];
  height?: number;
  [key: string]: any;
}

/**
 * 从多个API源获取 iconify 数据
 *
 * @param endpoint API端点
 * @param params URL参数对象
 * @returns 获取到的数据
 * @throws 如果所有API源都失败，则抛出错误
 */
const fetchFromAPI = async (endpoint: string, params: Record<string, string> = {}) => {
  const queryString = Object.entries(params)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');

  const urlSuffix = queryString ? `${endpoint}?${queryString}` : endpoint;
  let lastError = null;
  let lastResponseText = '';

  for (const baseUrl of API_BASE_URLS) {
    try {
      const url = `${baseUrl}${urlSuffix}`;
      const response = await fetch(url);
      if (response.ok) {
        return await response.json();
      }
      lastResponseText = await response.text();
      console.warn(`API 请求失败: ${url}, 状态码: ${response.status}, 响应: ${lastResponseText.substring(0, 100)}...`);
    } catch (err) {
      lastError = err;
      console.warn(`从 ${baseUrl}${urlSuffix} 获取数据失败`, err);
    }
  }

  const errorMsg = lastResponseText ? `API 返回错误: ${lastResponseText.substring(0, 200)}` : '无法从任何API源获取数据';
  console.error(errorMsg, lastError);
  throw new Error(errorMsg);
};

/**
 * 图标编辑器组件，用于实现 iconify 图标替换。
 */
export const IconEditor: React.FC<EditorProps> = ({ element, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentIcon, setCurrentIcon] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [iconSets, setIconSets] = useState<string[]>([]);
  const [iconSetsInfo, setIconSetsInfo] = useState<Record<string, IconSetInfo>>({});
  const [selectedIconSet, setSelectedIconSet] = useState<string>('');
  const [icons, setIcons] = useState<string[]>([]);
  const [, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [allIconNames, setAllIconNames] = useState<string[]>([]);
  const [loadedIconNames, setLoadedIconNames] = useState<string[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (element && element.tagName.toLowerCase() === 'iconify-icon') {
      const iconName = element.getAttribute('icon') || '';
      setCurrentIcon(iconName);
    }
  }, [element]);

  useEffect(() => {
    const fetchIconSets = async () => {
      setIsLoading(true);
      try {
        const data = await fetchFromAPI(API_ENDPOINTS.COLLECTIONS);
        const prefixes = Object.keys(data);
        setIconSets(prefixes);
        setIconSetsInfo(data);

        if (currentIcon) {
          const [prefix] = currentIcon.split(':');
          if (prefixes.includes(prefix)) {
            setSelectedIconSet(prefix);
            return;
          }
        }

        setSelectedIconSet(prefixes[0]);
      } catch (err) {
        console.error('获取图标集失败', err);
        setError('获取图标集失败，请稍后再试');
      } finally {
        setIsLoading(false);
      }
    };

    if (iconSets.length === 0) {
      fetchIconSets();
    }
  }, [currentIcon]);

  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    if ('IntersectionObserver' in window && loadMoreTriggerRef.current && !isSearching && hasMore) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          const [entry] = entries;
          if (entry.isIntersecting && hasMore && !isLoading && !isLoadingMore) {
            loadMoreIcons();
          }
        },
        { threshold: 0.1, rootMargin: '0px 0px 100px 0px' },
      );

      observerRef.current.observe(loadMoreTriggerRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, [hasMore, isLoading, isLoadingMore, isSearching, selectedIconSet]);

  useEffect(() => {
    if (selectedIconSet) {
      setPage(1);
      setIcons([]);
      setAllIconNames([]);
      setLoadedIconNames([]);
      setHasMore(true);

      fetchAllIconNames(selectedIconSet);
    }
  }, [selectedIconSet]);

  const fetchAllIconNames = async (prefix: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchFromAPI(API_ENDPOINTS.COLLECTION, {
        prefix,
        chars: 'true',
        aliases: 'true',
      });
      const iconNamesSet = new Set<string>();

      if (data.uncategorized && Array.isArray(data.uncategorized)) {
        data.uncategorized.forEach((name: string) => iconNamesSet.add(name));
      }

      if (data.categories && typeof data.categories === 'object') {
        Object.values(data.categories).forEach((icons: any) => {
          if (Array.isArray(icons)) {
            icons.forEach((name: string) => iconNamesSet.add(name));
          }
        });
      }

      if (data.icons && Array.isArray(data.icons)) {
        data.icons.forEach((name: string) => iconNamesSet.add(name));
      }

      if (Array.isArray(data)) {
        data.forEach((name: string) => iconNamesSet.add(name));
      }

      if (iconNamesSet.size === 0 && typeof data === 'object') {
        Object.keys(data).forEach((key) => {
          if (typeof data[key] === 'object' && data[key] !== null) {
            iconNamesSet.add(key);
          }
        });
      }

      const iconNames = Array.from(iconNamesSet);
      setAllIconNames(iconNames);
      if (iconNames.length > 0) {
        fetchIconsBatch(prefix, iconNames.slice(0, ICONS_PER_PAGE));
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('获取图标集失败', err instanceof Error ? err.message : String(err));
      setError('获取图标集失败，请稍后再试');
      setIsLoading(false);
    }
  };

  const fetchIconsBatch = async (prefix: string, iconBatch: string[]) => {
    if (iconBatch.length === 0) {
      setIsLoading(false);
      setIsLoadingMore(false);
      return;
    }

    setError(null);

    try {
      const iconsParam = iconBatch.join(',');
      await fetchFromAPI(`/${prefix}.json`, { icons: iconsParam });
      const newIcons = iconBatch.map((name) => `${prefix}:${name}`);
      setIcons((prev) => {
        const updated = [...prev, ...newIcons];
        return updated;
      });

      setLoadedIconNames((prev) => {
        const updated = [...prev, ...iconBatch];

        const hasMoreIcons = updated.length < allIconNames.length;
        setTimeout(() => {
          setHasMore(hasMoreIcons);
        }, 0);
        return updated;
      });

      setPage((prevPage) => prevPage + 1);
    } catch (err) {
      console.error('获取图标失败', err instanceof Error ? err.message : String(err));
      setError('获取图标失败，请稍后再试');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  const loadMoreIcons = useCallback(() => {
    if (isLoading || isLoadingMore || !hasMore || isSearching || !selectedIconSet) {
      return;
    }

    setIsLoadingMore(true);

    const startIndex = loadedIconNames.length;
    const endIndex = Math.min(startIndex + ICONS_PER_PAGE, allIconNames.length);

    if (startIndex < endIndex) {
      const nextBatch = allIconNames.slice(startIndex, endIndex);
      fetchIconsBatch(selectedIconSet, nextBatch);
    } else {
      setHasMore(false);
      setIsLoadingMore(false);
    }
  }, [isLoading, isLoadingMore, hasMore, isSearching, selectedIconSet, loadedIconNames.length, allIconNames]);

  const searchIcons = async () => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchFromAPI(API_ENDPOINTS.SEARCH, { query: searchTerm });
      let results: string[] = [];
      if (data.icons && Array.isArray(data.icons)) {
        results = data.icons;
      } else if (Array.isArray(data)) {
        results = data;
      } else if (data.results && Array.isArray(data.results)) {
        results = data.results;
      } else if (typeof data === 'object') {
        const possibleResults = Object.keys(data).filter((key) => typeof data[key] === 'object' && data[key] !== null);
        if (possibleResults.length > 0) {
          results = possibleResults;
        }
      }
      setSearchResults(results);
    } catch (err) {
      console.error('搜索图标失败', err instanceof Error ? err.message : String(err));
      setError('搜索图标失败，请稍后再试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = useCallback(() => {
    searchIcons();
  }, [searchTerm]);

  const loadMore = useCallback(() => {
    if (!isLoading && hasMore && !isLoadingMore && selectedIconSet) {
      loadMoreIcons();
      return;
    }
    setHasMore(false);
    setIsLoadingMore(false);
  }, [isLoading, hasMore, isLoadingMore, selectedIconSet, loadMoreIcons]);

  const selectIcon = (iconName: string) => {
    if (element && element.tagName.toLowerCase() === 'iconify-icon') {
      element.setAttribute('icon', iconName);
      setCurrentIcon(iconName);
      onClose();
    }
  };

  const handleIconSetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedIconSet(e.target.value);
    setPage(1);
    setIcons([]);
  };

  const renderIcons = () => {
    const iconsToRender = isSearching ? searchResults : icons;

    if (iconsToRender.length === 0) {
      return (
        <div
          style={{
            textAlign: 'center',
            color: '#64748b',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '180px',
          }}
        >
          {isLoading ? (
            <>
              <div
                dangerouslySetInnerHTML={{
                  __html: iconifyIcon('line-md:loading-twotone-loop', 'font-size: 24px; color: #64748b'),
                }}
                style={{ marginBottom: '12px' }}
              />
              <div>加载中...</div>
            </>
          ) : (
            <>
              <div
                dangerouslySetInnerHTML={{
                  __html: iconifyIcon('tabler:mood-sad', 'font-size: 40px; color: #94a3b8'),
                }}
                style={{ marginBottom: '16px' }}
              />
              <div>没有找到图标</div>
              <div style={{ fontSize: '12px', marginTop: '8px', color: '#94a3b8' }}>
                {isSearching ? '请尝试其他搜索关键词' : '请选择其他图标集'}
              </div>
            </>
          )}
        </div>
      );
    }

    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(65px, 1fr))',
          gap: '10px',
        }}
      >
        {iconsToRender.map((iconName) => (
          <div
            key={iconName}
            onClick={() => selectIcon(iconName)}
            style={{
              cursor: 'pointer',
              padding: '8px 4px',
              border: iconName === currentIcon ? '2px solid #3b82f6' : '1px solid #e2e8f0',
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: iconName === currentIcon ? '#eff6ff' : '#ffffff',
              boxShadow:
                iconName === currentIcon ? '0 1px 3px rgba(59, 130, 246, 0.1)' : '0 1px 2px rgba(0, 0, 0, 0.02)',
              transition: 'all 0.2s ease',
              height: '70px',
            }}
            onMouseOver={(e) => {
              if (iconName !== currentIcon) {
                e.currentTarget.style.backgroundColor = '#f8fafc';
                e.currentTarget.style.borderColor = '#cbd5e1';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.05)';
              }
            }}
            onMouseOut={(e) => {
              if (iconName !== currentIcon) {
                e.currentTarget.style.backgroundColor = '#ffffff';
                e.currentTarget.style.borderColor = '#e2e8f0';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.02)';
              }
            }}
          >
            <div
              dangerouslySetInnerHTML={{
                __html: `<iconify-icon icon="${iconName}" style="font-size: 26px; color: ${iconName === currentIcon ? '#3b82f6' : '#475569'}"></iconify-icon>`,
              }}
            ></div>
            <div
              style={{
                fontSize: '10px',
                marginTop: '6px',
                textAlign: 'center',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                width: '100%',
                color: iconName === currentIcon ? '#3b82f6' : '#64748b',
              }}
            >
              {iconName.split(':')[1] || iconName}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', width: '400px' }}>
      <div style={{ marginBottom: '20px' }}>
        <div
          style={{
            fontSize: '14px',
            fontWeight: 500,
            marginBottom: '16px',
            color: '#475569',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>当前图标:</span>
          {currentIcon ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                backgroundColor: '#f0f9ff',
                borderRadius: '4px',
                padding: '4px 8px',
                border: '1px solid #bae6fd',
                color: '#0284c7',
                fontSize: '14px',
                fontWeight: 'normal',
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                }}
                dangerouslySetInnerHTML={{
                  __html: `<iconify-icon icon="${currentIcon}" style="font-size: 16px; margin-right: 6px"></iconify-icon>`,
                }}
              ></span>
              {currentIcon}
            </span>
          ) : (
            <span style={{ color: '#94a3b8', fontSize: '14px', fontStyle: 'italic' }}>未选择</span>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            marginBottom: '16px',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            overflow: 'hidden',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
            transition: 'all 0.2s ease',
          }}
        >
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="搜索图标..."
            style={{
              flex: 1,
              padding: '10px 14px',
              border: 'none',
              outline: 'none',
              fontSize: '14px',
              backgroundColor: '#ffffff',
            }}
          />
          <button
            onClick={handleSearch}
            disabled={isLoading}
            style={{
              background: isLoading ? '#f1f5f9' : '#f8fafc',
              border: 'none',
              borderLeft: '1px solid #e2e8f0',
              padding: '0 16px',
              cursor: isLoading ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
              color: isLoading ? '#94a3b8' : '#64748b',
            }}
            onMouseOver={(e) => {
              if (!isLoading) {
                e.currentTarget.style.backgroundColor = '#f1f5f9';
              }
            }}
            onMouseOut={(e) => {
              if (!isLoading) {
                e.currentTarget.style.backgroundColor = '#f8fafc';
              }
            }}
          >
            <div
              dangerouslySetInnerHTML={{
                __html: iconifyIcon('tabler:search', 'font-size: 18px'),
              }}
            />
          </button>
        </div>

        {!isSearching && (
          <div style={{ marginBottom: '16px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                color: '#475569',
                fontWeight: 500,
              }}
            >
              选择图标集:
            </label>
            <div style={{ position: 'relative' }}>
              <select
                value={selectedIconSet}
                onChange={handleIconSetChange}
                disabled={isLoading || iconSets.length === 0}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  paddingRight: '32px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  fontSize: '14px',
                  color: '#1e293b',
                  backgroundColor: '#ffffff',
                  appearance: 'none',
                  cursor: isLoading || iconSets.length === 0 ? 'default' : 'pointer',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                  transition: 'border-color 0.2s ease',
                }}
              >
                {iconSets.length === 0 ? (
                  <option value="">加载中...</option>
                ) : (
                  iconSets.map((prefix) => (
                    <option key={prefix} value={prefix}>
                      {iconSetsInfo[prefix]?.name ? `${iconSetsInfo[prefix].name}` : prefix}
                    </option>
                  ))
                )}
              </select>
              <div
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '0',
                  bottom: '0',
                  pointerEvents: 'none',
                  color: '#64748b',
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
              >
                <div
                  dangerouslySetInnerHTML={{
                    __html: iconifyIcon('tabler:chevron-down', 'font-size: 16px'),
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {error && (
          <div
            style={{
              color: '#ef4444',
              fontSize: '14px',
              marginBottom: '12px',
              padding: '8px 12px',
              backgroundColor: '#fef2f2',
              borderRadius: '6px',
              border: '1px solid #fee2e2',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div
                dangerouslySetInnerHTML={{
                  __html: iconifyIcon('tabler:alert-circle', 'font-size: 16px; color: currentColor'),
                }}
              />
              {error}
            </div>
          </div>
        )}
      </div>

      <div
        ref={scrollContainerRef}
        style={{
          maxHeight: '180px',
          overflowY: 'auto',
          overflowX: 'hidden',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '16px',
          backgroundColor: '#ffffff',
          boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.05)',
          scrollBehavior: 'smooth',
        }}
        onScroll={(e) => {
          const target = e.currentTarget;
          const isNearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 100;

          if (isNearBottom && hasMore && !isLoading && !isLoadingMore && !isSearching) {
            loadMoreIcons();
          }
        }}
      >
        {isLoading && icons.length === 0 && !isSearching ? (
          <div
            style={{
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              dangerouslySetInnerHTML={{
                __html: iconifyIcon('line-md:loading-twotone-loop', 'font-size: 40px; color: #64748b; opacity: 0.7'),
              }}
              style={{
                margin: '0 auto',
                display: 'block',
              }}
            />
            <p
              style={{
                marginTop: '16px',
                color: '#64748b',
                fontSize: '14px',
              }}
            >
              正在加载图标集...
            </p>
          </div>
        ) : (
          renderIcons()
        )}

        <div
          ref={loadMoreTriggerRef}
          style={{
            height: '20px',
            margin: '20px 0 10px',
            visibility: hasMore && !isSearching ? 'visible' : 'hidden',
            display: hasMore && !isSearching ? 'block' : 'none',
            position: 'relative',
            width: '100%',
            textAlign: 'center',
          }}
        >
          {hasMore && !isSearching && !isLoadingMore && (
            <div
              style={{
                fontSize: '12px',
                color: '#94a3b8',
                padding: '5px',
                border: '1px dashed #e2e8f0',
                borderRadius: '4px',
                display: 'inline-block',
              }}
            >
              滚动加载更多...
            </div>
          )}
        </div>

        {isLoadingMore && !isSearching && (
          <div
            style={{
              textAlign: 'center',
              padding: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <div
              dangerouslySetInnerHTML={{
                __html: iconifyIcon('line-md:loading-twotone-loop', 'font-size: 20px; color: #64748b'),
              }}
            />
            <span style={{ fontSize: '14px', color: '#64748b' }}>加载更多图标...</span>
          </div>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          marginTop: '20px',
          gap: '12px',
        }}
      >
        {!isSearching && hasMore && (
          <button
            onClick={loadMore}
            disabled={isLoading || isLoadingMore}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              backgroundColor: isLoading || isLoadingMore ? '#f1f5f9' : '#f8fafc',
              color: isLoading || isLoadingMore ? '#94a3b8' : '#475569',
              cursor: isLoading || isLoadingMore ? 'default' : 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            onMouseOver={(e) => {
              if (!isLoading && !isLoadingMore) {
                e.currentTarget.style.backgroundColor = '#f1f5f9';
                e.currentTarget.style.borderColor = '#cbd5e1';
              }
            }}
            onMouseOut={(e) => {
              if (!isLoading && !isLoadingMore) {
                e.currentTarget.style.backgroundColor = '#f8fafc';
                e.currentTarget.style.borderColor = '#e2e8f0';
              }
            }}
          >
            {isLoading || isLoadingMore ? (
              <>
                <div
                  dangerouslySetInnerHTML={{
                    __html: iconifyIcon('line-md:loading-twotone-loop', 'font-size: 14px; color: #64748b'),
                  }}
                  style={{ marginRight: '4px' }}
                />
                加载中...
              </>
            ) : (
              <>
                <div
                  dangerouslySetInnerHTML={{
                    __html: iconifyIcon('tabler:download', 'font-size: 16px'),
                  }}
                />
                加载更多
              </>
            )}
          </button>
        )}

        {isSearching && (
          <button
            onClick={() => {
              setIsSearching(false);
              setSearchTerm('');
              setSearchResults([]);
            }}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc',
              color: '#475569',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#f1f5f9';
              e.currentTarget.style.borderColor = '#cbd5e1';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#f8fafc';
              e.currentTarget.style.borderColor = '#e2e8f0';
            }}
          >
            <div
              dangerouslySetInnerHTML={{
                __html: iconifyIcon('tabler:arrow-left', 'font-size: 16px'),
              }}
            />
            返回图标集浏览
          </button>
        )}
      </div>
    </div>
  );
};
