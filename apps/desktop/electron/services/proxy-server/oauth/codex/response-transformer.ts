/**
 * Codex Response Transformer
 * 转换 Codex 特殊格式 → OpenAI 标准格式
 */

export class CodexResponseTransformer {
  /**
   * 转换流式响应块
   * @param codexEvent - Codex SSE 事件
   * @returns OpenAI Chat Completions chunk 或 null
   */
  transformStreamChunk(codexEvent: any): any | null {
    if (!codexEvent || typeof codexEvent !== 'object' || !codexEvent.type) {
      return null
    }
    
    // 构建基础 OpenAI chunk 结构
    const openaiChunk: any = {
      id: codexEvent.item_id || codexEvent.response?.id || `chatcmpl-${Date.now()}`,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: codexEvent.response?.model || 'gpt-5',
      choices: [{
        index: 0,
        delta: {},
        finish_reason: null
      }]
    }
    
    // 根据不同的 Codex 事件类型进行转换
    switch (codexEvent.type) {
      case 'response.output_text.delta':
        // 文本内容增量
        openaiChunk.choices[0].delta = {
          role: 'assistant',
          content: codexEvent.delta || ''
        }
        break
      
      case 'response.completed':
        // 响应完成
        openaiChunk.choices[0].delta = {}
        openaiChunk.choices[0].finish_reason = 'stop'
        
        // 添加 usage 信息
        if (codexEvent.response?.usage) {
          openaiChunk.usage = {
            prompt_tokens: codexEvent.response.usage.input_tokens || 0,
            completion_tokens: codexEvent.response.usage.output_tokens || 0,
            total_tokens: codexEvent.response.usage.total_tokens || 0
          }
        }
        break
      
      // 跳过这些事件（元数据事件）
      case 'response.created':
      case 'response.output_item.added':
      case 'response.output_item.done':
      case 'response.content_part.added':
      case 'response.output_text.done':
        return null
      
      default:
        // 未知事件类型
        console.warn(`[CodexResponseTransformer] Unknown event type: ${codexEvent.type}`)
        return null
    }
    
    return openaiChunk
  }
  
  /**
   * 转换非流式响应
   * @param codexResponse - Codex 完整响应
   * @returns OpenAI Chat Completions response
   */
  transformNonStream(codexResponse: any): any {
    // 提取输出文本
    let content = ''
    
    if (codexResponse.output && Array.isArray(codexResponse.output)) {
      // 合并所有 output_text
      for (const item of codexResponse.output) {
        if (item.type === 'message' && item.content) {
          for (const contentItem of item.content) {
            if (contentItem.type === 'output_text' && contentItem.text) {
              content += contentItem.text
            }
          }
        }
      }
    }
    
    // 构建 OpenAI 响应
    return {
      id: codexResponse.id || `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: codexResponse.model || 'gpt-5',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: content
        },
        finish_reason: codexResponse.status === 'completed' ? 'stop' : 'length'
      }],
      usage: codexResponse.usage ? {
        prompt_tokens: codexResponse.usage.input_tokens || 0,
        completion_tokens: codexResponse.usage.output_tokens || 0,
        total_tokens: codexResponse.usage.total_tokens || 0
      } : undefined
    }
  }
}
