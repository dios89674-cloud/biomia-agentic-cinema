import { useState } from 'react'

export default function DirectorConsole({ onSend, messages, isThinking }) {
  const [input, setInput] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!input.trim() || isThinking) return
    onSend(input.trim())
    setInput('')
  }

  return (
    <div className="grain-panel border border-gold-600/15 rounded-lg p-5 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4 text-xs text-stone-400">
        <span>💬 Director Console · Gemini Agent</span>
        <span className="flex items-center gap-1 text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Backend connected
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 mb-4 min-h-[120px]">
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'director' ? 'text-right' : ''}>
            <span
              className={`inline-block px-3 py-2 rounded-lg text-sm max-w-[85%] ${
                m.role === 'director'
                  ? 'bg-gold-600/20 text-gold-200'
                  : 'bg-reel-900 text-stone-300'
              }`}
            >
              {m.text}
            </span>
          </div>
        ))}
        {isThinking && (
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-reel-900 text-stone-400">
              <span className="w-1.5 h-1.5 rounded-full bg-gold-400 animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-gold-400 animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-gold-400 animate-bounce" />
              <span className="ml-1">Gemini is thinking...</span>
            </span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isThinking}
          placeholder="Describe a new scene (e.g. 'A detective enters a foggy alley...')"
          className="flex-1 bg-reel-900 border border-gold-600/20 rounded px-3 py-2 text-sm text-stone-200 placeholder:text-stone-600 focus:outline-none focus:border-gold-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isThinking}
          className="px-4 py-2 bg-gold-600 hover:bg-gold-500 disabled:opacity-40 disabled:cursor-not-allowed text-reel-950 font-medium text-sm rounded transition-colors"
        >
          {isThinking ? '...' : 'Send'}
        </button>
      </form>
    </div>
  )
}
