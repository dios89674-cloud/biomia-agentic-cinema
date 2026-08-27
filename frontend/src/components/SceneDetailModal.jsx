import { useEffect, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080'

function safeParse(text) {
  if (!text) return null
  try {
    const cleaned = text.replace(/```json|```/g, '').trim()
    return JSON.parse(cleaned)
  } catch {
    return null
  }
}

export default function SceneDetailModal({ sceneId, onClose }) {
  const [scene, setScene] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!sceneId) return
    let cancelled = false
    setLoading(true)
    setScene(null)
    fetch(`${API_BASE}/scenes/${sceneId}`)
      .then((r) => r.json())
      .then((data) => {
        // Guard against race conditions: if the user clicked a different
        // scene before this fetch resolved, discard this stale response.
        if (!cancelled) setScene(data)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [sceneId])

  if (!sceneId) return null

  const results = scene?.results || {}
  const script = safeParse(results.script)
  const storyboard = safeParse(results.storyboard)
  const casting = safeParse(results.casting)
  const vfx = safeParse(results.vfx)
  const continuity = safeParse(results.continuity)

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-6" onClick={onClose}>
      <div
        className="bg-reel-950 border border-gold-600/30 rounded-lg max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg text-gold-400">🎬 {sceneId}</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-200 text-xl leading-none">×</button>
        </div>

        {loading && <p className="text-stone-400 text-sm">Loading agent output...</p>}

        {!loading && continuity && (
          <div
            className={`mb-5 p-4 rounded-lg border-2 ${
              continuity.decision === 'blocked'
                ? 'bg-red-950/40 border-red-500/50'
                : 'bg-emerald-950/40 border-emerald-500/50'
            }`}
          >
            <div className={`text-sm font-bold mb-1 ${continuity.decision === 'blocked' ? 'text-red-400' : 'text-emerald-400'}`}>
              {continuity.decision === 'blocked' ? '🚨 BLOCKED by Continuity Agent' : '✅ APPROVED by Continuity Agent'}
            </div>
            <p className="text-sm text-stone-300">{continuity.reason}</p>
            {continuity.mismatches?.length > 0 && (
              <ul className="mt-2 space-y-1">
                {continuity.mismatches.map((m, i) => (
                  <li key={i} className="text-xs text-stone-400">
                    • <span className="text-stone-200">{m.character}</span> — {m.type}: expected "{m.expected}", found "{m.found ?? 'nothing'}" ({m.stage})
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {!loading && script && (
          <Section title="📝 Script Agent">
            <Row label="Location">{script.location}</Row>
            <Row label="Characters">{script.characters?.join(', ')}</Row>
            <Row label="Props">{script.props?.join(', ')}</Row>
            {script.wardrobe?.map((w, i) => (
              <Row key={i} label={`Wardrobe — ${w.character}`}>{w.description}</Row>
            ))}
          </Section>
        )}

        {!loading && storyboard?.shots && (
          <Section title="🎨 Storyboard Agent">
            {storyboard.shots.map((s) => (
              <div key={s.shot_number} className="text-sm text-stone-300 mb-2">
                <span className="text-gold-400 font-medium">Shot {s.shot_number}</span> — {s.angle}, {s.framing}
                <p className="text-stone-400 text-xs mt-0.5">{s.description}</p>
              </div>
            ))}
          </Section>
        )}

        {!loading && casting?.characters && (
          <Section title="🎭 Casting Agent">
            {casting.characters.map((c, i) => (
              <Row key={i} label={c.name}>{c.suggested_attributes?.join(', ')}</Row>
            ))}
          </Section>
        )}

        {!loading && vfx?.shots && (
          <Section title="✨ VFX Agent">
            {vfx.shots.map((s) => (
              <Row key={s.shot_number} label={`Shot ${s.shot_number}`}>
                {s.complexity} complexity, {s.cost_multiplier}x cost
              </Row>
            ))}
          </Section>
        )}

        {!loading && !script && !storyboard && (
          <p className="text-stone-500 text-sm italic">This scene hasn't generated any agent output yet.</p>
        )}
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="mb-5">
      <h3 className="text-xs uppercase tracking-wide text-stone-400 mb-2">{title}</h3>
      <div className="bg-reel-900/60 rounded-lg p-3 border border-gold-600/10">{children}</div>
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div className="text-sm mb-1.5">
      <span className="text-stone-500">{label}:</span>{' '}
      <span className="text-stone-200">{children}</span>
    </div>
  )
}
