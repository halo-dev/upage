import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

interface ScreenshotSelectorProps {
  isSelectionMode: boolean;
  setIsSelectionMode: (mode: boolean) => void;
  containerRef: React.RefObject<HTMLElement | null>;
}

export const ScreenshotSelector = memo(
  ({ isSelectionMode, setIsSelectionMode, containerRef }: ScreenshotSelectorProps) => {
    const [isCapturing, setIsCapturing] = useState(false);
    const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
    const [selectionEnd, setSelectionEnd] = useState<{ x: number; y: number } | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const hasRequestedPermissionRef = useRef(false);

    // 清理流和视频资源的函数
    const cleanupResources = useCallback(() => {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
        videoRef.current.remove();
        videoRef.current = null;
      }

      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }

      hasRequestedPermissionRef.current = false;
    }, []);

    // 当组件卸载时清理资源
    useEffect(() => {
      return cleanupResources;
    }, [cleanupResources]);

    // 当选择模式关闭时清理资源
    useEffect(() => {
      if (!isSelectionMode && mediaStreamRef.current) {
        cleanupResources();
      }
    }, [isSelectionMode, cleanupResources]);

    const initializeStream = async () => {
      // 如果已经有流，直接返回
      if (mediaStreamRef.current) {
        return mediaStreamRef.current;
      }

      // 如果已经请求了权限，等待并返回null（避免重复请求）
      if (hasRequestedPermissionRef.current) {
        return null;
      }

      hasRequestedPermissionRef.current = true;

      try {
        // 请求显示媒体权限
        const stream = await navigator.mediaDevices.getDisplayMedia({
          audio: false,
          video: {
            displaySurface: 'window',
            preferCurrentTab: true,
            surfaceSwitching: 'include',
            systemAudio: 'exclude',
          },
        } as MediaStreamConstraints);

        // 添加流失效时的处理器
        stream.addEventListener('inactive', () => {
          cleanupResources();
          setIsSelectionMode(false);
          setSelectionStart(null);
          setSelectionEnd(null);
          setIsCapturing(false);
        });

        mediaStreamRef.current = stream;

        // 初始化视频元素
        if (!videoRef.current) {
          const video = document.createElement('video');
          video.style.opacity = '0';
          video.style.position = 'fixed';
          video.style.pointerEvents = 'none';
          video.style.zIndex = '-1';
          document.body.appendChild(video);
          videoRef.current = video;
        }

        // 设置视频流并播放
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        return stream;
      } catch (error) {
        console.error('Failed to initialize stream:', error);
        setIsSelectionMode(false);
        toast.error('初始化屏幕捕获失败');
        hasRequestedPermissionRef.current = false;

        return null;
      }
    };

    const handleCopySelection = useCallback(async () => {
      if (!isSelectionMode || !selectionStart || !selectionEnd || !containerRef.current) {
        return;
      }

      setIsCapturing(true);

      try {
        const stream = await initializeStream();

        if (!stream || !videoRef.current) {
          setIsCapturing(false);
          return;
        }

        // 等待视频准备好
        await new Promise((resolve) => setTimeout(resolve, 300));

        // 创建临时画布进行全屏截图
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = videoRef.current.videoWidth;
        tempCanvas.height = videoRef.current.videoHeight;

        const tempCtx = tempCanvas.getContext('2d');

        if (!tempCtx) {
          throw new Error('无法获取临时画布上下文');
        }

        // 绘制完整视频帧
        tempCtx.drawImage(videoRef.current, 0, 0);

        // 计算视频和屏幕之间的比例因子
        const scaleX = videoRef.current.videoWidth / window.innerWidth;
        const scaleY = videoRef.current.videoHeight / window.innerHeight;

        // 获取窗口滚动位置
        const scrollX = window.scrollX;
        const scrollY = window.scrollY + 40;

        // 获取容器在页面上的位置
        const containerRect = containerRef.current.getBoundingClientRect();

        // 精确剪裁的偏移调整
        const leftOffset = -9; // 调整左侧位置
        const bottomOffset = -14; // 调整底部位置

        // 计算缩放后的坐标（带滚动偏移和调整）
        const scaledX = Math.round(
          (containerRect.left + Math.min(selectionStart.x, selectionEnd.x) + scrollX + leftOffset) * scaleX,
        );
        const scaledY = Math.round(
          (containerRect.top + Math.min(selectionStart.y, selectionEnd.y) + scrollY + bottomOffset) * scaleY,
        );
        const scaledWidth = Math.round(Math.abs(selectionEnd.x - selectionStart.x) * scaleX);
        const scaledHeight = Math.round(Math.abs(selectionEnd.y - selectionStart.y) * scaleY);

        // 为裁剪区域创建最终画布
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(Math.abs(selectionEnd.x - selectionStart.x));
        canvas.height = Math.round(Math.abs(selectionEnd.y - selectionStart.y));

        const ctx = canvas.getContext('2d');

        if (!ctx) {
          throw new Error('无法获取画布上下文');
        }

        // 绘制裁剪区域
        ctx.drawImage(tempCanvas, scaledX, scaledY, scaledWidth, scaledHeight, 0, 0, canvas.width, canvas.height);

        // 转换为 blob
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('无法创建 blob'));
            }
          }, 'image/png');
        });

        // 创建 FileReader 将 blob 转换为 base64
        const reader = new FileReader();

        reader.onload = () => {
          // 查找 textarea 元素
          const textarea = document.querySelector('textarea');

          if (textarea) {
            // 从 BaseChat 组件获取 setters
            const setUploadedFiles = (window as any).__UPAGE_SET_UPLOADED_FILES__;
            const uploadedFiles = (window as any).__UPAGE_UPLOADED_FILES__ || [];

            if (setUploadedFiles) {
              // 更新文件和图像数据
              const file = new File([blob], 'screenshot.png', { type: 'image/png' });
              setUploadedFiles([...uploadedFiles, file]);
              toast.success('截图已添加到聊天中');
            } else {
              toast.error('无法将截图添加到聊天中');
            }
          }
        };
        reader.readAsDataURL(blob);
      } catch (error) {
        console.error('Failed to capture screenshot:', error);
        toast.error('截图失败');
        cleanupResources();
      } finally {
        setIsCapturing(false);
        setSelectionStart(null);
        setSelectionEnd(null);
        setIsSelectionMode(false); // 捕获后关闭选择模式
      }
    }, [isSelectionMode, selectionStart, selectionEnd, containerRef, setIsSelectionMode, cleanupResources]);

    const handleSelectionStart = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!isSelectionMode) {
          return;
        }

        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setSelectionStart({ x, y });
        setSelectionEnd({ x, y });
      },
      [isSelectionMode],
    );

    const handleSelectionMove = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!isSelectionMode || !selectionStart) {
          return;
        }

        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setSelectionEnd({ x, y });
      },
      [isSelectionMode, selectionStart],
    );

    if (!isSelectionMode) {
      return null;
    }

    return (
      <div
        className="absolute inset-0 cursor-crosshair"
        onMouseDown={handleSelectionStart}
        onMouseMove={handleSelectionMove}
        onMouseUp={handleCopySelection}
        onMouseLeave={() => {
          if (selectionStart) {
            setSelectionStart(null);
          }
        }}
        style={{
          backgroundColor: isCapturing ? 'transparent' : 'rgba(0, 0, 0, 0.1)',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          pointerEvents: 'all',
          opacity: isCapturing ? 0 : 1,
          zIndex: 50,
          transition: 'opacity 0.1s ease-in-out',
        }}
      >
        {selectionStart && selectionEnd && !isCapturing && (
          <div
            className="absolute border-2 border-blue-500 bg-blue-200 bg-opacity-20"
            style={{
              left: Math.min(selectionStart.x, selectionEnd.x),
              top: Math.min(selectionStart.y, selectionEnd.y),
              width: Math.abs(selectionEnd.x - selectionStart.x),
              height: Math.abs(selectionEnd.y - selectionStart.y),
            }}
          />
        )}
      </div>
    );
  },
);
