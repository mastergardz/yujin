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
  'gemini-2.5-flash-image': '🎨 Flash Image',
  'gemini-3.1-flash-image-preview': '🎨 Nano Banana 2',
  'gemini-3-pro-image-preview': '🎨 Nano Banana Pro',
}

function getWorkerColor(name, names) {
  const idx = names.indexOf(name)
  return WORKER_COLORS[Math.abs(idx === -1 ? name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) : idx) % WORKER_COLORS.length]
}

function WsContent({ content }) {
  if (!content) return null
  const TOKEN = /(!?\[.*?\]\([^\)]+\)|\/api\/files\/download\/\S+)/g
  const parts = content.split(TOKEN)
  const isImgUrl = (url) => /\.(png|jpg|jpeg|gif|webp)$/i.test(url.split('?')[0])
  return (
    <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
      {parts.map((part, i) => {
        const mdImg = part.match(/^!\[(.*?)\]\(([^\)]+)\)$/)
        if (mdImg) {
          const [, alt, url] = mdImg
          return (
            <span key={i} style={{ display: 'block', margin: '8px 0' }}>
              <img src={url} alt={alt} style={{ maxWidth: '100%', maxHeight: 400, borderRadius: 10, display: 'block', marginBottom: 4, border: '1px solid #e5e5ea' }} />
              {url.startsWith('/api/files/') && <a href={url} download style={{ fontSize: '0.75rem', color: '#7c3aed' }}>⬇️ ดาวน์โหลด</a>}
            </span>
          )
        }
        const mdLink = part.match(/^\[(.*?)\]\(([^\)]+)\)$/)
        if (mdLink) {
          const [, label, url] = mdLink
          if (url.startsWith('/api/files/download/')) {
            if (isImgUrl(url)) return (
              <span key={i} style={{ display: 'block', margin: '8px 0' }}>
                <img src={url} alt={label} style={{ maxWidth: '100%', maxHeight: 400, borderRadius: 10, display: 'block', marginBottom: 4 }} />
                <a href={url} download style={{ fontSize: '0.75rem', color: '#7c3aed' }}>⬇️ {label}</a>
              </span>
            )
            return <a key={i} href={url} download style={{ color: '#7c3aed', textDecoration: 'underline' }}>📎 {label}</a>
          }
          return <span key={i}>{label}</span>
        }
        if (part.startsWith('/api/files/download/')) {
          const fname = part.split('/').pop()
          return <a key={i} href={part} download style={{ color: '#7c3aed', textDecoration: 'underline' }}>📎 {fname}</a>
        }
        return <span key={i}>{part}</span>
      })}
    </span>
  )
}

function Avatar({ sender, senderType, memberNames, members }) {
  if (senderType === 'yujin') return <YujinAvatar size={32} />
  if (senderType === 'user') return <img src="/gard.png" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} alt="พี่การ์ด" />
  const member = members?.find(m => m.name === sender)
  const color = getWorkerColor(sender, memberNames)
  if (member?.avatar && member.avatar.startsWith('/')) {
    return <img src={member.avatar} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} alt={sender} />
  }
  return (
    <div style={{ width: 32, height: 32, borderRadius: '50%', background: color.bg, color: color.text, border: `1px solid ${color.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0 }}>
      {member?.avatar || sender.charAt(0)}
    </div>
  )
}

const ACCEPT = 'image/*,.txt,.csv,.json,.md,.py,.js,.ts,.jsx,.tsx,.html,.css,.pdf,.xlsx,.xls,.docx'

// ─── Create / Edit Modal ─────────────────────────────────────────────────────
function ProjectFormModal({ project, onClose, onSaved }) {
  const [name, setName] = useState(project?.name || '')
  const [desc, setDesc] = useState(project?.description || '')
  const [library, setLibrary] = useState([])
  const [selectedIds, setSelectedIds] = useState(
    (project?.members || []).map(m => m.template_id).filter(Boolean)
  )
  const [saving, setSaving] = useState(false)
  const isEdit = !!project

  useEffect(() => {
    fetch('/api/worker-library/').then(r => r.json()).then(setLibrary)
  }, [])

  const toggleWorker = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const save = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      if (isEdit) {
        // 1. update name/desc
        await fetch(`/api/projects/${project.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, description: desc }),
        })
        // 2. sync members: only touch members that have a template_id (library-backed)
        const currentIds = (project.members || []).map(m => ({ id: m.id, tid: m.template_id }))
        // only remove library-backed members that were unticked
        const toRemove = currentIds.filter(x => x.tid && !selectedIds.includes(x.tid))
        // only add ticked ids not already present
        const toAdd = selectedIds.filter(tid => !currentIds.some(x => x.tid === tid))
        await Promise.all([
          ...toRemove.map(x => fetch(`/api/projects/${project.id}/members/${x.id}`, { method: 'DELETE' })),
          ...toAdd.map(tid => fetch(`/api/projects/${project.id}/members`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ template_id: tid }),
          })),
        ])
      } else {
        // create new
        await fetch('/api/projects/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, description: desc, member_template_ids: selectedIds }),
        })
      }
      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'white', borderRadius: 18, padding: 28, width: 480, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
        <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 20 }}>
          {isEdit ? '✏️ แก้ไข Workspace' : '➕ สร้าง Workspace ใหม่'}
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: '0.82rem', color: '#555', fontWeight: 600 }}>ชื่อ Workspace</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="ชื่อ workspace..."
            style={{ display: 'block', width: '100%', marginTop: 6, padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e5e5ea', fontSize: '0.95rem', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: '0.82rem', color: '#555', fontWeight: 600 }}>คำอธิบาย (ไม่บังคับ)</label>
          <textarea
            value={desc}
            onChange={e => setDesc(e.target.value)}
            placeholder="อธิบายวัตถุประสงค์ของ workspace..."
            rows={2}
            style={{ display: 'block', width: '100%', marginTop: 6, padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e5e5ea', fontSize: '0.9rem', resize: 'vertical', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: '0.82rem', color: '#555', fontWeight: 600 }}>เลือก Workers ({selectedIds.length} คน)</label>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 260, overflowY: 'auto' }}>
            {library.length === 0 && <div style={{ color: '#aaa', fontSize: '0.82rem' }}>ยังไม่มี worker ในคลัง</div>}
            {library.map(w => {
              const sel = selectedIds.includes(w.id)
              return (
                <div key={w.id}
                  onClick={() => toggleWorker(w.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12,
                    border: `2px solid ${sel ? '#7c3aed' : '#e5e5ea'}`,
                    background: sel ? '#f5f0ff' : 'white',
                    cursor: 'pointer', transition: 'all 0.12s',
                  }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#f3e8ff', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>
                    {w.avatar && w.avatar.startsWith('/')
                      ? <img src={w.avatar} style={{ width: 28, height: 28, objectFit: 'cover' }} alt={w.name} />
                      : (w.avatar || w.name.charAt(0))}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{w.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#888' }}>{w.role} · {MODEL_SHORT[w.llm_model] || w.llm_model}</div>
                  </div>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${sel ? '#7c3aed' : '#ccc'}`, background: sel ? '#7c3aed' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {sel && <span style={{ color: 'white', fontSize: '0.7rem', lineHeight: 1 }}>✓</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 10, border: '1.5px solid #e5e5ea', background: 'white', cursor: 'pointer', fontSize: '0.9rem' }}>ยกเลิก</button>
          <button onClick={save} disabled={saving || !name.trim()}
            style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: saving || !name.trim() ? '#c4b5fd' : '#7c3aed', color: 'white', fontWeight: 700, cursor: saving || !name.trim() ? 'default' : 'pointer', fontSize: '0.9rem' }}>
            {saving ? 'กำลังบันทึก...' : isEdit ? 'บันทึก' : 'สร้าง'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Project Room ────────────────────────────────────────────────────────────
function ProjectRoom({ project: initialProject, onBack, onRefresh }) {
  const [project, setProject] = useState(initialProject)
  const [messages, setMessages] = useState([])
  const [task, setTask] = useState('')
  const [connected, setConnected] = useState(false)
  const [running, setRunning] = useState(false)
  const [typingInfo, setTypingInfo] = useState(null)
  const [pendingFile, setPendingFile] = useState(null)
  const [showEdit, setShowEdit] = useState(false)
  const bottomRef = useRef(null)
  const wsRef = useRef(null)
  const reconnectTimer = useRef(null)
  const fileInputRef = useRef(null)
  const memberNames = (project.members || []).map(m => m.name)

  const reloadProject = async () => {
    const data = await fetch(`/api/projects/${project.id}`).then(r => r.json())
    setProject(data)
    if (onRefresh) onRefresh()
  }

  const connectWs = () => {
    if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close() }
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
    const socket = new WebSocket(`ws://${window.location.hostname}:8030/api/workspace/${project.id}/ws`)
    socket.onopen = () => setConnected(true)
    socket.onclose = () => {
      setConnected(false)
      reconnectTimer.current = setTimeout(connectWs, 3000)
    }
    socket.onmessage = (e) => {
      const data = JSON.parse(e.data)
      if (data.type === 'typing') {
        setTypingInfo({ sender: data.sender, senderType: data.sender_type })
        return
      }
      setTypingInfo(null)
      if (data.sender_type !== 'user') setRunning(false)
      setMessages(prev => [...prev, data])
    }
    wsRef.current = socket
  }

  useEffect(() => {
    fetch(`/api/workspace/${project.id}/history`).then(r => r.json()).then(setMessages)
    connectWs()
    return () => { if (reconnectTimer.current) clearTimeout(reconnectTimer.current) }
  }, [project.id])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, running, typingInfo])

  const runTask = () => {
    if ((!task.trim() && !pendingFile) || !connected || running || !wsRef.current) return
    setRunning(true)
    wsRef.current.send(JSON.stringify({ task, file_context: pendingFile?.content || '' }))
    setTask('')
    setPendingFile(null)
  }

  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''
    const isImg = file.type.startsWith('image/')
    if (isImg) {
      const preview = URL.createObjectURL(file)
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch('/api/files/analyze-image', { method: 'POST', body: fd })
      const data = await res.json()
      setPendingFile({ filename: file.name, content: data.analysis || '', preview })
    } else {
      const text = await file.text()
      setPendingFile({ filename: file.name, content: `[ไฟล์: ${file.name}]\n${text}`, preview: null })
    }
  }

  const handlePaste = (e) => {
    const imgItem = Array.from(e.clipboardData?.items || []).find(i => i.type.startsWith('image/'))
    if (!imgItem) return
    e.preventDefault()
    const file = imgItem.getAsFile()
    const preview = URL.createObjectURL(file)
    const fd = new FormData(); fd.append('file', file)
    fetch('/api/files/analyze-image', { method: 'POST', body: fd })
      .then(r => r.json())
      .then(data => setPendingFile({ filename: 'clipboard.png', content: data.analysis || '', preview }))
  }

  const canSend = connected && !running && (task.trim() || pendingFile)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', flex: 1 }}>
      {showEdit && (
        <ProjectFormModal
          project={project}
          onClose={() => setShowEdit(false)}
          onSaved={reloadProject}
        />
      )}

      {/* header */}
      <div className="workspace-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', padding: '2px 6px', color: '#7c3aed' }}>←</button>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="workspace-title">🗂️ {project.name}</span>
              <button onClick={() => setShowEdit(true)} title="แก้ไข"
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem', padding: '0 4px', opacity: 0.6, lineHeight: 1 }}>✏️</button>
            </div>
            <div className="workspace-workers">
              {(project.members || []).map(m => {
                const color = getWorkerColor(m.name, memberNames)
                return (
                  <span key={m.id} className="worker-chip" style={{ background: color.bg, color: color.text, border: `1px solid ${color.border}` }}>
                    {m.avatar && !m.avatar.startsWith('/') ? m.avatar : m.name.charAt(0)} {m.name} — {m.role}
                    {m.llm_model && <span style={{ display: 'block', fontSize: '0.65rem', opacity: 0.7, fontWeight: 400 }}>{MODEL_SHORT[m.llm_model] || m.llm_model}</span>}
                  </span>
                )
              })}
            </div>
          </div>
        </div>
        <span className={`ws-status ${connected ? 'online' : 'offline'}`}>{connected ? '🟢' : '🔴'}</span>
      </div>

      {/* messages */}
      <div className="workspace-messages">
        {messages.length === 0 && (
          <div className="empty-chat" style={{ marginTop: 40 }}>
            <div style={{ fontSize: '3rem' }}>🗂️</div>
            <div>สั่งงานทีมได้เลยค่ะ พี่</div>
          </div>
        )}
        {messages.map((m, i) => {
          const isYujin = m.sender_type === 'yujin'
          const isUser = m.sender_type === 'user'
          const color = (!isYujin && !isUser) ? getWorkerColor(m.sender, memberNames) : null
          const borderColor = isYujin ? '#7c3aed' : isUser ? '#fcd34d' : (color?.border || '#6b7280')
          const senderColor = isYujin ? '#7c3aed' : isUser ? '#92400e' : (color?.text || '#374151')
          return (
            <div key={i} className="ws-msg" style={{ borderLeft: `3px solid ${borderColor}` }}>
              <div className="ws-msg-header">
                <Avatar sender={m.sender} senderType={m.sender_type} memberNames={memberNames} members={project.members} />
                <span className="ws-sender" style={{ color: senderColor }}>{m.sender}</span>
                <span className="ws-time">{new Date(m.created_at.endsWith('Z') ? m.created_at : m.created_at + 'Z').toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok' })}</span>
              </div>
              <div className="ws-content"><WsContent content={m.content} /></div>
            </div>
          )
        })}
        {(running || typingInfo) && (() => {
          const who = typingInfo || { sender: 'ยูจิน', senderType: 'yujin' }
          const isYujin = who.senderType === 'yujin'
          const color = !isYujin ? getWorkerColor(who.sender, memberNames) : null
          const borderColor = isYujin ? '#7c3aed' : (color?.border || '#6b7280')
          const senderColor = isYujin ? '#7c3aed' : (color?.text || '#374151')
          return (
            <div className="ws-msg" style={{ borderLeft: `3px solid ${borderColor}` }}>
              <div className="ws-msg-header">
                <Avatar sender={who.sender} senderType={who.senderType} memberNames={memberNames} members={project.members} />
                <span className="ws-sender" style={{ color: senderColor }}>{who.sender}</span>
              </div>
              <div className="bubble typing"><span /><span /><span /></div>
            </div>
          )
        })()}
        <div ref={bottomRef} />
      </div>

      {pendingFile && (
        <div style={{ padding: '8px 16px', background: '#f5f0ff', borderTop: '1px solid #e9d5ff', display: 'flex', alignItems: 'center', gap: 8 }}>
          {pendingFile.preview ? <img src={pendingFile.preview} style={{ height: 36, borderRadius: 6, objectFit: 'cover' }} alt="preview" /> : <span style={{ fontSize: '1.2rem' }}>📄</span>}
          <span style={{ fontSize: '0.8rem', color: '#7c3aed', flex: 1 }}>📎 {pendingFile.filename}</span>
          <button onClick={() => setPendingFile(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}>✕</button>
        </div>
      )}

      <div className="workspace-input">
        <input type="file" ref={fileInputRef} accept={ACCEPT} onChange={handleFileChange} style={{ display: 'none' }} />
        <button onClick={() => fileInputRef.current.click()} disabled={!canSend} title="แนบไฟล์"
          style={{ background: 'none', border: '1.5px solid #e5e5ea', borderRadius: 8, padding: '8px 10px', cursor: 'pointer', fontSize: '1.1rem', color: '#7c3aed', flexShrink: 0, opacity: !canSend ? 0.4 : 1 }}>📎</button>
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
          {running ? '⏳' : 'ส่ง'}
        </button>
      </div>
    </div>
  )
}

// ─── Main Workspace ───────────────────────────────────────────────────────────
export default function Workspace() {
  const [projects, setProjects] = useState([])
  const [activeProject, setActiveProject] = useState(null)
  const [showCreate, setShowCreate] = useState(false)

  const loadProjects = async () => {
    const data = await fetch('/api/projects/').then(r => r.json())
    setProjects(data)
    return data
  }

  useEffect(() => { loadProjects() }, [])

  const deleteProject = async (e, p) => {
    e.stopPropagation()
    if (!confirm(`ลบ project "${p.name}" ใช่มั๊ย?`)) return
    await fetch(`/api/projects/${p.id}`, { method: 'DELETE' })
    loadProjects()
    if (activeProject?.id === p.id) setActiveProject(null)
  }

  if (activeProject) {
    return (
      <ProjectRoom
        project={activeProject}
        onBack={() => { setActiveProject(null); loadProjects() }}
        onRefresh={loadProjects}
      />
    )
  }

  return (
    <div style={{ padding: 24, flex: 1, overflowY: 'auto' }}>
      {showCreate && (
        <ProjectFormModal
          project={null}
          onClose={() => setShowCreate(false)}
          onSaved={loadProjects}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: '1.2rem' }}>🗂️ Workspace</h2>
        <button onClick={() => setShowCreate(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, border: 'none', background: '#7c3aed', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '0.88rem' }}>
          ➕ สร้าง Workspace
        </button>
      </div>

      {projects.length === 0 && (
        <div style={{ textAlign: 'center', color: '#aaa', marginTop: 60 }}>
          <div style={{ fontSize: '3rem' }}>🗂️</div>
          <div>ยังไม่มี workspace ค่ะ</div>
          <div style={{ fontSize: '0.82rem', marginTop: 8 }}>กด "สร้าง Workspace" หรือให้ ยูจิน สร้างจากหน้า Chat</div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {projects.map(p => (
          <div key={p.id}
            onClick={() => setActiveProject(p)}
            style={{ background: 'white', border: '1px solid #e5e5ea', borderRadius: 14, padding: '16px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, transition: 'box-shadow 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 12px rgba(124,58,237,0.1)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
          >
            <div style={{ width: 44, height: 44, borderRadius: 12, background: '#f3e8ff', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0 }}>🗂️</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.98rem', marginBottom: 3 }}>{p.name}</div>
              <div style={{ fontSize: '0.78rem', color: '#888', marginBottom: 6 }}>{p.description || '—'}</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {(p.members || []).map(m => (
                  <span key={m.id} style={{ fontSize: '0.7rem', background: '#f3e8ff', color: '#7c3aed', padding: '2px 8px', borderRadius: 10, border: '1px solid #e9d5ff' }}>
                    {m.avatar && !m.avatar.startsWith('/') ? m.avatar + ' ' : ''}{m.name}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <span style={{ fontSize: '0.75rem', color: '#aaa', whiteSpace: 'nowrap' }}>
                {new Date(p.created_at).toLocaleDateString('th-TH')}
              </span>
              <button onClick={e => deleteProject(e, p)} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5, fontSize: '1rem', padding: '2px 6px' }}>🗑️</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
