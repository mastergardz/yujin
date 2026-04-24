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

function getWorkerColor(name, workerNames) {
  const idx = workerNames.indexOf(name)
  return WORKER_COLORS[idx % WORKER_COLORS.length]
}

function Avatar({ sender, senderType, workerNames }) {
  if (senderType === 'yujin') return <YujinAvatar size={32} />
  const color = getWorkerColor(sender, workerNames)
  return (
    <div style={{
      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
      background: color.bg, border: `1.5px solid ${color.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '0.8rem', fontWeight: 700, color: color.text
    }}>
      {sender.charAt(0).toUpperCase()}
    </div>
  )
}

export default function Workspace({ team }) {
  const [messages, setMessages] = useState([])
  const [task, setTask] = useState('')
  const [connected, setConnected] = useState(false)
  const [running, setRunning] = useState(false)
  const wsRef = useRef(null)
  const bottomRef = useRef(null)
  const reconnectTimer = useRef(null)

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
      if (data.sender === 'Yujin' && data.content.startsWith('📋')) setRunning(false)
    }
    wsRef.current = ws
  }

  useEffect(() => {
    fetch(`/api/workspace/${team.id}/history`)
      .then(r => r.json())
      .then(setMessages)
    connect()
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close() }
    }
  }, [team.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const runTask = () => {
    if (!task.trim() || !connected || running) return
    wsRef.current.send(JSON.stringify({ task }))
    setTask('')
    setRunning(true)
  }

  return (
    <div className="workspace">
      <div className="workspace-header">
        <div>
          <div className="workspace-title">👥 {team.name}</div>
          <div className="workspace-workers">
            {team.workers.map((w, i) => {
              const color = getWorkerColor(w.name, workerNames)
              return (
                <span key={w.id} className="worker-chip" style={{
                  background: color.bg, color: color.text,
                  border: `1px solid ${color.border}`
                }}>
                  {w.name} — {w.role}
                </span>
              )
            })}
          </div>
        </div>
        <span className={`ws-status ${connected ? 'online' : 'offline'}`}>
          {connected ? '🟢 Connected' : '🔴 Reconnecting...'}
        </span>
      </div>

      <div className="workspace-messages">
        {messages.length === 0 && (
          <div className="empty-chat" style={{marginTop: '40px'}}>
            <div className="empty-icon">👥</div>
            <div>ส่งงานให้ทีมได้เลยค่ะ<br/>Yujin จะมอบหมายงานให้แต่ละคนในทีม</div>
          </div>
        )}
        {messages.map((m, i) => {
          const isYujin = m.sender_type === 'yujin'
          const color = isYujin ? null : getWorkerColor(m.sender, workerNames)
          return (
            <div key={i} className="ws-msg" style={{
              borderLeft: isYujin ? '3px solid #7c3aed' : `3px solid ${color.border}`
            }}>
              <div className="ws-msg-header">
                <Avatar sender={m.sender} senderType={m.sender_type} workerNames={workerNames} />
                <span className="ws-sender" style={{color: isYujin ? '#7c3aed' : color.text}}>
                  {m.sender}
                </span>
                <span className="ws-time">{new Date(m.created_at).toLocaleTimeString('th-TH')}</span>
              </div>
              <div className="ws-content">{m.content}</div>
            </div>
          )
        })}
        {running && (
          <div className="ws-msg" style={{borderLeft: '3px solid #7c3aed'}}>
            <div className="ws-msg-header">
              <YujinAvatar size={32} />
              <span className="ws-sender" style={{color: '#7c3aed'}}>Yujin</span>
            </div>
            <div className="bubble typing"><span/><span/><span/></div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="workspace-input">
        <textarea
          value={task}
          onChange={e => setTask(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), runTask())}
          placeholder="สั่งงานทีมนี้... Yujin จะแบ่งงานให้ worker แต่ละคนอัตโนมัติ"
          disabled={!connected || running}
          rows={2}
        />
        <button className="send-btn" onClick={runTask} disabled={!connected || running || !task.trim()}>
          {running ? '⏳' : 'ส่ง'}
        </button>
      </div>
    </div>
  )
}
