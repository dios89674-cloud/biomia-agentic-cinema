const NAV_ITEMS = [
  { key: 'pipeline', label: 'Pipeline', icon: '🎬' },
  { key: 'agents', label: 'Agents', icon: '🧠' },
  { key: 'clickhouse', label: 'ClickHouse', icon: '📊' },
  { key: 'tools', label: 'Tools', icon: '🛠️' },
]

export default function Sidebar({ active, onSelect }) {
  return (
    <aside className="w-24 shrink-0 border-r border-gold-600/20 grain-panel flex flex-col items-center py-6 gap-8">
      {NAV_ITEMS.map((item) => (
        <button
          key={item.key}
          onClick={() => onSelect(item.key)}
          className={`flex flex-col items-center gap-1 text-xs transition-colors ${
            active === item.key ? 'text-gold-400' : 'text-stone-500 hover:text-stone-300'
          }`}
        >
          <span className="text-xl">{item.icon}</span>
          {item.label}
        </button>
      ))}
    </aside>
  )
}
