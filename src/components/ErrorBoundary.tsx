import { Component, type ReactNode } from 'react'

interface State { error: Error | null }

export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="max-w-md mx-auto p-6 pt-16 text-center space-y-4">
        <div className="text-4xl">😵</div>
        <h1 className="text-lg font-bold">Something went wrong</h1>
        <p className="text-sm text-gray-500 break-words">{this.state.error.message}</p>
        <p className="text-xs text-gray-400">Your logged food is safe — it's stored on this device.</p>
        <button
          onClick={() => { this.setState({ error: null }); location.reload() }}
          className="rounded-2xl bg-brand-600 text-white font-semibold px-6 py-3"
        >
          Reload app
        </button>
      </div>
    )
  }
}
