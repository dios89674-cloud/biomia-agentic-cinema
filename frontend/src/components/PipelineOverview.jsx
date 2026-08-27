const STAGES = [
  { id: 'script', label: 'Script', icon: '📄' },
  { id: 'storyboard', label: 'Storyboard', icon: '🎨' },
  { id: 'casting', label: 'Casting', icon: '🎭' },
  { id: 'edit', label: 'Edit', icon: '✂️' },
  { id: 'vfx', label: 'VFX', icon: '✨' },
  { id: 'continuity', label: 'Continuity', icon: '🔍' },
]

export default function PipelineOverview({ allScenes }) {
  const countFor = (stage) =>
    allScenes.filter((s) => (s.completed_stages || []).includes(stage)).length

  return (
    <div className="grain-panel border border-gold-600/15 rounded-lg p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs uppercase tracking-wide text-stone-400">Pipeline Overview</span>
        <span className="text-xs text-stone-500">{allScenes.length} scene{allScenes.length === 1 ? '' : 's'} tracked</span>
      </div>
      <div className="flex items-center overflow-x-auto pb-1">
        {STAGES.map((stage, i) => {
          const count = countFor(stage.id)
          const active = count > 0
          return (
            <div key={stage.id} className="flex items-center shrink-0">
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                  active
                    ? 'bg-gold-600/10 border-gold-600/40 text-gold-300'
                    : 'bg-reel-900/60 border-stone-700 text-stone-500'
                }`}
              >
                <span className="text-base">{stage.icon}</span>
                <div className="leading-tight">
                  <div className="text-xs font-medium">{stage.label}</div>
                  <div className="text-[10px] opacity-70">{count} scene{count === 1 ? '' : 's'}</div>
                </div>
              </div>
              {i < STAGES.length - 1 && (
                <div className={`w-6 h-0.5 mx-1 ${active ? 'bg-gold-600/40' : 'bg-stone-700'}`} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
