export default function StatCard({ label, value, unit, trend, icon }) {
  return (
    <div className="grain-panel border border-gold-600/15 rounded-lg p-5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-stone-400 mb-3">
        <span>{icon}</span>
        {label}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-display text-3xl text-gold-400">{value}</span>
        {unit && <span className="text-stone-400 text-sm">{unit}</span>}
      </div>
      {trend && <div className="text-xs text-emerald-400 mt-2">{trend}</div>}
    </div>
  )
}
