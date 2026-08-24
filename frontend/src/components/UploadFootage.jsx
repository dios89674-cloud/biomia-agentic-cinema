import { useState } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080'

export default function UploadFootage({ eligibleScenes, onUploaded }) {
  const [sceneId, setSceneId] = useState('')
  const [file, setFile] = useState(null)
  const [status, setStatus] = useState(null) // null | 'uploading' | 'done' | 'error'

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!sceneId || !file) return

    setStatus('uploading')
    const form = new FormData()
    form.append('file', file)

    try {
      const res = await fetch(`${API_BASE}/scenes/${sceneId}/footage`, {
        method: 'POST',
        body: form,
      })
      const data = await res.json()
      if (data.status === 'ok') {
        setStatus('done')
        setFile(null)
        onUploaded?.()
        // Eventarc + the DAG orchestrator take a few seconds to run —
        // poll once more shortly after so the board reflects the result.
        setTimeout(() => onUploaded?.(), 6000)
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    }
  }

  return (
    <form onSubmit={handleUpload} className="grain-panel border border-gold-600/15 rounded-lg p-4 mb-4">
      <div className="text-xs text-stone-400 mb-3">
        🎥 Upload Footage <span className="text-stone-600">— fires Eventarc → unlocks Edit/VFX</span>
      </div>
      <div className="flex items-center gap-2">
        <select
          value={sceneId}
          onChange={(e) => setSceneId(e.target.value)}
          className="bg-reel-900 border border-gold-600/20 rounded px-2 py-1.5 text-sm text-stone-200 focus:outline-none focus:border-gold-500"
        >
          <option value="">Select scene...</option>
          {eligibleScenes.map((s) => (
            <option key={s.id} value={s.id}>{s.title || s.id}</option>
          ))}
        </select>
        <input
          type="file"
          accept="video/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="text-xs text-stone-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-gold-600/20 file:text-gold-300 file:text-xs"
        />
        <button
          type="submit"
          disabled={!sceneId || !file || status === 'uploading'}
          className="px-3 py-1.5 bg-gold-600 hover:bg-gold-500 disabled:opacity-40 disabled:cursor-not-allowed text-reel-950 font-medium text-xs rounded transition-colors"
        >
          {status === 'uploading' ? 'Uploading...' : 'Upload'}
        </button>
      </div>
      {status === 'done' && (
        <p className="text-xs text-emerald-400 mt-2">Uploaded — watch the Shoot/Post-Prod columns update.</p>
      )}
      {status === 'error' && (
        <p className="text-xs text-red-400 mt-2">Upload failed — check the scene has completed Script/Pre-Prod first.</p>
      )}
    </form>
  )
}
