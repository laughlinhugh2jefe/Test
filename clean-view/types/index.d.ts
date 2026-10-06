export type Step = string | null

declare module 'claude-code' {
  interface PluginState {
    'clean-view': { now: Step; summary: Step; isOff: boolean }
  }
}
