const STAGE_META = {
  script: { label: 'Script', color: 'border-script', dot: 'bg-script' },
  preprod: { label: 'Pre-Prod', color: 'border-preprod', dot: 'bg-preprod' },
  shoot: { label: 'Shoot', color: 'border-shoot', dot: 'bg-shoot' },
  postprod: { label: 'Post-Prod', color: 'border-postprod', dot: 'bg-postprod' },
}

export default function PipelineBoard({ scenesByStage }) {
  return (
    <div className="grain-panel border border-gold-600/15 rounded-lg p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-display text-lg text-gold-400">Production Pipeline</h2>
        <span className="text-xs text-stone-500">↻ live from Firestore</span>
      </div>
      <div className="grid grid-cols-2 gap-6">
        {Object.entries(STAGE_META).map(([key, meta]) => {
          const scenes = scenesByStage[key] || []
          return (
            <div key={key} className={`border-t-2 ${meta.color} pt-3`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-stone-200">{meta.label}</span>
                <span className="text-xs text-stone-500">{scenes.length}</span>
              </div>
              <div className="space-y-2">
                {scenes.length === 0 && (
                  <p className="text-xs text-stone-600 italic">No scenes in this stage yet.</p>
                )}
                {scenes.map((scene) => (
                  <div
                    key={scene.id}
                    className="flex items-center justify-between bg-reel-900/60 rounded px-3 py-2 border-l-2 border-gold-600/40"
                  >
                    <span className="text-sm text-stone-200">{scene.title || scene.id}</span>
                    <span className="text-xs text-stone-400">{scene.status}</span>
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
