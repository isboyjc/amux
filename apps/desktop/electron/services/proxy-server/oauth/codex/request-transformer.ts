/**
 * Codex Request Transformer
 * 转换 OpenAI 标准格式 → Codex 特殊格式
 */

export class CodexRequestTransformer {
  /**
   * 转换请求
   * @param openaiRequest - OpenAI 标准格式请求
   * @returns Codex 格式请求
   */
  transform(openaiRequest: any): any {
    const messages = openaiRequest.messages as Array<{role: string; content: string | any[]}>
    
    // 转换 messages → input
    const input = messages?.map((msg) => {
      // ✅ Codex content type depends on role:
      // - user/system → input_text
      // - assistant → output_text
      const contentType = msg.role === 'assistant' ? 'output_text' : 'input_text'
      
      return {
        type: 'message',
        role: msg.role,
        content: typeof msg.content === 'string' 
          ? [{ type: contentType, text: msg.content }]
          : this.transformMessageContent(msg.content, contentType)
      }
    }) || []
    
    // 构建 Codex 请求
    return {
      model: openaiRequest.model,
      stream: openaiRequest.stream !== false, // Default to true if not specified
      input,
      instructions: '', // Required by Codex
      store: false,     // Required by Codex
      // 保留其他字段（如 temperature, max_tokens 等）
      ...(openaiRequest.temperature !== undefined && { temperature: openaiRequest.temperature }),
      ...(openaiRequest.max_tokens !== undefined && { max_tokens: openaiRequest.max_tokens }),
      ...(openaiRequest.top_p !== undefined && { top_p: openaiRequest.top_p }),
      ...(openaiRequest.frequency_penalty !== undefined && { frequency_penalty: openaiRequest.frequency_penalty }),
      ...(openaiRequest.presence_penalty !== undefined && { presence_penalty: openaiRequest.presence_penalty }),
    }
  }
  
  /**
   * 转换消息内容（处理数组格式）
   */
  private transformMessageContent(content: any[], contentType: string): any[] {
    if (!Array.isArray(content)) {
      return [{ type: contentType, text: String(content) }]
    }
    
    return content.map(item => {
      if (typeof item === 'string') {
        return { type: contentType, text: item }
      }
      
      // 处理多模态内容（如图片）
      if (item.type === 'text') {
        return { type: contentType, text: item.text }
      }
      
      if (item.type === 'image_url') {
        // Codex 可能不支持图片，保持原样或跳过
        return { type: 'input_image', url: item.image_url?.url || item.url }
      }
      
      return item
    })
  }
}
