// 全局 API 响应接口
/**
 * 标准 API 响应接口
 * 遵循 RESTful API 最佳实践，结合 HTTP 状态码和业务处理结果
 */
export interface ApiResponse<T = any> {
  /** 请求是否成功 */
  success: boolean;
  /** 响应消息 */
  message?: string;
  /** 响应数据 */
  data?: T;
}

export type DebugLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

declare global {
  interface Window {
    webkitSpeechRecognition: typeof SpeechRecognition;
    SpeechRecognition: typeof SpeechRecognition;
    ENV: {
      LOG_LEVEL?: DebugLevel;
      OPERATING_ENV: 'production' | 'development' | 'test';
      MAX_UPLOAD_SIZE_MB: number;
    };
  }

  interface Performance {
    memory?: {
      jsHeapSizeLimit: number;
      totalJSHeapSize: number;
      usedJSHeapSize: number;
    };
  }

  interface Request {
    json<T = any>(): Promise<T>;
  }
}

export {};
