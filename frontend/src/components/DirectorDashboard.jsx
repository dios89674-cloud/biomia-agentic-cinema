import { useEffect, useState } from 'react'
import Sidebar from './Sidebar.jsx'
import StatCard from './StatCard.jsx'
import PipelineBoard from './PipelineBoard.jsx'
import DirectorConsole from './DirectorConsole.jsx'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080'

export default function DirectorDashboard() {
  const [active, setActive] = useState('pipeline')
  const [scenesByStage, setScenesByStage] = useState({})
  const [messages, setMessages] = useState([
    { role: 'agent', text: "Director's Core online. Neural agent swarm standing by." },
  ])
  const [health, setHealth] = useState(null)

  useEffect(() => {
    fetch(`${API_BASE}/health`)
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth({ status: 'unreachable' }))

    fetchScenes()
    const interval = setInterval(fetchScenes, 5000)
    return () => clearInterval(interval)
  }, [])

  const fetchScenes = async () => {
    try {
      const res = await fetch(`${API_BASE}/scenes`)
      const data = await res.json()
      const grouped = { script: [], preprod: [], shoot: [], postprod: [] }
      for (const scene of data.scenes || []) {
        if (grouped[scene.stage]) grouped[scene.stage].push(scene)
      }
      setScenesByStage(grouped)
    } catch {}
  }

  const sendCommand = async (text) => {
    setMessages((prev) => [...prev, { role: 'director', text }])
    try {
      const res = await fetch(`${API_BASE}/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: text }),
      })
      const data = await res.json()
      setMessages((prev) => [
        ...prev,
        {
          role: 'agent',
          text: `Scene ${data.scene_id}: dispatched [${(data.dispatched_stages || []).join(', ') || 'none'}].`,
        },
      ])
      fetchScenes()
    } catch {
      setMessages((prev) => [...prev, { role: 'agent', text: 'Telemetry link offline.' }])
    }
  }

  const totalScenes = Object.values(scenesByStage).flat().length

  const renderMainContent = () => {
    switch (active) {
      case 'pipeline':
        return (
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2">
              <PipelineBoard scenesByStage={scenesByStage} />
            </div>
            <div className="col-span-1">
              <DirectorConsole messages={messages} onSend={sendCommand} />
            </div>
          </div>
        )
      case 'agents':
        return (
          <div className="max-w-5xl space-y-4">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-mono tracking-widest text-stone-500 uppercase">Neural Swarm Telemetry // DAG Topology</span>
              <span className="text-[11px] font-mono text-stone-300">6 Nodes Active</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { name: 'Script Agent', role: 'Contextual screenplay structuring & narrative logic', engine: 'Gemini 3.1 Pro', latency: '142ms', load: '12%' },
                { name: 'Storyboard Agent', role: 'Multi-modal semantic frame interpretation', engine: 'Gemini 3.1 Flash', latency: '98ms', load: '38%' },
                { name: 'Casting Agent', role: 'Actor asset verification & continuity index', engine: 'Vertex AI Agent', latency: '210ms', load: '4%' },
                { name: 'Edit Agent', role: 'Automated temporal timeline cuts & sequencing', engine: 'ADK Core Pipeline', latency: '75ms', load: '0%' },
                { name: 'VFX Agent', role: 'Pixel-level composition & element tracking', engine: 'Multimodal Vision', latency: '310ms', load: '84%' },
                { name: 'Continuity Agent', role: 'Zero-latency fact-checking via analytical store', engine: 'ClickHouse MCP', latency: '18ms', load: '22%' },
              ].map((agent, i) => (
                <div key={i} className="group relative p-5 bg-[#121214]/80 backdrop-blur-2xl border border-white/[0.08] hover:border-white/20 rounded-2xl transition-all duration-300 flex flex-col justify-between shadow-2xl">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-sans font-medium text-sm text-stone-100 tracking-tight">{agent.name}</h3>
                      <span className="font-mono text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Operational</span>
                    </div>
                    <p className="text-xs text-stone-400 font-sans leading-relaxed mb-4">{agent.role}</p>
                  </div>
                  <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between font-mono text-[11px] text-stone-500">
                    <span className="text-stone-400">{agent.engine}</span>
                    <div className="flex items-center gap-3">
                      <span>Lat: {agent.latency}</span>
                      <span className="text-stone-300">Load: {agent.load}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      case 'clickhouse':
        return (
          <div className="max-w-4xl p-8 bg-[#121214]/80 backdrop-blur-2xl border border-white/[0.08] rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between pb-6 border-b border-white/[0.06] mb-6">
              <div>
                <h2 className="font-sans font-medium text-base text-stone-100 tracking-tight">ClickHouse Analytical Engine</h2>
                <p className="text-xs text-stone-400 mt-0.5">Secure bridging via Model Context Protocol (MCP)</p>
              </div>
              <span className="font-mono text-[11px] px-3 py-1 rounded-full bg-white/[0.06] text-stone-200 border border-white/10">Encrypted Tunnel</span>
            </div>
            <div className="space-y-6 font-mono text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-black/50 border border-white/[0.06]">
                  <div className="text-stone-500 mb-1">PROXIED ENDPOINT</div>
                  <div className="text-stone-300 truncate">clickhouse://mcp-secure-proxy:9000</div>
                </div>
                <div className="p-4 rounded-xl bg-black/50 border border-white/[0.06]">
                  <div className="text-stone-500 mb-1">PROTOCOL SPEC</div>
                  <div className="text-stone-300">MCP v1.2 // Zero-Trust Isolation</div>
                </div>
              </div>
              <div className="p-5 rounded-xl bg-black/50 border border-white/[0.06]">
                <div className="text-stone-500 mb-3 tracking-wider">INDEXED SCHEMAS & ENTITIES</div>
                <div className="grid grid-cols-2 gap-3 text-stone-300">
                  <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-stone-300" /><code>scene_facts</code></div>
                  <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-stone-300" /><code>character_registry</code></div>
                  <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-stone-300" /><code>vfx_audit_logs</code></div>
                  <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-stone-300" /><code>continuity_breaks</code></div>
                </div>
              </div>
            </div>
          </div>
        )
      case 'tools':
        return (
          <div className="max-w-4xl grid grid-cols-2 gap-6">
            <div className="p-6 bg-[#121214]/80 backdrop-blur-2xl border border-white/[0.08] rounded-2xl flex flex-col justify-between shadow-2xl">
              <div>
                <h3 className="font-sans font-medium text-sm text-stone-100 tracking-tight mb-1">Synthetic Pipeline Dispatcher</h3>
                <p className="text-xs text-stone-400 font-sans leading-relaxed mb-6">Inyecta una secuencia de prueba automatizada directamente al DAG del orquestador.</p>
              </div>
              <button 
                onClick={() => sendCommand("Crea una nueva escena de ciencia ficción llamada elite_demo_01 y arranca el pipeline")}
                className="w-full py-3 px-4 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-stone-100 border border-white/10 font-mono text-xs transition-all duration-200 text-center active:scale-[0.99]"
              >
                Execute Synthetic Sequence →
              </button>
            </div>
            <div className="p-6 bg-[#121214]/80 backdrop-blur-2xl border border-white/[0.08] rounded-2xl flex flex-col justify-between shadow-2xl">
              <div>
                <h3 className="font-sans font-medium text-sm text-stone-100 tracking-tight mb-1">Cloud Run Infrastructure Node</h3>
                <p className="text-xs text-stone-400 font-sans leading-relaxed mb-4">Estado del clúster de servicios en región us-central1.</p>
              </div>
              <div className="space-y-2 font-mono text-[11px] bg-black/50 p-4 rounded-xl border border-white/[0.06]">
                <div className="text-stone-400 truncate"><span className="text-stone-600">URL:</span> {API_BASE}</div>
                <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                  <span className="text-stone-600">Status</span>
                  <span className="text-emerald-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {health?.status || 'connecting...'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="flex h-screen bg-[#09090b] text-stone-100 selection:bg-white/20 selection:text-white">
      <Sidebar active={active} onSelect={setActive} />

      <main className="flex-1 overflow-y-auto">
        <div className="p-10">
          <header className="flex items-center justify-between mb-10 pb-6 border-b border-white/[0.08]">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-white/10 to-transparent border border-white/15 flex items-center justify-center text-lg shadow-2xl">
                🎬
              </div>
              <div>
                <h1 className="font-sans font-semibold text-lg text-stone-100 tracking-tight">
                  Agentic Cinema <span className="text-stone-500 font-normal">/ Director&rsquo;s Suite</span>
                </h1>
                <p className="text-xs text-stone-400 font-mono mt-0.5">Project: biomia-agentic-cinema-2026</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge>Gemini 3.1</Badge>
              <Badge>Vertex AI</Badge>
              <Badge>ClickHouse MCP</Badge>
              <div className="h-4 w-[1px] bg-white/10 mx-1" />
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-mono ${
                health?.status === 'ok'
                  ? 'border-emerald-500/20 bg-emerald-500/[0.05] text-emerald-400'
                  : 'border-red-500/20 bg-red-500/[0.05] text-red-400'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full bg-current ${health?.status === 'ok' ? 'animate-pulse' : ''}`} />
                {health?.status === 'ok' ? 'System Nominal' : 'Offline'}
              </div>
            </div>
          </header>

          <div className="grid grid-cols-4 gap-5 mb-8">
            <StatCard icon="🎞️" label="Scenes Tracked" value={totalScenes} />
            <StatCard icon="👥" label="Active Agents" value="6" trend="Script · Storyboard · Casting · Edit · VFX · Continuity" />
            <StatCard icon="📊" label="ClickHouse" value="live" unit="via MCP" />
            <StatCard icon="⚙️" label="Orchestrator" value="ADK" unit="DAG mode" />
          </div>

          {renderMainContent()}
        </div>
      </main>
    </div>
  )
}

function Badge({ children }) {
  return (
    <span className="px-3 py-1 rounded-full border border-white/10 text-stone-300 bg-white/[0.02] font-mono text-[11px] tracking-tight">
      {children}
    </span>
  )
}
