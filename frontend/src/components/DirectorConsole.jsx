import { useState } from 'react'

export default function DirectorConsole({ onSend, messages }) {
  const [input, setInput] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!input.trim()) return
    onSend(input.trim())
    setInput('')
  }

  const quickCommands = [
    "Iniciar validación de continuidad",
    "Generar storyboard de escena crítica",
    "Auditar estado del enjambre DAG"
  ]

  return (
    <div className="bg-[#121214]/90 backdrop-blur-2xl border border-white/[0.08] rounded-2xl p-5 flex flex-col h-full shadow-2xl transition-all">
      {/* Cabecera de telemetría */}
      <div className="flex items-center justify-between mb-3 text-[11px] font-mono text-stone-400 pb-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-stone-200 font-semibold tracking-wider">DIRECTOR TERMINAL</span>
        </div>
        <span className="text-stone-500">Gemini 3.1 Core</span>
      </div>

      {/* Botones de comandos rápidos (Atajos de director) */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {quickCommands.map((cmd, idx) => (
          <button
            key={idx}
            onClick={() => onSend(cmd)}
            className="text-[10px] font-mono bg-white/[0.03] hover:bg-white/[0.08] text-stone-300 border border-white/[0.06] hover:border-white/15 px-2.5 py-1 rounded-lg transition-all text-left truncate max-w-[200px]"
          >
            + {cmd}
          </button>
        ))}
      </div>

      {/* Historial de comandos y respuestas */}
      <div className="flex-1 overflow-y-auto space-y-2.5 mb-3 min-h-[140px] pr-1 scrollbar-thin">
        {messages.map((m, i) => (
          <div key={i} className={`animate-fade-in font-mono text-xs ${m.role === 'director' ? 'text-right' : 'text-left'}`}>
            <div className="text-[9px] text-stone-500 mb-0.5 uppercase tracking-wider">
              {m.role === 'director' ? 'Director Directive' : 'Autonomous Agent Swarm'}
            </div>
            <span
              className={`inline-block px-3.5 py-2 rounded-xl text-xs max-w-[90%] leading-relaxed transition-all shadow-sm ${
                m.role === 'director'
                  ? 'bg-white/[0.08] text-stone-100 border border-white/15'
                  : 'bg-black/60 text-stone-300 border border-white/[0.06]'
              }`}
            >
              {m.text}
            </span>
          </div>
        ))}
      </div>

      {/* Formulario de entrada */}
      <form onSubmit={handleSubmit} className="flex gap-2 pt-2 border-t border-white/[0.06]">
        <div className="relative flex-1">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-stone-500 text-xs">&gt;</span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe una directiva para el agente..."
            className="w-full bg-black/70 border border-white/[0.1] rounded-xl pl-8 pr-4 py-3 text-xs font-mono text-stone-100 placeholder:text-stone-600 focus:outline-none focus:border-white/30 focus:ring-2 focus:ring-white/10 transition-all shadow-inner"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-3 bg-white text-stone-950 font-sans font-medium text-xs rounded-xl hover:bg-stone-200 transition-all active:scale-[0.98] shadow-lg cursor-pointer"
        >
          Transmit
        </button>
      </form>
    </div>
  )
}
