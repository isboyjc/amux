/**
 * Slug generation and validation utilities for provider passthrough proxy paths
 */

/**
 * Generate a URL-friendly slug from a provider name and adapter type
 * 
 * Rules:
 * - Converts to lowercase
 * - Removes content in parentheses
 * - Keeps only letters, numbers, spaces, and hyphens
 * - Converts spaces/underscores to hyphens
 * - Removes consecutive hyphens
 * - Removes leading/trailing hyphens
 * - Falls back to adapter type if result is empty (e.g., for Chinese names)
 * 
 * Examples:
 * - "OpenAI Personal" → "openai-personal"
 * - "OpenAI (Responses API)" → "openai-responses-api" (removes parentheses content)
 * - "通义千问" → "qwen" (uses adapter type as fallback)
 * - "My_Custom Provider" → "my-custom-provider"
 */
export function generateSlug(name: string, adapterType: string): string {
  let slug = name.toLowerCase()
  
  // Remove content in parentheses
  slug = slug.replace(/\([^)]*\)/g, '')
  
  // Keep only alphanumeric, spaces, hyphens, underscores
  slug = slug.replace(/[^\w\s-]/g, '')
  
  // Convert spaces and underscores to hyphens
  slug = slug.replace(/[\s_]+/g, '-')
  
  // Merge consecutive hyphens
  slug = slug.replace(/-+/g, '-')
  
  // Remove leading and trailing hyphens
  slug = slug.replace(/^-+|-+$/g, '')
  
  // If empty (e.g., Chinese characters only), use adapter type
  if (!slug) {
    slug = adapterType.toLowerCase()
  }
  
  return slug
}

/**
 * Ensure slug uniqueness by appending a counter if needed
 * 
 * @param baseSlug - The base slug to start with
 * @param existingSlugs - Array of slugs already in use
 * @returns A unique slug
 * 
 * Examples:
 * - ensureUniqueSlug("openai", ["openai"]) → "openai-2"
 * - ensureUniqueSlug("openai", ["openai", "openai-2"]) → "openai-3"
 */
export function ensureUniqueSlug(
  baseSlug: string,
  existingSlugs: string[]
): string {
  let slug = baseSlug
  let counter = 2
  
  while (existingSlugs.includes(slug)) {
    slug = `${baseSlug}-${counter}`
    counter++
  }
  
  return slug
}

/**
 * Validate slug format
 * 
 * Rules:
 * - Not empty
 * - Only lowercase letters, numbers, and hyphens
 * - Length between 2 and 50 characters
 * - Cannot start or end with a hyphen
 * 
 * @param slug - The slug to validate
 * @returns Validation result with error message if invalid
 */
export function validateSlug(slug: string): {
  valid: boolean
  error?: string
} {
  if (!slug) {
    return { valid: false, error: '路径不能为空' }
  }
  
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return { 
      valid: false, 
      error: '只能包含小写字母、数字和连字符'
    }
  }
  
  if (slug.length < 2 || slug.length > 50) {
    return { 
      valid: false, 
      error: '长度必须在 2-50 字符之间'
    }
  }
  
  if (slug.startsWith('-') || slug.endsWith('-')) {
    return { 
      valid: false, 
      error: '不能以连字符开头或结尾'
    }
  }
  
  return { valid: true }
}

/**
 * Generate a unique slug for a provider
 * 
 * This combines slug generation, validation, and uniqueness checking
 * 
 * @param name - Provider name
 * @param adapterType - Provider adapter type
 * @param existingSlugs - Array of slugs already in use
 * @returns A valid, unique slug
 */
export function generateUniqueSlug(
  name: string,
  adapterType: string,
  existingSlugs: string[]
): string {
  const baseSlug = generateSlug(name, adapterType)
  return ensureUniqueSlug(baseSlug, existingSlugs)
}
