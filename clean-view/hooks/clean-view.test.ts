import { expect, test } from 'claude-code/testing'

import { describe } from './register'

test('tool calls read as plain steps', async () => {
  expect(describe('Bash', { command: 'npm test', description: 'Run tests' })).toBe('Run tests')
  expect(describe('Edit', { file_path: '/repo/src/app.ts' })).toBe('Editing app.ts')
  expect(describe('Grep', { pattern: 'foo' })).toBe('Searching the code')
  expect(describe('mcp__github__get_me', {})).toBe('Using github')
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`a finished tool row draws nothing on ${surface}`, async $ => {
    const row = await $.ui.mount({
      plugin: 'clean-view',
      surface,
      component: 'ToolResult',
      requestId: 't1',
      props: { tool_use_id: 't1', tool: 'Bash', output: { stdout: 'lots of output' }, isErrored: false },
    })

    expect(JSON.stringify(await row.drawn())).not.toContain('lots of output')
  })
}
