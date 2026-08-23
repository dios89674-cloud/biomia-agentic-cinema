const NAV_ITEMS = [
  { key: 'pipeline', label: 'Pipeline', icon: '🎬' },
  { key: 'agents', label: 'Agents', icon: '🧠' },
  { key: 'clickhouse', label: 'ClickHouse', icon: '📊' },
  { key: 'tools', label: 'Tools', icon: '🛠️' },
]

export default function Sidebar({ active, onSelect }) {
  return (
    <aside className="w-24 shrink-0 border-r border-white/[0.08] bg-[#09090b] flex flex-col items-center py-6 gap-8">
      {NAV_ITEMS.map((item) => (
        <button
          key={item.key}
          onClick={() => onSelect(item.key)}
          className={`flex flex-col items-center gap-1.5 text-xs font-mono transition-all duration-200 ${
            active === item.key 
              ? 'text-stone-100 bg-white/[0.06] py-3 px-4 rounded-xl border border-white/10 shadow-lg' 
              : 'text-stone-500 hover:text-stone-300 py-3 px-4'
          }`}
        >
          <span className="text-xl">{item.icon}</span>
          {item.label}
        </button>
      ))}
    </aside>
  )
}
