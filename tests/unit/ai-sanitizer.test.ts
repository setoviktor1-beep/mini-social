import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeAssistantOutput, containsLeakedToolSyntax } from '../../lib/ai/security/sanitize-output'

describe('AI Assistant Output Sanitizer', () => {
  test('strips fenced ```tool_call blocks with json', () => {
    const raw = `Čia yra atsakymas.\n\`\`\`tool_call\n{"tool":"get_public_feed","limit":5}\n\`\`\`\nPapildomas tekstas.`
    const cleaned = sanitizeAssistantOutput(raw)
    assert.equal(cleaned, 'Čia yra atsakymas.\n\nPapildomas tekstas.')
    assert.ok(containsLeakedToolSyntax(raw))
    assert.ok(!containsLeakedToolSyntax(cleaned))
  })

  test('strips ```tool_code and ```function_call blocks', () => {
    const raw1 = `Pradžia\n\`\`\`tool_code\nsearch_public_services(query="remontas")\n\`\`\`\nPabaiga`
    assert.equal(sanitizeAssistantOutput(raw1), 'Pradžia\n\nPabaiga')

    const raw2 = `Rezultatas:\n\`\`\`function_call\n{"name":"get_my_profile"}\n\`\`\``
    assert.equal(sanitizeAssistantOutput(raw2), 'Rezultatas:')
  })

  test('strips XML <tool_call> tags', () => {
    const raw = `Atsakymas <tool_call>{"tool":"search_web","query":"test"}</tool_call> vartotojui.`
    assert.equal(sanitizeAssistantOutput(raw), 'Atsakymas  vartotojui.')
  })

  test('strips thinking and reasoning tags <think> and ```thinking', () => {
    const raw = `<think>Internal model reasoning trace here</think>Sveiki! Kaip galiu padėti?`
    assert.equal(sanitizeAssistantOutput(raw), 'Sveiki! Kaip galiu padėti?')
  })

  test('strips system delimiter tags', () => {
    const raw = `[USER DATA START]Some user input[USER DATA END]\nSveiki!`
    assert.equal(sanitizeAssistantOutput(raw), 'Some user input\nSveiki!')
  })

  test('preserves legitimate markdown code snippets (js, python, sql, text)', () => {
    const legitimate = `Štai pavyzdinis JavaScript kodas:\n\`\`\`javascript\nconsole.log("Sveikas pasauli!");\n\`\`\`\nSėkmės programuojant!`
    const cleaned = sanitizeAssistantOutput(legitimate)
    assert.equal(cleaned, legitimate)
    assert.ok(!containsLeakedToolSyntax(legitimate))
  })

  test('returns empty string if content is only tool calls', () => {
    const onlyTool = `\`\`\`tool_call\n{"tool":"search_web","query":"mini-social.online vartotojai"}\n\`\`\``
    const cleaned = sanitizeAssistantOutput(onlyTool)
    assert.equal(cleaned, '')
    assert.ok(containsLeakedToolSyntax(onlyTool))
  })
})
