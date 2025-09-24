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

declare global {
  interface Window {
    webkitSpeechRecognition: typeof SpeechRecognition;
    SpeechRecognition: typeof SpeechRecognition;
    ENV: {
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

  // 扩展 Request 接口，使 json 方法支持泛型
  interface Request {
    json<T = any>(): Promise<T>;
  }
}

// 确保文件被视为模块
export {};
