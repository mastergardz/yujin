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
  'gemini-2.5-flash-8b': 'Gemini 2.5 Flash-8B',
  'meta-llama/Llama-3.3-70B-Instruct-Turbo': 'Llama 3.3 70B',
  'meta-llama/Llama-4-Scout-17B-16E-Instruct': 'Llama 4 Scout',
  'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo': 'Llama 3.1 8B',
  'gemini-2.5-flash-image': '🎨 Flash Image',
  'gemini-3.1-flash-image-preview': '🎨 Nano Banana 2',
  'gemini-3-pro-image-preview': '🎨 Nano Banana Pro',
}

function WsContent({ content }) {
  if (!content) return null
  const parts = content.split(/(\[.*?\]\(\/api\/files\/download\/[^\)]+\))/g)
  return (
    <span style={{whiteSpace:'pre-wrap',wordBreak:'break-word'}}>
      {parts.map((part, i) => {
        const match = part.match(/^\[(.*?)\]\((\/api\/files\/download\/[^\)]+)\)$/)
        if (match) {
          const label = match[1]
          const url = match[2]
          const isImage = /\.(png|jpg|jpeg|gif|webp)$/i.test(url)
          if (isImage) return (
            <span key={i} style={{display:'block',margin:'6px 0'}}>
              <img src={url} style={{maxWidth:'100%',maxHeight:300,borderRadius:8,display:'block',marginBottom:4}} alt={label} />
              <a href={url} download style={{fontSize:'0.75rem',color:'#7c3aed'}}>⬇️ {label}</a>
            </span>
          )
          return <a key={i} href={url} download style={{color:'#7c3aed',textDecoration:'underline'}}>📎 {label}</a>
        }
        return <span key={i}>{part}</span>
      })}
    </span>
  )
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

const ALL_MODELS = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', type: 'text' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', type: 'text' },
  { id: 'gemini-2.5-flash-8b', label: 'Gemini 2.5 Flash-8B', type: 'text' },
  { id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', label: 'Llama 3.3 70B', type: 'text' },
  { id: 'meta-llama/Llama-4-Scout-17B-16E-Instruct', label: 'Llama 4 Scout', type: 'text' },
  { id: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo', label: 'Llama 3.1 8B', type: 'text' },
  { id: 'gemini-2.5-flash-image', label: '🎨 Gemini 2.5 Flash Image', type: 'image' },
  { id: 'gemini-3.1-flash-image-preview', label: '🎨 Nano Banana 2', type: 'image' },
  { id: 'gemini-3-pro-image-preview', label: '🎨 Nano Banana Pro', type: 'image' },
]

export default function Workspace({ team: initialTeam, onTeamUpdated }) {
  const [team, setTeam] = useState(initialTeam)
  const [messages, setMessages] = useState([])
  const [task, setTask] = useState('')
  const [connected, setConnected] = useState(false)
  const [running, setRunning] = useState(false)
  const [sending, setSending] = useState(false)
  const [typingInfo, setTypingInfo] = useState(null)
  const [pendingFile, setPendingFile] = useState(null)
  const [editingWorker, setEditingWorker] = useState(null) // worker id ที่กำลัง edit model
  const wsRef = useRef(null)
  const bottomRef = useRef(null)
  const reconnectTimer = useRef(null)
  const fileInputRef = useRef(null)
  const pendingImageRef = useRef(null)

  const workerNames = team.workers.map(w => w.name)

  useEffect(() => {
    if (!editingWorker) return
    const close = () => setEditingWorker(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [editingWorker])

  const updateWorkerModel = async (workerId, newModel) => {
    const res = await fetch(`/api/teams/workers/${workerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ llm_model: newModel })
    })
    if (res.ok) {
      const updated = await res.json()
      setTeam(prev => ({
        ...prev,
        workers: prev.workers.map(w => w.id === workerId ? { ...w, llm_model: updated.llm_model } : w)
      }))
      if (onTeamUpdated) onTeamUpdated()
    }
    setEditingWorker(null)
  }

  const connect = () => {
    if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close() }
    const ws = new WebSocket(`ws://${window.location.hostname}:8030/api/workspace/${team.id}/ws`)
    ws.onopen = () => setConnected(true)
    ws.onclose = () => {
      setConnected(false)
      setRunning(false)
      setTypingInfo(null)
      reconnectTimer.current = setTimeout(connect, 3000)
    }
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data)
      if (data.type === 'typing') {
        setTypingInfo({ sender: data.sender, senderType: data.sender_type })
        return
      }
      setTypingInfo(null)
      if (data.sender_type === 'user' && pendingImageRef.current) {
        data.image = pendingImageRef.current
        pendingImageRef.current = null
      }
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

  // paste รูป — แค่เก็บ file ไว้ ยังไม่วิเคราะห์
  const handlePaste = (e) => {
    const items = Array.from(e.clipboardData?.items || [])
    const imgItem = items.find(i => i.type.startsWith('image/'))
    if (!imgItem) return
    e.preventDefault()
    const file = imgItem.getAsFile()
    const preview = URL.createObjectURL(file)
    setPendingFile({ file, filename: 'paste.png', preview })
  }

  // เลือกไฟล์ — แค่เก็บ file ไว้ ยังไม่วิเคราะห์
  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : null
    setPendingFile({ file, filename: file.name, preview })
    e.target.value = ''
  }

  const runTask = async () => {
    if ((!task.trim() && !pendingFile) || !connected || running || sending) return
    setSending(true)
    try {
      let file_context = null
      if (pendingFile) {
        // วิเคราะห์ตอนกดส่ง
        const form = new FormData()
        form.append('file', pendingFile.file, pendingFile.filename)
        const res = await fetch('/api/files/analyze', { method: 'POST', body: form })
        if (!res.ok) { const err = await res.json(); alert(err.detail); return }
        const data = await res.json()
        file_context = '[ไฟล์: ' + data.filename + ']\n' + data.analysis
      }

      const payload = { task: task.trim() || '(ดูไฟล์แนบ)' }
      if (file_context) payload.file_context = file_context
      if (pendingFile?.preview) pendingImageRef.current = pendingFile.preview

      wsRef.current.send(JSON.stringify(payload))
      setTask('')
      setPendingFile(null)
      setRunning(true)
    } finally {
      setSending(false)
    }
  }

  const canSend = connected && !running && !sending && (task.trim() || pendingFile)

  return (
    <div className="workspace">
      <div className="workspace-header">
        <div style={{minWidth:0}}>
          <div className="workspace-title">👥 {team.name}</div>
          <div className="workspace-workers">
            {team.workers.map(w => {
              const color = getWorkerColor(w.name, workerNames)
              const modelLabel = MODEL_SHORT[w.llm_model] || w.llm_model || ''
              const isEditing = editingWorker === w.id
              return (
                <span key={w.id} className="worker-chip" style={{background:color.bg,color:color.text,border:`1px solid ${color.border}`,position:'relative'}}>
                  <span>{w.name} — {w.role}</span>
                  {modelLabel && (
                    <span
                      onClick={() => setEditingWorker(isEditing ? null : w.id)}
                      style={{display:'block',fontSize:'0.65rem',opacity:0.7,marginTop:'1px',fontWeight:400,cursor:'pointer',textDecoration:'underline dotted',userSelect:'none'}}
                      title="คลิกเพื่อเปลี่ยน model"
                    >
                      {modelLabel} ✏️
                    </span>
                  )}
                  {(w.capabilities || []).length > 0 && (
                    <span style={{display:'block',fontSize:'0.6rem',opacity:0.65,marginTop:'2px'}}>
                      {(w.capabilities || []).map(c => ({'shell_tool':'💻','db_tool':'🗄️','file_tool':'📄','image_tool':'🎨'}[c] || '🔧')).join(' ')}
                    </span>
                  )}
                  {isEditing && (
                    <div style={{
                      position:'absolute', top:'100%', left:0, zIndex:100,
                      background:'white', border:'1px solid #e5e5ea', borderRadius:'8px',
                      boxShadow:'0 4px 16px rgba(0,0,0,0.12)', minWidth:'200px', padding:'4px 0',
                    }}
                      onClick={e => e.stopPropagation()}
                    >
                      {['text','image'].map(type => (
                        <div key={type}>
                          <div style={{fontSize:'0.65rem',color:'#999',padding:'4px 10px 2px',fontWeight:600,textTransform:'uppercase'}}>
                            {type === 'text' ? '🧠 Text' : '🎨 Image'}
                          </div>
                          {ALL_MODELS.filter(m => m.type === type).map(m => (
                            <div
                              key={m.id}
                              onClick={() => updateWorkerModel(w.id, m.id)}
                              style={{
                                padding:'5px 10px', fontSize:'0.78rem', cursor:'pointer',
                                background: w.llm_model === m.id ? '#f3e8ff' : 'transparent',
                                color: w.llm_model === m.id ? '#7c3aed' : '#333',
                                fontWeight: w.llm_model === m.id ? 600 : 400,
                              }}
                              onMouseEnter={e => { if (w.llm_model !== m.id) e.target.style.background='#f9fafb' }}
                              onMouseLeave={e => { if (w.llm_model !== m.id) e.target.style.background='transparent' }}
                            >
                              {w.llm_model === m.id ? '✓ ' : ''}{m.label}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </span>
              )
            })}
          </div>
        </div>
        <span className={`ws-status ${connected ? 'online' : 'offline'}`}>
          {connected ? '🟢' : '🔴'}
        </span>
      </div>

      <div className="workspace-messages">
        {messages.length === 0 && (
          <div className="empty-chat" style={{marginTop:'40px'}}>
            <div className="empty-icon">👥</div>
            <div>สั่งงานทีมได้เลยค่ะ พี่<br/>paste รูปหรือแนบไฟล์ได้เลยค่ะ</div>
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
                <span className="ws-time">{new Date(m.created_at.endsWith('Z') ? m.created_at : m.created_at + 'Z').toLocaleTimeString('th-TH', {timeZone:'Asia/Bangkok'})}</span>
              </div>
              <div className="ws-content">
                {m.image && <img src={m.image} style={{maxWidth:'100%',maxHeight:200,borderRadius:8,marginBottom:m.content?6:0,display:'block'}} alt="รูปแนบ" />}
                <WsContent content={m.content} />
              </div>
            </div>
          )
        })}
        {(running || typingInfo) && (() => {
          const who = typingInfo || { sender: 'Yujin', senderType: 'yujin' }
          const isYujin = who.senderType === 'yujin'
          const color = !isYujin ? getWorkerColor(who.sender, workerNames) : null
          const borderColor = isYujin ? '#7c3aed' : color.border
          const senderColor = isYujin ? '#7c3aed' : color.text
          return (
            <div className="ws-msg" style={{borderLeft:`3px solid ${borderColor}`}}>
              <div className="ws-msg-header">
                <Avatar sender={who.sender} senderType={who.senderType} workerNames={workerNames} />
                <span className="ws-sender" style={{color:senderColor}}>{who.sender}</span>
              </div>
              <div className="bubble typing"><span/><span/><span/></div>
            </div>
          )
        })()}
        <div ref={bottomRef} />
      </div>

      {pendingFile && (
        <div style={{padding:'8px 16px',background:'#f5f0ff',borderTop:'1px solid #e9d5ff',display:'flex',alignItems:'center',gap:8}}>
          {pendingFile.preview
            ? <img src={pendingFile.preview} style={{height:36,borderRadius:6,objectFit:'cover'}} alt="preview" />
            : <span style={{fontSize:'1.2rem'}}>📄</span>
          }
          <span style={{fontSize:'0.8rem',color:'#7c3aed',flex:1}}>📎 {pendingFile.filename}</span>
          <button onClick={() => setPendingFile(null)} style={{background:'none',border:'none',cursor:'pointer',color:'#999',fontSize:'1rem'}}>✕</button>
        </div>
      )}

      <div className="workspace-input">
        <input type="file" ref={fileInputRef} accept={ACCEPT} onChange={handleFileChange} style={{display:'none'}} />
        <button
          onClick={() => fileInputRef.current.click()}
          disabled={!connected || running}
          title="แนบไฟล์/รูป"
          style={{
            background:'none', border:'1.5px solid #e5e5ea', borderRadius:'8px',
            padding:'8px 10px', cursor:'pointer', fontSize:'1.1rem',
            color:'#7c3aed', flexShrink:0,
            opacity:(!connected || running) ? 0.4 : 1
          }}
        >📎</button>
        <textarea
          value={task}
          onChange={e => setTask(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), runTask())}
          onPaste={handlePaste}
          placeholder="สั่งงานทีม... หรือ paste รูปได้เลยค่ะ"
          disabled={!connected || running}
          rows={2}
        />
        <button className="send-btn" onClick={runTask} disabled={!canSend}>
          {sending ? '⏳' : running ? '⏳' : 'ส่ง'}
        </button>
      </div>
    </div>
  )
}
