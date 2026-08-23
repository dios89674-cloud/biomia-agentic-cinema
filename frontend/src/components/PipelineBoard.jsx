const STAGE_META = {
  script: { label: 'Script', dot: 'bg-stone-400' },
  preprod: { label: 'Pre-Prod', dot: 'bg-stone-300' },
  shoot: { label: 'Shoot', dot: 'bg-emerald-400' },
  postprod: { label: 'Post-Prod', dot: 'bg-stone-200' },
}

export default function PipelineBoard({ scenesByStage }) {
  return (
    <div className="bg-[#121214]/80 backdrop-blur-2xl border border-white/[0.08] rounded-2xl p-6 shadow-2xl">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/[0.06]">
        <h2 className="font-sans font-medium text-base text-stone-100 tracking-tight">Production Pipeline</h2>
        <span className="text-[11px] font-mono text-stone-500">↻ live from Firestore</span>
      </div>
      <div className="grid grid-cols-2 gap-6">
        {Object.entries(STAGE_META).map(([key, meta]) => {
          const scenes = scenesByStage[key] || []
          return (
            <div key={key} className="p-4 rounded-xl bg-black/40 border border-white/[0.04]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                  <span className="text-xs font-mono tracking-wider uppercase text-stone-300">{meta.label}</span>
                </div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-white/[0.04] text-stone-400">{scenes.length}</span>
              </div>
              <div className="space-y-2.5">
                {scenes.length === 0 && (
                  <p className="text-xs text-stone-600 font-mono italic">No scenes in this stage yet.</p>
                )}
                {scenes.map((scene) => (
                  <div
                    key={scene.id}
                    className="flex items-center justify-between bg-[#18181b]/80 rounded-xl px-4 py-3 border border-white/[0.06] hover:border-white/15 transition-all"
                  >
                    <span className="text-xs font-mono text-stone-200">{scene.title || scene.id}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.02] text-stone-400 border border-white/[0.04]">{scene.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
