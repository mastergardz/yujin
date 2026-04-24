import YujinAvatar from './YujinAvatar'
import { useState, useEffect, useRef, useCallback } from 'react'

export default function Chat() {
  const [rooms, setRooms] = useState([])
  const [activeRoom, setActiveRoom] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [ws, setWs] = useState(null)
  const [connected, setConnected] = useState(false)
  const [pending, setPending] = useState(false)
  const [editingRoom, setEditingRoom] = useState(null)
  const [editName, setEditName] = useState('')
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const wsRef = useRef(null)

  const loadRooms = async () => {
    const data = await fetch('/api/rooms/').then(r => r.json())
    setRooms(data)
    if (data.length > 0 && !activeRoom) setActiveRoom(data[0])
    return data
  }

  useEffect(() => { loadRooms() }, [])

  const connectWs = useCallback((roomId) => {
    if (wsRef.current) wsRef.current.close()
    const socket = new WebSocket(`ws://${window.location.hostname}:8030/api/chat/ws/${roomId}`)
    socket.onopen = () => setConnected(true)
    socket.onclose = () => setConnected(false)
    socket.onmessage = (e) => {
      const data = JSON.parse(e.data)
      setMessages(prev => [...prev, data])
      setPending(false)
    }
    wsRef.current = socket
    setWs(socket)
  }, [])

  useEffect(() => {
    if (!activeRoom) return
    fetch(`/api/chat/history/${activeRoom.id}`)
      .then(r => r.json())
      .then(data => setMessages(data.map(m => ({
        role: m.role, content: m.content,
        model_used: m.model_used, proposal: m.metadata?.proposal
      }))))
    connectWs(activeRoom.id)
    inputRef.current?.focus()
  }, [activeRoom])

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

  const createRoom = async () => {
    const res = await fetch('/api/rooms/', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'ห้องใหม่' })
    })
    const room = await res.json()
    await loadRooms()
    setActiveRoom(room)
  }

  const deleteRoom = async (e, room) => {
    e.stopPropagation()
    if (!confirm(`ลบห้อง "${room.name}" ใช่มั๊ย?`)) return
    await fetch(`/api/rooms/${room.id}`, { method: 'DELETE' })
    const data = await loadRooms()
    if (activeRoom?.id === room.id) setActiveRoom(data[0] || null)
  }

  const startEdit = (e, room) => {
    e.stopPropagation()
    setEditingRoom(room.id)
    setEditName(room.name)
  }

  const saveEdit = async (roomId) => {
    await fetch(`/api/rooms/${roomId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName })
    })
    setEditingRoom(null)
    await loadRooms()
  }

  const approveTeam = async (proposal, msgIndex) => {
    const res = await fetch('/api/teams/approve', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team_name: proposal.team_name, description: proposal.description, workers: proposal.workers })
    })
    const data = await res.json()
    if (data.success) {
      setMessages(prev => prev.map((m, i) => i === msgIndex ? { ...m, approved: true } : m))
      alert(`✅ สร้างทีม "${data.team_name}" เรียบร้อยแล้วค่ะ`)
    }
  }

  const modelShort = (m) => {
    if (!m) return ''
    if (m.includes('gemini-2.5-pro')) return 'Gemini 2.5 Pro'
    if (m.includes('gemini-2.5-flash')) return 'Gemini 2.5 Flash'
    if (m.includes('gemini-2.0')) return 'Gemini 2.0 Flash Lite'
    if (m.includes('Llama-3.3-70B')) return 'Llama 3.3 70B'
    if (m.includes('Llama-4-Scout')) return 'Llama 4 Scout'
    if (m.includes('Llama-3.1-8B')) return 'Llama 3.1 8B'
    return m.split('/').pop()
  }

  return (
    <div className="chat-layout">
      {/* Room Sidebar */}
      <div className="room-sidebar">
        <div className="room-header">
          <span>ห้องสนทนา</span>
          <button className="add-room-btn" onClick={createRoom} title="ห้องใหม่">+</button>
        </div>
        <div className="room-list">
          {rooms.map(r => (
            <div
              key={r.id}
              className={`room-item ${activeRoom?.id === r.id ? 'active' : ''}`}
              onClick={() => setActiveRoom(r)}
            >
              {editingRoom === r.id ? (
                <input
                  className="room-edit-input"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onBlur={() => saveEdit(r.id)}
                  onKeyDown={e => e.key === 'Enter' && saveEdit(r.id)}
                  autoFocus
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <>
                  <span className="room-name">💬 {r.name}</span>
                  <div className="room-actions">
                    <button onClick={e => startEdit(e, r)} title="เปลี่ยนชื่อ">✏️</button>
                    <button onClick={e => deleteRoom(e, r)} title="ลบห้อง">🗑️</button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="chat-area">
        <div className="chat-topbar">
          <span>{activeRoom ? `💬 ${activeRoom.name}` : 'เลือกห้องสนทนา'}</span>
          <span className={`ws-status ${connected ? 'online' : 'offline'}`}>
            {connected ? '🟢 Connected' : '🔴 Disconnected'}
          </span>
        </div>

        <div className="messages">
          {messages.length === 0 && (
            <div className="empty-chat">
              <div className="empty-icon">🤖</div>
              <div>สวัสดีค่ะ พี่การ์ด<br/>สั่งงาน Yujin ได้เลยค่ะ</div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`message ${m.role}`}>
              {m.role === 'yujin' && <YujinAvatar />}
              <div className="msg-body">
                <div className="bubble">{m.content}</div>
                {m.role === 'yujin' && m.model_used && (
                  <div className="model-badge">{modelShort(m.model_used)}</div>
                )}
                {m.proposal && !m.approved && (
                  <div className="proposal-card">
                    <div className="proposal-title">📋 เสนอทีม: {m.proposal.team_name}</div>
                    <p className="proposal-desc">{m.proposal.description}</p>
                    <div className="worker-list">
                      {m.proposal.workers?.map((w, wi) => (
                        <div key={wi} className="worker-row">
                          <span className="worker-name">{w.name}</span>
                          <span className="worker-role">{w.role}</span>
                          <span className="model-tag">{modelShort(w.llm_model)}</span>
                        </div>
                      ))}
                    </div>
                    <button className="approve-btn" onClick={() => approveTeam(m.proposal, i)}>
                      ✅ Approve & สร้างทีม
                    </button>
                  </div>
                )}
                {m.approved && <div className="approved-badge">✅ สร้างทีมแล้ว</div>}
              </div>
              {m.role === 'user' && <div className="avatar user-avatar">P</div>}
            </div>
          ))}
          {pending && (
            <div className="message yujin">
              <YujinAvatar />
              <div className="msg-body">
                <div className="bubble typing">
                  <span></span><span></span><span></span>
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="input-area">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="สั่งงาน Yujin... (Enter ส่ง, Shift+Enter ขึ้นบรรทัดใหม่)"
            disabled={!connected || pending || !activeRoom}
            rows={3}
          />
          <button
            className="send-btn"
            onClick={send}
            disabled={!connected || pending || !activeRoom || !input.trim()}
          >
            ส่ง
          </button>
        </div>
      </div>
    </div>
  )
}
