import React, { useRef, useState } from 'react';
import { webBuilderStore } from '~/.client/stores/web-builder';
import loadingSvg from '../icons/loading.svg?raw';
import uploadSvg from '../icons/upload.svg?raw';
import type { EditorProps } from './EditorProps';

/**
 * wait for image load, support retry
 * @param url image URL
 * @param maxRetries maximum retry times
 * @param initialDelay initial delay (milliseconds)
 *
 * @returns whether the image is successfully loaded
 */
async function waitForImageLoad(url: string, maxRetries = 5, initialDelay = 200): Promise<boolean> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await new Promise<void>((resolve, reject) => {
        const img = new Image();
        const timeout = setTimeout(() => {
          reject(new Error('图片加载超时'));
        }, 5000);

        img.onload = () => {
          clearTimeout(timeout);
          resolve();
        };
        img.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('图片加载失败'));
        };
        img.src = url;
      });
      return true;
    } catch {
      if (attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  return false;
}

/**
 * image editor component, for uploading and replacing images.
 */
export const ImageEditor: React.FC<EditorProps> = ({ element, onClose }) => {
  const imgElement = element as HTMLImageElement;
  const [src, setSrc] = useState(imgElement.src);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'upload' | 'preview' | 'complete'>('upload');
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const maxFileSizeMB = window.ENV.MAX_UPLOAD_SIZE_MB || 5;
  const maxFileSize = maxFileSizeMB * 1024 * 1024;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      setError(null);

      if (file.size > maxFileSize) {
        const maxSizeMB = Math.round(maxFileSize / (1024 * 1024));
        setError(`文件大小超过限制，最大允许${maxSizeMB}MB`);
        setIsUploading(false);
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setPreviewSrc(event.target.result as string);
          setOriginalFile(file);
          setStep('preview');
          setIsUploading(false);
        }
      };
      reader.onerror = () => {
        console.error('文件读取失败');
        setError('文件读取失败');
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleConfirm = async () => {
    if (previewSrc && originalFile) {
      setIsUploading(true);
      setError(null);

      try {
        const currentMessageId = webBuilderStore.chatStore.currentMessageId.get();
        if (!currentMessageId) {
          throw new Error('无法获取当前消息 ID');
        }

        const currentPageName = webBuilderStore.editorStore.selectedDocument.get();
        if (!currentPageName) {
          throw new Error('无法获取当前页面信息');
        }

        const pages = webBuilderStore.pagesStore.pages.get();
        const currentPage = pages[currentPageName];
        if (!currentPage || !currentPage.id) {
          throw new Error('当前页面尚未保存，无法上传资源');
        }

        const pageId = currentPage.id;

        // 验证文件大小
        if (originalFile.size > maxFileSize) {
          const maxSizeMB = Math.round(maxFileSize / (1024 * 1024));
          throw new Error(`文件大小超过限制，最大允许${maxSizeMB}MB`);
        }

        const formData = new FormData();
        formData.append('file', originalFile);
        formData.append('messageId', currentMessageId);
        formData.append('pageId', pageId);

        // 传递旧图片 URL，用于后端清理
        if (src && src !== previewSrc) {
          formData.append('oldUrl', src);
        }

        const response = await fetch('/api/upload/asset', {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.message || '上传失败');
        }

        const imageLoaded = await waitForImageLoad(result.data.url);

        if (!imageLoaded) {
          throw new Error('图片上传成功但无法访问，请稍后刷新页面');
        }

        imgElement.src = result.data.url;
        setSrc(result.data.url);

        setStep('complete');

        setTimeout(() => {
          onClose();
          setStep('upload');
          setPreviewSrc(null);
          setOriginalFile(null);
        }, 800);
      } catch (error) {
        console.error('文件上传失败', error);
        setError(error instanceof Error ? error.message : '文件上传失败');
        setIsUploading(false);
      }
    }
  };

  const handleCancel = () => {
    setStep('upload');
    setPreviewSrc(null);
    setOriginalFile(null);
    setError(null);
  };

  return (
    <div>
      {step === 'upload' && (
        <div
          style={{
            border: '2px dashed #e2e8f0',
            borderRadius: '8px',
            padding: '24px 16px',
            cursor: 'pointer',
            textAlign: 'center',
            position: 'relative',
          }}
          onClick={triggerFileInput}
        >
          {isUploading ? (
            <div style={{ padding: '20px 0' }}>
              <div dangerouslySetInnerHTML={{ __html: loadingSvg }} style={{ margin: '0 auto', display: 'block' }} />
              <p style={{ marginTop: '12px', color: '#64748b' }}>正在上传图片...</p>
            </div>
          ) : (
            <>
              <div dangerouslySetInnerHTML={{ __html: uploadSvg }} style={{ margin: '0 auto', display: 'block' }} />
              <p style={{ margin: '12px 0 0', color: '#64748b' }}>点击或拖拽图片到此处上传</p>
              {error && <p style={{ margin: '8px 0 0', color: '#ef4444' }}>{error}</p>}
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept="image/*"
                onChange={handleFileChange}
              />
            </>
          )}
        </div>
      )}

      {step === 'preview' && previewSrc && (
        <div>
          <div style={{ fontSize: '16px', fontWeight: 500, marginBottom: '12px', color: '#1e293b' }}>预览图片</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '120px' }}>
                <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>原图</p>
                <div
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '4px',
                    padding: '8px',
                    height: '150px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  <img
                    src={src}
                    alt="原图"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain',
                    }}
                  />
                </div>
              </div>

              <div style={{ flex: 1, minWidth: '120px' }}>
                <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>新图</p>
                <div
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '4px',
                    padding: '8px',
                    height: '150px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  <img
                    src={previewSrc}
                    alt="新图"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain',
                    }}
                  />
                </div>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  onClick={handleCancel}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '4px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#f8fafc',
                    color: '#64748b',
                    cursor: isUploading ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    opacity: isUploading ? 0.6 : 1,
                  }}
                  disabled={isUploading}
                >
                  取消
                </button>
                <button
                  onClick={handleConfirm}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '4px',
                    border: 'none',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    cursor: isUploading ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    opacity: isUploading ? 0.8 : 1,
                  }}
                  disabled={isUploading}
                >
                  {isUploading ? '上传中...' : '替换图片'}
                </button>
              </div>
              {error && (
                <p style={{ margin: '8px 0 0', color: '#ef4444', fontSize: '12px', textAlign: 'center' }}>{error}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
