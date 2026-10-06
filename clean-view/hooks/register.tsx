import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

const now = atom({ plugin: 'clean-view', key: 'now' } as const, null)
const summary = atom({ plugin: 'clean-view', key: 'summary' } as const, null)
const isOff = atom({ plugin: 'clean-view', key: 'isOff' } as const, false)

const shorten = (text: string, max = 70) =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text

const fileName = (path: unknown) =>
  typeof path === 'string' ? (path.split('/').pop() ?? path) : 'a file'

// A plain-English line for one tool call.
export const describe = (tool: string, input: Record<string, unknown>) => {
  switch (tool) {
    case 'Bash':
      return typeof input.description === 'string'
        ? input.description
        : 'Running a command'
    case 'Read':
      return `Reading ${fileName(input.file_path)}`
    case 'Edit':
    case 'MultiEdit':
      return `Editing ${fileName(input.file_path)}`
    case 'Write':
      return `Writing ${fileName(input.file_path)}`
    case 'Grep':
    case 'Glob':
      return 'Searching the code'
    case 'WebSearch':
    case 'WebFetch':
      return 'Looking things up online'
    case 'Agent':
    case 'Task':
      return typeof input.description === 'string'
        ? input.description
        : 'Delegating a subtask'
    default:
      return tool.startsWith('mcp__')
        ? `Using ${tool.split('__')[1] ?? 'a connector'}`
        : `Using ${tool}`
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'clean-view',
      description: 'Turn the clean view on or off',
    })

    return next(e)
  })

  on('command.run', { command: 'clean-view' }, async $ => {
    const wasOff = await read($, isOff)
    await update($, isOff, () => !wasOff)

    return { text: wasOff ? 'Clean view on.' : 'Clean view off.' }
  })

  on('prompt.submit', async ($, e, next) => {
    await update($, now, () => 'Thinking')
    await update($, summary, () => null)

    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    const line = describe(e.tool, e as unknown as Record<string, unknown>)
    await update($, now, () => shorten(line))

    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) {
      return next(e)
    }

    await update($, now, () => null)
    const answer = e.answer.trim()

    if (e.isAborted || answer === '') {
      await update($, summary, () => (e.isAborted ? 'Stopped.' : null))

      return next(e)
    }

    if (answer.length <= 160) {
      await update($, summary, () => answer.replace(/\s+/g, ' '))

      return next(e)
    }

    const reply = await $.model.complete({
      model: 'haiku',
      effort: 'low',
      maxTokens: 80,
      system:
        'Summarize what the assistant did in one short plain sentence (under 20 words). No preamble.',
      prompt: answer.slice(0, 8000),
    })
    await update($, summary, () =>
      reply.isAnswered ? shorten(reply.text.trim(), 160) : null,
    )

    return next(e)
  })

  // Tool rows draw nothing, unless the call failed or the view is off.
  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    if (e.props.isErrored || (await read($, isOff))) {
      return next(e)
    }

    const { Box } = $.ui.resolve(e)

    return <Box />
  })

  on('ui.render', { component: 'ToolResult' }, async ($, e, next) => {
    if (e.props.isErrored || (await read($, isOff))) {
      return next(e)
    }

    const { Box } = $.ui.resolve(e)

    return <Box />
  })

  on('ui.render', { component: 'ToolGroup' }, async ($, e, next) => {
    if ((await read($, isOff))) {
      return next(e)
    }

    const { Box } = $.ui.resolve(e)

    return <Box />
  })

  on('ui.render', { component: 'ToolProgress' }, async ($, e, next) => {
    if ((await read($, isOff))) {
      return next(e)
    }

    const { Box } = $.ui.resolve(e)

    return <Box />
  })

  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    const step = await read($, now)

    if (step === null || (await read($, isOff))) {
      return next(e)
    }

    return next({ ...e, props: { ...e.props, message: step } })
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const done = await read($, summary)

    if (e.props.hasSurvey || e.props.isWorking || done === null || (await read($, isOff))) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box>
        <Text color="green">✓ </Text>
        <Text>{done}</Text>
      </Box>
    )
  })
}
