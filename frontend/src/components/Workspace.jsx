import YujinAvatar from './YujinAvatar'
import { useState, useEffect, useRef, useCallback } from 'react'

export default function Workspace({ team }) {
  const [messages, setMessages] = useState([])
  const [task, setTask] = useState('')
  const [connected, setConnected] = useState(false)
  const [running, setRunning] = useState(false)
  const wsRef = useRef(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    fetch(`/api/workspace/${team.id}/history`)
      .then(r => r.json())
      .then(setMessages)

    const ws = new WebSocket(`ws://${window.location.hostname}:8030/api/workspace/${team.id}/ws`)
    ws.onopen = () => setConnected(true)
    ws.onclose = () => { setConnected(false); setRunning(false) }
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data)
      setMessages(prev => [...prev, data])
      if (data.sender === 'Yujin' && data.content.startsWith('📋 สรุปผล')) setRunning(false)
    }
    wsRef.current = ws
    return () => ws.close()
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

  const senderColor = (type) => type === 'yujin' ? '#a78bfa' : '#6ee7b7'
  const senderBg = (type) => type === 'yujin' ? '#1e1b3a' : '#0f1f1a'

  return (
    <div className="workspace">
      <div className="workspace-header">
        <div>
          <div className="workspace-title">👥 {team.name}</div>
          <div className="workspace-workers">
            {team.workers.map(w => (
              <span key={w.id} className="worker-chip">{w.name}</span>
            ))}
          </div>
        </div>
        <span className={`ws-status ${connected ? 'online' : 'offline'}`}>
          {connected ? '🟢' : '🔴'}
        </span>
      </div>

      <div className="workspace-messages">
        {messages.length === 0 && (
          <div className="empty-chat" style={{marginTop: '40px'}}>
            <div className="empty-icon">👥</div>
            <div>ส่งงานให้ทีมได้เลยค่ะ<br/>Yujin จะมอบหมายงานและ Worker จะรายงานผล</div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className="ws-msg" style={{background: senderBg(m.sender_type)}}>
            <div className="ws-sender" style={{color: senderColor(m.sender_type)}}>
              {m.sender_type === 'yujin' && <YujinAvatar size={20} />} {m.sender}
            </div>
            <div className="ws-content">{m.content}</div>
            <div className="ws-time">{new Date(m.created_at).toLocaleTimeString('th-TH')}</div>
          </div>
        ))}
        {running && (
          <div className="ws-msg" style={{background: '#1e1b3a'}}>
            <div className="ws-sender" style={{color: '#a78bfa'}}>🤖 Yujin</div>
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
          placeholder="สั่งงานทีมนี้... (Yujin จะแบ่งงานให้ worker อัตโนมัติ)"
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
