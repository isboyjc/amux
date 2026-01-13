/**
 * HTTP 响应工具函数
 */

import type { ApiResponse } from '../types'

/**
 * CORS 头
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
}

/**
 * 创建 JSON 响应
 */
export function jsonResponse<T = any>(
  data: ApiResponse<T> | any,
  status: number = 200
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  })
}
