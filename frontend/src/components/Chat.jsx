import { useState, useEffect, useRef } from 'react'

export default function Chat() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [ws, setWs] = useState(null)
  const [connected, setConnected] = useState(false)
  const [pending, setPending] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    const socket = new WebSocket(`ws://${window.location.host}/api/chat/ws`)
    socket.onopen = () => setConnected(true)
    socket.onclose = () => setConnected(false)
    socket.onmessage = (e) => {
      const data = JSON.parse(e.data)
      setMessages(prev => [...prev, data])
      setPending(false)
    }
    setWs(socket)

    fetch('/api/chat/history')
      .then(r => r.json())
      .then(data => setMessages(data.map(m => ({
        role: m.role, content: m.content, proposal: m.metadata?.proposal
      }))))

    return () => socket.close()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = () => {
    if (!input.trim() || !connected || pending) return
    const msg = { role: 'user', content: input }
    setMessages(prev => [...prev, msg])
    ws.send(JSON.stringify({ message: input }))
    setInput('')
    setPending(true)
  }

  const approveTeam = async (proposal, msgIndex) => {
    const res = await fetch('/api/teams/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        team_name: proposal.team_name,
        description: proposal.description,
        workers: proposal.workers
      })
    })
    const data = await res.json()
    if (data.success) {
      setMessages(prev => prev.map((m, i) =>
        i === msgIndex ? { ...m, approved: true } : m
      ))
      alert(`✅ สร้างทีม "${data.team_name}" เรียบร้อยแล้วค่ะ`)
    }
  }

  return (
    <div className="chat-container">
      <div className="messages">
        {messages.map((m, i) => (
          <div key={i} className={`message ${m.role}`}>
            <div className="bubble">{m.content}</div>
            {m.proposal && !m.approved && (
              <div className="proposal-card">
                <h4>📋 แผน Team: {m.proposal.team_name}</h4>
                <p>{m.proposal.description}</p>
                <ul>
                  {m.proposal.workers?.map((w, wi) => (
                    <li key={wi}><b>{w.name}</b> — {w.role} <span className="model-tag">{w.llm_model}</span></li>
                  ))}
                </ul>
                <button className="approve-btn" onClick={() => approveTeam(m.proposal, i)}>
                  ✅ Approve & สร้าง Team
                </button>
              </div>
            )}
            {m.approved && <div className="approved-badge">✅ Approved</div>}
          </div>
        ))}
        {pending && <div className="message yujin"><div className="bubble typing">Yujin กำลังคิด...</div></div>}
        <div ref={bottomRef} />
      </div>
      <div className="input-area">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="สั่งงาน Yujin..."
          disabled={!connected || pending}
        />
        <button onClick={send} disabled={!connected || pending}>ส่ง</button>
        <span className={`status ${connected ? 'online' : 'offline'}`}>
          {connected ? '🟢' : '🔴'}
        </span>
      </div>
    </div>
  )
}
