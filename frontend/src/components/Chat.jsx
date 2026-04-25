import { useState, useEffect, useRef } from 'react'
import YujinAvatar from './YujinAvatar'

const ALL_MODELS = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { id: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite' },
  { id: 'gemini-2.5-flash-image', label: '🎨 Flash Image' },
  { id: 'gemini-3.1-flash-image-preview', label: '🎨 Nano Banana 2' },
  { id: 'gemini-3-pro-image-preview', label: '🎨 Nano Banana Pro' },
  { id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', label: 'Llama 3.3 70B' },
  { id: 'meta-llama/Llama-4-Scout-17B-16E-Instruct', label: 'Llama 4 Scout' },
  { id: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo', label: 'Llama 3.1 8B' },
]
const TOOL_ICONS = { shell_tool: '💻', db_tool: '🗄️', file_tool: '📄', image_tool: '🎨' }

export default function Chat() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [connected, setConnected] = useState(false)
  const [pending, setPending] = useState(false)
  const [proposalEdits, setProposalEdits] = useState({})
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const wsRef = useRef(null)
  const reconnectTimer = useRef(null)

  const connectWs = () => {
    if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close() }
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
    const socket = new WebSocket(`ws://${window.location.hostname}:8030/api/chat/ws`)
    socket.onopen = () => setConnected(true)
    socket.onclose = () => {
      setConnected(false)
      reconnectTimer.current = setTimeout(connectWs, 3000)
    }
    socket.onmessage = (e) => {
      const data = JSON.parse(e.data)
      setMessages(prev => [...prev, data])
      setPending(false)
    }
    wsRef.current = socket
  }

  useEffect(() => {
    fetch('/api/chat/history')
      .then(r => r.json())
      .then(data => setMessages(data.map(m => ({
        role: m.role, content: m.content,
        model_used: m.model_used, proposal: m.metadata?.proposal
      }))))
    connectWs()
    setTimeout(() => inputRef.current?.focus(), 100)
    return () => { if (reconnectTimer.current) clearTimeout(reconnectTimer.current) }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, pending])

  const send = () => {
    if (!input.trim() || !connected || pending || !wsRef.current) return
    setMessages(prev => [...prev, { role: 'user', content: input }])
    wsRef.current.send(JSON.stringify({ message: input }))
    setInput('')
    setPending(true)
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const clearHistory = async () => {
    if (!confirm('ลบประวัติ chat ทั้งหมดใช่มั๊ย?')) return
    await fetch('/api/chat/clear', { method: 'DELETE' })
    setMessages([])
  }

  const approveProject = async (proposal, msgIndex) => {
    const edits = proposalEdits[msgIndex] || {}
    const members = proposal.members.map((w, wi) => ({
      ...w,
      llm_model: edits[wi] || w.llm_model
    }))
    const res = await fetch('/api/projects/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_name: proposal.project_name,
        description: proposal.description,
        members
      })
    })
    const data = await res.json()
    if (data.id) {
      setMessages(prev => prev.map((m, i) => i === msgIndex ? { ...m, approved: true, project_id: data.id } : m))
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', flex: 1 }}>
      {/* topbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderBottom: '1px solid #e5e5ea', background: 'white' }}>
        <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>💬 สั่งงาน Yujin</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '0.78rem', color: connected ? '#10b981' : '#ef4444' }}>
            {connected ? '🟢 Connected' : '🔴 Reconnecting...'}
          </span>
          <button onClick={clearHistory} style={{ background: '#f3f4f6', border: 'none', borderRadius: 8, padding: '4px 12px', fontSize: '0.78rem', cursor: 'pointer', color: '#555' }}>
            🗑️ Clear
          </button>
        </div>
      </div>

      {/* messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: 80, color: '#aaa' }}>
            <YujinAvatar size={72} />
            <div style={{ marginTop: 12, fontSize: '1rem' }}>สวัสดีค่ะ พี่การ์ด<br />สั่งงาน Yujin ได้เลยค่ะ</div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
            {m.role === 'yujin' && <YujinAvatar size={32} />}
            {m.role === 'user' && <img src="/gard.png" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} alt="พี่การ์ด" />}
            <div style={{ maxWidth: '72%' }}>
              <div style={{
                background: m.role === 'user' ? '#7c3aed' : 'white',
                color: m.role === 'user' ? 'white' : '#222',
                border: m.role === 'user' ? 'none' : '1px solid #e5e5ea',
                borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                padding: '10px 14px', fontSize: '0.88rem', lineHeight: 1.55,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word'
              }}>
                {m.content}
              </div>
              {m.proposal && !m.approved && (
                <div style={{ marginTop: 10, background: 'white', border: '1px solid #e9d5ff', borderRadius: 14, padding: 16, boxShadow: '0 2px 8px rgba(124,58,237,0.08)' }}>
                  <div style={{ fontWeight: 700, color: '#7c3aed', marginBottom: 6 }}>📋 Project: {m.proposal.project_name}</div>
                  <p style={{ fontSize: '0.82rem', color: '#666', margin: '0 0 12px' }}>{m.proposal.description}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                    {m.proposal.members?.map((w, wi) => {
                      const currentModel = (proposalEdits[i] || {})[wi] || w.llm_model
                      return (
                        <div key={wi} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '8px 10px', background: '#faf5ff', borderRadius: 10, border: '1px solid #e9d5ff' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.85rem', minWidth: 60 }}>{w.name}</span>
                          <span style={{ fontSize: '0.78rem', color: '#666', flex: 1 }}>{w.role}</span>
                          <select
                            value={currentModel}
                            onChange={e => setProposalEdits(prev => ({ ...prev, [i]: { ...(prev[i] || {}), [wi]: e.target.value } }))}
                            style={{ fontSize: '0.75rem', padding: '2px 6px', borderRadius: 6, border: '1px solid #e5e5ea', background: 'white' }}
                          >
                            {ALL_MODELS.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                          </select>
                          {(w.capabilities || []).map((cap, ci) => (
                            <span key={ci} style={{ fontSize: '0.7rem', background: '#eff6ff', color: '#2563eb', padding: '2px 6px', borderRadius: 8, border: '1px solid #bfdbfe' }}>
                              {TOOL_ICONS[cap] || '🔧'} {cap.replace('_tool', '')}
                            </span>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                  <button onClick={() => approveProject(m.proposal, i)} style={{ width: '100%', background: '#7c3aed', color: 'white', border: 'none', borderRadius: 10, padding: '10px', fontWeight: 600, cursor: 'pointer', fontSize: '0.88rem' }}>
                    ✅ Approve & สร้าง Project
                  </button>
                </div>
              )}
              {m.approved && (
                <div style={{ marginTop: 8, fontSize: '0.8rem', color: '#10b981', fontWeight: 600 }}>✅ สร้าง Project แล้วค่ะ — ไปสั่งงานได้ที่ Workspace</div>
              )}
            </div>
          </div>
        ))}
        {pending && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <YujinAvatar size={32} />
            <div style={{ background: 'white', border: '1px solid #e5e5ea', borderRadius: '18px 18px 18px 4px', padding: '12px 16px' }}>
              <div className="typing"><span /><span /><span /></div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* input */}
      <div style={{ padding: '12px 20px', borderTop: '1px solid #e5e5ea', background: 'white', display: 'flex', gap: 10 }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="สั่งงาน Yujin... (Enter ส่ง, Shift+Enter ขึ้นบรรทัดใหม่)"
          disabled={!connected || pending}
          rows={3}
          style={{ flex: 1, resize: 'none', border: '1px solid #e5e5ea', borderRadius: 12, padding: '10px 14px', fontSize: '0.88rem', fontFamily: 'inherit', outline: 'none' }}
        />
        <button
          onClick={send}
          disabled={!connected || pending || !input.trim()}
          style={{ background: '#7c3aed', color: 'white', border: 'none', borderRadius: 12, padding: '0 20px', fontWeight: 600, cursor: 'pointer', fontSize: '0.88rem', opacity: (!connected || pending || !input.trim()) ? 0.5 : 1 }}
        >
          ส่ง
        </button>
      </div>
    </div>
  )
}
