import { useState, useEffect, useRef } from 'react'
import YujinAvatar from './YujinAvatar'

const WORKER_COLORS = [
  { bg: '#f0f7ff', border: '#bfdbfe', text: '#1d4ed8' },
  { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' },
  { bg: '#fff7ed', border: '#fed7aa', text: '#c2410c' },
  { bg: '#fdf4ff', border: '#e9d5ff', text: '#7e22ce' },
  { bg: '#fff1f2', border: '#fecdd3', text: '#be123c' },
  { bg: '#f0fdfa', border: '#99f6e4', text: '#0f766e' },
]

const MODEL_SHORT = {
  'gemini-2.5-flash': 'Gemini 2.5 Flash',
  'gemini-2.5-pro': 'Gemini 2.5 Pro',
  'gemini-2.0-flash-lite': 'Gemini 2.0 Lite',
  'meta-llama/Llama-3.3-70B-Instruct-Turbo': 'Llama 3.3 70B',
  'meta-llama/Llama-4-Scout-17B-16E-Instruct': 'Llama 4 Scout',
  'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo': 'Llama 3.1 8B',
}

function getWorkerColor(name, workerNames) {
  const idx = workerNames.indexOf(name)
  return WORKER_COLORS[idx % WORKER_COLORS.length]
}

function Avatar({ sender, senderType, workerNames }) {
  if (senderType === 'yujin') return <YujinAvatar size={32} />
  if (senderType === 'user') return (
    <img src="/gard.png" style={{width:32,height:32,borderRadius:'50%',objectFit:'cover',flexShrink:0}} alt="พี่การ์ด" />
  )
  const color = getWorkerColor(sender, workerNames)
  return (
    <div style={{
      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
      background: color.bg, border: `1.5px solid ${color.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '0.8rem', fontWeight: 700, color: color.text
    }}>
      {sender.charAt(0)}
    </div>
  )
}

const ACCEPT = "image/jpeg,image/png,image/gif,image/webp,application/pdf,text/plain,text/csv,text/markdown,application/json"

export default function Workspace({ team }) {
  const [messages, setMessages] = useState([])
  const [task, setTask] = useState('')
  const [connected, setConnected] = useState(false)
  const [running, setRunning] = useState(false)
  const [attachedFile, setAttachedFile] = useState(null)   // { name, analysis, mime }
  const [analyzing, setAnalyzing] = useState(false)
  const wsRef = useRef(null)
  const bottomRef = useRef(null)
  const reconnectTimer = useRef(null)
  const fileInputRef = useRef(null)

  const workerNames = team.workers.map(w => w.name)

  const connect = () => {
    if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close() }
    const ws = new WebSocket(`ws://${window.location.hostname}:8030/api/workspace/${team.id}/ws`)
    ws.onopen = () => setConnected(true)
    ws.onclose = () => {
      setConnected(false)
      setRunning(false)
      reconnectTimer.current = setTimeout(connect, 3000)
    }
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data)
      setMessages(prev => [...prev, data])
      if (data.sender_type === 'yujin' && !data.content.includes('รับงานแล้ว') && !data.content.startsWith('@')) {
        setRunning(false)
      }
    }
    wsRef.current = ws
  }

  useEffect(() => {
    fetch(`/api/workspace/${team.id}/history`).then(r => r.json()).then(setMessages)
    connect()
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close() }
    }
  }, [team.id])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setAnalyzing(true)
    setAttachedFile(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/files/analyze', { method: 'POST', body: form })
      if (!res.ok) { const err = await res.json(); alert(err.detail); return }
      const data = await res.json()
      setAttachedFile({ name: data.filename, analysis: data.analysis, mime: data.mime_type })
    } catch (err) {
      alert('วิเคราะห์ไฟล์ไม่ได้ค่ะ: ' + err.message)
    } finally {
      setAnalyzing(false)
      e.target.value = ''
    }
  }

  const runTask = () => {
    if ((!task.trim() && !attachedFile) || !connected || running) return
    const payload = { task: task.trim() || '(ดูไฟล์แนบ)' }
    if (attachedFile) payload.file_context = `[ไฟล์: ${attachedFile.name}]\n${attachedFile.analysis}`
    wsRef.current.send(JSON.stringify(payload))
    setTask('')
    setAttachedFile(null)
    setRunning(true)
  }

  return (
    <div className="workspace">
      {/* Header */}
      <div className="workspace-header">
        <div style={{minWidth:0}}>
          <div className="workspace-title">👥 {team.name}</div>
          <div className="workspace-workers">
            {team.workers.map(w => {
              const color = getWorkerColor(w.name, workerNames)
              const modelLabel = MODEL_SHORT[w.llm_model] || w.llm_model || ''
              return (
                <span key={w.id} className="worker-chip" style={{background:color.bg,color:color.text,border:`1px solid ${color.border}`}}>
                  <span>{w.name} — {w.role}</span>
                  {modelLabel && <span style={{display:'block',fontSize:'0.65rem',opacity:0.7,marginTop:'1px',fontWeight:400}}>{modelLabel}</span>}
                </span>
              )
            })}
          </div>
        </div>
        <span className={`ws-status ${connected ? 'online' : 'offline'}`}>
          {connected ? '🟢' : '🔴'}
        </span>
      </div>

      {/* Messages */}
      <div className="workspace-messages">
        {messages.length === 0 && (
          <div className="empty-chat" style={{marginTop:'40px'}}>
            <div className="empty-icon">👥</div>
            <div>สั่งงานทีมได้เลยค่ะ พี่<br/>แนบไฟล์หรือรูปได้ด้วยนะคะ</div>
          </div>
        )}
        {messages.map((m, i) => {
          const isYujin = m.sender_type === 'yujin'
          const isUser = m.sender_type === 'user'
          const color = (!isYujin && !isUser) ? getWorkerColor(m.sender, workerNames) : null
          const borderColor = isYujin ? '#7c3aed' : isUser ? '#fcd34d' : color.border
          const senderColor = isYujin ? '#7c3aed' : isUser ? '#92400e' : color.text
          return (
            <div key={i} className="ws-msg" style={{borderLeft:`3px solid ${borderColor}`}}>
              <div className="ws-msg-header">
                <Avatar sender={m.sender} senderType={m.sender_type} workerNames={workerNames} />
                <span className="ws-sender" style={{color:senderColor}}>{m.sender}</span>
                <span className="ws-time">{new Date(m.created_at).toLocaleTimeString('th-TH')}</span>
              </div>
              <div className="ws-content">{m.content}</div>
            </div>
          )
        })}
        {running && (
          <div className="ws-msg" style={{borderLeft:'3px solid #7c3aed'}}>
            <div className="ws-msg-header">
              <YujinAvatar size={32} />
              <span className="ws-sender" style={{color:'#7c3aed'}}>Yujin</span>
            </div>
            <div className="bubble typing"><span/><span/><span/></div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* File preview */}
      {(attachedFile || analyzing) && (
        <div style={{padding:'8px 16px', background:'#f5f0ff', borderTop:'1px solid #e9d5ff', display:'flex', alignItems:'center', gap:8}}>
          {analyzing ? (
            <span style={{fontSize:'0.8rem', color:'#7c3aed'}}>⏳ Yujin กำลังอ่านไฟล์...</span>
          ) : (
            <>
              <span style={{fontSize:'0.8rem', color:'#7c3aed'}}>📎 {attachedFile.name}</span>
              <button onClick={() => setAttachedFile(null)} style={{background:'none',border:'none',cursor:'pointer',color:'#999',fontSize:'1rem'}}>✕</button>
            </>
          )}
        </div>
      )}

      {/* Input */}
      <div className="workspace-input">
        <input type="file" ref={fileInputRef} accept={ACCEPT} onChange={handleFileChange} style={{display:'none'}} />
        <button
          onClick={() => fileInputRef.current.click()}
          disabled={!connected || running || analyzing}
          title="แนบไฟล์/รูป"
          style={{
            background: 'none', border: '1.5px solid #e5e5ea', borderRadius: '8px',
            padding: '8px 10px', cursor: 'pointer', fontSize: '1.1rem',
            color: '#7c3aed', flexShrink: 0,
            opacity: (!connected || running || analyzing) ? 0.4 : 1
          }}
        >📎</button>
        <textarea
          value={task}
          onChange={e => setTask(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), runTask())}
          placeholder="สั่งงานทีม... หรือแนบไฟล์ได้เลยค่ะ"
          disabled={!connected || running || analyzing}
          rows={2}
        />
        <button className="send-btn" onClick={runTask}
          disabled={!connected || running || analyzing || (!task.trim() && !attachedFile)}>
          {running ? '⏳' : 'ส่ง'}
        </button>
      </div>
    </div>
  )
}
