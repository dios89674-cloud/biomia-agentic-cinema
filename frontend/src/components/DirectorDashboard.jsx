import { useEffect, useState } from 'react'
import Sidebar from './Sidebar.jsx'
import StatCard from './StatCard.jsx'
import PipelineBoard from './PipelineBoard.jsx'
import DirectorConsole from './DirectorConsole.jsx'
import UploadFootage from './UploadFootage.jsx'
import PipelineOverview from './PipelineOverview.jsx'
import SceneDetailModal from './SceneDetailModal.jsx'
import ClickHousePanel from './ClickHousePanel.jsx'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080'

// The 6 real agents in the pipeline. Everything here is a static fact about
// the system (name, role, model, which stage it corresponds to) — NOT a
// fabricated metric. Live counts are computed from real Firestore data in
// fetchScenes() and merged in below.
const AGENT_DEFS = [
  { stage: 'script', name: 'Script Agent', role: 'Extracts characters, props, wardrobe, and location from scene text.' },
  { stage: 'storyboard', name: 'Storyboard Agent', role: 'Generates shot-by-shot framing and camera direction.' },
  { stage: 'casting', name: 'Casting Agent', role: 'Suggests actor attributes based on script requirements.' },
  { stage: 'edit', name: 'Edit Agent', role: 'Proposes cut order and pacing once footage is uploaded.' },
  { stage: 'vfx', name: 'VFX Agent', role: 'Flags shots needing visual effects and estimates cost.' },
  { stage: 'continuity', name: 'Continuity Agent', role: 'Queries ClickHouse via MCP to catch continuity breaks; can block the pipeline.' },
]
const MODEL_NAME = 'gemini-3.6-flash'

export default function DirectorDashboard() {
  const [active, setActive] = useState('pipeline')
  const [selectedSceneId, setSelectedSceneId] = useState(null)
  const [isThinking, setIsThinking] = useState(false)
  const [allScenes, setAllScenes] = useState([])
  const [scenesByStage, setScenesByStage] = useState({ script: [], preprod: [], shoot: [], postprod: [] })
  const [messages, setMessages] = useState([
    { role: 'agent', text: "Ready, director. Describe a scene to get started — for example: \"A masked thief cracks open a vault...\"" },
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
      const scenes = data.scenes || []
      setAllScenes(scenes)

      const grouped = { script: [], preprod: [], shoot: [], postprod: [] }
      for (const scene of scenes) {
        if (grouped[scene.stage]) grouped[scene.stage].push(scene)
      }
      setScenesByStage(grouped)
    } catch {
      // Backend unreachable — leave existing state as-is rather than
      // substitute fake data. The health badge already signals this.
    }
  }

  const summarizeStage = (stage, resultText) => {
    if (!resultText) return null
    let parsed
    try {
      parsed = JSON.parse(resultText.replace(/```json|```/g, '').trim())
    } catch {
      return null
    }

    switch (stage) {
      case 'script':
        return `📝 Script — ${parsed.characters?.join(', ') || 'no characters'} · props: ${parsed.props?.join(', ') || 'none'} · ${parsed.location || 'unknown location'}`
      case 'storyboard':
        return `🎨 Storyboard — ${parsed.shots?.length || 0} shots. First: "${parsed.shots?.[0]?.description || '—'}"`
      case 'casting':
        return `🎭 Casting — ${parsed.characters?.map((c) => c.name).join(', ') || 'no suggestions'}`
      case 'edit':
        return `✂️ Edit — ${parsed.cut_order?.length || 0} cuts ordered. ${parsed.pacing_notes || ''}`
      case 'vfx':
        return `✨ VFX — ${parsed.shots?.length || 0} shots flagged for effects`
      case 'continuity':
        return parsed.decision === 'blocked'
          ? `🚨 Continuity — BLOCKED: ${parsed.reason}`
          : `✅ Continuity — APPROVED: ${parsed.reason}`
      default:
        return null
    }
  }

  const sendCommand = async (text) => {
    setMessages((prev) => [...prev, { role: 'director', text }])
    setIsThinking(true)
    try {
      const res = await fetch(`${API_BASE}/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: text }),
      })
      const data = await res.json()
      const dispatched = data.dispatched_stages || []

      if (dispatched.length === 0) {
        setMessages((prev) => [...prev, { role: 'agent', text: `Scene ${data.scene_id} created, but no stages ran yet.` }])
      } else {
        // Pull the real generated content for each stage that just ran,
        // instead of only announcing that something happened.
        const sceneRes = await fetch(`${API_BASE}/scenes/${data.scene_id}`)
        const scene = await sceneRes.json()
        const summaries = dispatched
          .map((stage) => summarizeStage(stage, scene.results?.[stage]))
          .filter(Boolean)

        setMessages((prev) => [
          ...prev,
          { role: 'agent', text: `Scene ${data.scene_id} — ${dispatched.join(' → ')}` },
          ...summaries.map((text) => ({ role: 'agent', text })),
        ])
      }
      fetchScenes()
    } catch {
      setMessages((prev) => [...prev, { role: 'agent', text: 'Could not reach the backend.' }])
    } finally {
      setIsThinking(false)
    }
  }

  const totalScenes = allScenes.length

  // Real count of how many scenes have actually passed through each stage —
  // derived from completed_stages in Firestore, not invented.
  const stageCount = (stage) =>
    allScenes.filter((s) => (s.completed_stages || []).includes(stage)).length

  const renderMainContent = () => {
    switch (active) {
      case 'pipeline':
        return (
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2">
              <PipelineOverview allScenes={allScenes} />
              <UploadFootage eligibleScenes={scenesByStage.preprod || []} onUploaded={fetchScenes} />
              <PipelineBoard scenesByStage={scenesByStage} onSceneClick={setSelectedSceneId} />
            </div>
            <div className="col-span-1">
              <DirectorConsole messages={messages} onSend={sendCommand} isThinking={isThinking} />
            </div>
          </div>
        )

      case 'agents':
        return (
          <div className="max-w-5xl space-y-4">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-mono tracking-widest text-stone-500 uppercase">Agent Swarm // DAG Topology</span>
              <span className="text-[11px] font-mono text-stone-300">{AGENT_DEFS.length} agents defined</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {AGENT_DEFS.map((agent) => {
                const count = stageCount(agent.stage)
                return (
                  <div key={agent.stage} className="group relative p-5 bg-[#121214]/80 backdrop-blur-2xl border border-white/[0.08] hover:border-white/20 rounded-2xl transition-all duration-300 flex flex-col justify-between shadow-2xl">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-sans font-medium text-sm text-stone-100 tracking-tight">{agent.name}</h3>
                        <span className="font-mono text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {count > 0 ? 'Has run' : 'Not run yet'}
                        </span>
                      </div>
                      <p className="text-xs text-stone-400 font-sans leading-relaxed mb-4">{agent.role}</p>
                    </div>
                    <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between font-mono text-[11px] text-stone-500">
                      <span className="text-stone-400">{MODEL_NAME}</span>
                      <span className="text-stone-300">{count} scene{count === 1 ? '' : 's'} completed</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )

      case 'clickhouse':
        return <ClickHousePanel />

      case 'tools':
        return (
          <div className="max-w-4xl grid grid-cols-2 gap-6">
            <div className="p-6 bg-[#121214]/80 backdrop-blur-2xl border border-white/[0.08] rounded-2xl flex flex-col justify-between shadow-2xl">
              <div>
                <h3 className="font-sans font-medium text-sm text-stone-100 tracking-tight mb-1">Test Pipeline Dispatch</h3>
                <p className="text-xs text-stone-400 font-sans leading-relaxed mb-6">Sends a real command to /commands and creates an actual scene in Firestore.</p>
              </div>
              <button
                onClick={() => sendCommand('A rival crew confronts our protagonist in a rain-soaked alley at midnight.')}
                className="w-full py-3 px-4 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-stone-100 border border-white/10 font-mono text-xs transition-all duration-200 text-center active:scale-[0.99]"
              >
                Dispatch Test Scene →
              </button>
            </div>
            <div className="p-6 bg-[#121214]/80 backdrop-blur-2xl border border-white/[0.08] rounded-2xl flex flex-col justify-between shadow-2xl">
              <div>
                <h3 className="font-sans font-medium text-sm text-stone-100 tracking-tight mb-1">Cloud Run Backend</h3>
                <p className="text-xs text-stone-400 font-sans leading-relaxed mb-4">Live status from the deployed service.</p>
              </div>
              <div className="space-y-2 font-mono text-[11px] bg-black/50 p-4 rounded-xl border border-white/[0.06]">
                <div className="text-stone-400 truncate"><span className="text-stone-600">URL:</span> {API_BASE}</div>
                <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                  <span className="text-stone-600">Status</span>
                  <span className={`flex items-center gap-1.5 ${health?.status === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full bg-current ${health?.status === 'ok' ? 'animate-pulse' : ''}`} />
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
                <p className="text-xs text-stone-400 font-mono mt-0.5">biomia-agentic-cinema-2026</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge>{MODEL_NAME}</Badge>
              <Badge>Google Cloud</Badge>
              <Badge>ClickHouse MCP</Badge>
              <div className="h-4 w-[1px] bg-white/10 mx-1" />
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-mono ${
                health?.status === 'ok'
                  ? 'border-emerald-500/20 bg-emerald-500/[0.05] text-emerald-400'
                  : 'border-red-500/20 bg-red-500/[0.05] text-red-400'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full bg-current ${health?.status === 'ok' ? 'animate-pulse' : ''}`} />
                {health?.status === 'ok' ? 'Backend Online' : 'Backend Offline'}
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

      <SceneDetailModal sceneId={selectedSceneId} onClose={() => setSelectedSceneId(null)} />
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
