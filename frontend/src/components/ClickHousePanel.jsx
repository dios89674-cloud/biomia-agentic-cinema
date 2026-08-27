import { useEffect, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080'

// The MCP server returns results in a columnar shape:
// {"columns": ["stage", "count"], "rows": [["storyboard", 6], ["edit", 3]]}
// — not an array of objects. Convert it to one for easy rendering, and
// fall back to showing the raw string if the shape is ever different.
function parseColumnarResult(text) {
  if (!text) return null
  try {
    const parsed = JSON.parse(text)
    if (!parsed?.columns || !parsed?.rows) return null
    return parsed.rows.map((row) =>
      Object.fromEntries(parsed.columns.map((col, i) => [col, row[i]]))
    )
  } catch {
    return null
  }
}

export default function ClickHousePanel() {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(null)

  const fetchStats = () => {
    fetch(`${API_BASE}/clickhouse/live`)
      .then((r) => r.json())
      .then((data) => {
        if (data.status === 'ok') {
          setStats(data)
          setError(null)
        } else {
          setError(data.reason || 'Unknown error')
        }
      })
      .catch(() => setError('Could not reach ClickHouse via backend'))
  }

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 8000)
    return () => clearInterval(interval)
  }, [])

  const totalRows = stats ? parseColumnarResult(stats.total) : null
  const total = totalRows?.[0]?.total ?? '—'

  const byStageRows = stats ? parseColumnarResult(stats.by_stage) : null
  const recentRows = stats ? parseColumnarResult(stats.recent) : null

  return (
    <div className="max-w-4xl p-8 bg-[#121214]/80 backdrop-blur-2xl border border-white/[0.08] rounded-2xl shadow-2xl">
      <div className="flex items-center justify-between pb-6 border-b border-white/[0.06] mb-6">
        <div>
          <h2 className="font-sans font-medium text-base text-stone-100 tracking-tight">ClickHouse — Live via MCP</h2>
          <p className="text-xs text-stone-400 mt-0.5">Real aggregate queries, run through the official ClickHouse MCP server every 8s</p>
        </div>
        <span className="font-mono text-[11px] px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Polling
        </span>
      </div>

      {error && (
        <p className="text-sm text-red-400 mb-4">⚠ {error}</p>
      )}

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-5 rounded-xl bg-black/50 border border-white/[0.06]">
          <div className="text-stone-500 text-xs mb-1">TOTAL SCENE FACTS RECORDED</div>
          <div className="text-4xl font-mono text-emerald-400">{total}</div>
          <div className="text-stone-600 text-[11px] mt-1">SELECT count() FROM scene_facts</div>
        </div>
        <div className="p-5 rounded-xl bg-black/50 border border-white/[0.06]">
          <div className="text-stone-500 text-xs mb-2">BY PIPELINE STAGE</div>
          {byStageRows ? (
            <div className="space-y-1">
              {byStageRows.map((row, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-stone-300">{row.stage}</span>
                  <span className="text-stone-400 font-mono">{row.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-stone-600 text-xs italic">{stats?.by_stage || 'Loading...'}</p>
          )}
        </div>
      </div>

      <div className="p-5 rounded-xl bg-black/50 border border-white/[0.06]">
        <div className="text-stone-500 text-xs mb-3">RECENT ACTIVITY (live, most recent first)</div>
        {recentRows ? (
          <div className="space-y-1.5 font-mono text-xs">
            {recentRows.map((row, i) => (
              <div key={i} className="flex items-center gap-3 text-stone-400">
                <span className="text-gold-400">{row.scene_id}</span>
                <span className="text-stone-600">→</span>
                <span className="text-stone-300">{row.stage}</span>
                <span className="text-stone-600 ml-auto">{row.recorded_at}</span>
              </div>
            ))}
            {recentRows.length === 0 && (
              <p className="text-stone-600 italic">No facts recorded yet — run a scene through the pipeline.</p>
            )}
          </div>
        ) : (
          <p className="text-stone-600 text-xs italic">{stats?.recent || 'Loading...'}</p>
        )}
      </div>
    </div>
  )
}
