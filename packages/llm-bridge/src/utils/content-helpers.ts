import type { MessageContent } from '../types/message'

/**
 * Convert message content to string
 * Used by response builders to convert IR content to provider format
 *
 * @param content - Message content (string or ContentPart array)
 * @returns String content or null if empty
 */
export function contentToString(content: MessageContent): string | null {
  if (typeof content === 'string') {
    return content || null
  }

  if (!content || content.length === 0) {
    return null
  }

  // Concatenate text parts only
  return content
    .filter((part) => part.type === 'text')
    .map((part) => (part.type === 'text' ? part.text : ''))
    .join('') || null
}

/**
 * Check if content contains only text
 * @param content - Message content
 * @returns True if content is string or contains only text parts
 */
export function isTextOnlyContent(content: MessageContent): boolean {
  if (typeof content === 'string') {
    return true
  }

  return content.every((part) => part.type === 'text')
}

/**
 * Extract text from content
 * @param content - Message content
 * @returns Array of text strings
 */
export function extractTextFromContent(content: MessageContent): string[] {
  if (typeof content === 'string') {
    return [content]
  }

  return content
    .filter((part) => part.type === 'text')
    .map((part) => (part.type === 'text' ? part.text : ''))
}

/**
 * Check if content has images
 * @param content - Message content
 * @returns True if content contains image parts
 */
export function hasImageContent(content: MessageContent): boolean {
  if (typeof content === 'string') {
    return false
  }

  return content.some((part) => part.type === 'image')
}
