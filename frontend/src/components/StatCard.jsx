export default function StatCard({ label, value, unit, trend, icon }) {
  return (
    <div className="bg-[#121214]/80 backdrop-blur-2xl border border-white/[0.08] hover:border-white/20 rounded-2xl p-6 transition-all duration-300 shadow-2xl flex flex-col justify-between">
      <div>
        <div className="flex items-center gap-2 text-[11px] font-mono tracking-wider text-stone-400 uppercase mb-3">
          <span>{icon}</span>
          {label}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-sans font-semibold text-3xl text-stone-100 tracking-tight">{value}</span>
          {unit && <span className="text-stone-400 text-xs font-mono">{unit}</span>}
        </div>
      </div>
      {trend && <div className="text-[11px] font-mono text-stone-400 mt-3 pt-3 border-t border-white/[0.04]">{trend}</div>}
    </div>
  )
}
