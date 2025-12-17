import { data as remixData } from '@remix-run/node';
import type { ApiResponse } from '~/types/global';

/**
 * 创建标准化的 API 响应
 *
 * @param data 响应数据
 * @param message 响应消息
 * @param status HTTP 状态码，默认为 200
 * @returns 标准化的 API 响应
 */
export function apiResponse<T = any>(
  status: number = 200,
  data?: T,
  message?: string,
  success: boolean = true,
  headers?: HeadersInit,
) {
  const finalSuccess = success ?? (status >= 200 && status < 300);

  const responseBody: ApiResponse<T> = {
    success: finalSuccess,
    ...(data !== undefined ? { data } : {}),
    ...(message !== undefined ? { message } : {}),
  };

  return remixData(responseBody, { status, headers });
}

/**
 * 创建成功的 API 响应
 * @param data 响应数据
 * @param message 成功消息
 * @returns 成功的 API 响应
 */
export function successResponse<T = any>(data?: T, message?: string, headers?: HeadersInit) {
  return apiResponse(200, data, message, true, headers);
}

/**
 * 创建错误的 API 响应
 * @param message 错误消息
 * @param status HTTP 状态码，默认为 400
 * @param data 额外的错误数据
 * @returns 错误的 API 响应
 */
export function errorResponse<T = any>(status: number = 400, errorDetails?: string, headers?: HeadersInit) {
  return apiResponse<T>(status, undefined, errorDetails, false, headers);
}
