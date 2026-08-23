/**
 * P0 AI Assistant Output Sanitizer (Defense-in-depth)
 * Ensures that leaked tool calls, pseudo-markdown tool blocks, XML tool tags,
 * thinking processes, and system prompt delimiters are stripped before output.
 */

// Fenced tool invocation blocks: ```tool_call ... ```, ```tool_code ... ```, ```function_call ... ```
const FENCED_TOOL_BLOCK_REGEX =
  /`{3,}(?:tool_call|tool_code|function_call|tool)[\s\S]*?`{3,}/gi

// JSON fenced blocks that are purely tool calls: ```json {"tool":...} ``` or ``` {"tool":...} ```
const FENCED_JSON_TOOL_REGEX =
  /`{3,}(?:json)?\s*\{\s*["'](?:tool|function|action)["']\s*:\s*["'][^"']+["'][\s\S]*?\}\s*`{3,}/gi

// XML tool blocks: <tool_call>...</tool_call>, <tool_code>...</tool_code>, <function_call>...</function_call>, <tool>...</tool>
const XML_TOOL_BLOCK_REGEX =
  /<(?:tool_call|tool_code|function_call|tool)>[\s\S]*?<\/(?:tool_call|tool_code|function_call|tool)>/gi

// Unclosed XML tool tags at the end or start
const UNCLOSED_XML_TOOL_TAGS =
  /<\/?(?:tool_call|tool_code|function_call|tool)[^>]*>/gi

// Reasoning / thinking blocks
const THINKING_BLOCK_REGEX =
  /<(?:think|thought)>[\s\S]*?<\/(?:think|thought)>/gi

const FENCED_THINKING_REGEX =
  /`{3,}(?:thinking|reasoning|scratchpad)[\s\S]*?`{3,}/gi

// System / delimiter tags
const SYSTEM_DELIMITERS_REGEX =
  /\[(?:USER DATA START|USER DATA END|UNTRUSTED USER DATA START|UNTRUSTED USER DATA END|UNTRUSTED_EXTERNAL_CONTENT|UNTRUSTED_EXTERNAL_CONTENT_START|UNTRUSTED_EXTERNAL_CONTENT_END)\]?/gi

/**
 * Sanitizes assistant output by removing all tool call artifacts,
 * thinking tokens, and server delimiters.
 */
export function sanitizeAssistantOutput(content: string): string {
  if (!content || typeof content !== 'string') {
    return ''
  }

  let text = content

  // 1. Strip thinking & reasoning blocks
  text = text.replace(THINKING_BLOCK_REGEX, '')
  text = text.replace(FENCED_THINKING_REGEX, '')
  text = text.replace(
    /^(?:Here'?s a thinking process|Thinking Process|Chain of thought|Internal Reasoning):?[\s\S]*?(?=(?:\n\n[A-Z0-9ŠĮŲĖČĄŽ]|(?:\n\n[#*-])|\n\nŠtai|\n\nSveiki|\n\nLabas|$))/i,
    '',
  )

  // 2. Strip fenced tool blocks
  text = text.replace(FENCED_TOOL_BLOCK_REGEX, '')
  text = text.replace(FENCED_JSON_TOOL_REGEX, '')

  // 3. Strip XML tool tags and blocks
  text = text.replace(XML_TOOL_BLOCK_REGEX, '')
  text = text.replace(UNCLOSED_XML_TOOL_TAGS, '')

  // 4. Strip system delimiter markers
  text = text.replace(SYSTEM_DELIMITERS_REGEX, '')

  // 5. Clean up excessive whitespace
  text = text.replace(/\n{3,}/g, '\n\n').trim()

  return text
}

/**
 * Checks whether the raw output contained leaked tool call syntax or artifacts.
 */
export function containsLeakedToolSyntax(content: string): boolean {
  if (!content || typeof content !== 'string') return false
  return (
    FENCED_TOOL_BLOCK_REGEX.test(content) ||
    FENCED_JSON_TOOL_REGEX.test(content) ||
    XML_TOOL_BLOCK_REGEX.test(content) ||
    UNCLOSED_XML_TOOL_TAGS.test(content)
  )
}
