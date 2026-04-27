import { useState, useEffect, useRef } from 'react'

const ALL_MODELS = [
  { id: 'gemini-2.5-flash', label: '✦ Gemini 2.5 Flash', type: 'text' },
  { id: 'gemini-2.5-pro', label: '✦ Gemini 2.5 Pro', type: 'text' },
  { id: 'gemini-2.0-flash-lite', label: '✦ Gemini 2.0 Lite', type: 'text' },
  { id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', label: '🦙 Llama 3.3 70B', type: 'text' },
  { id: 'meta-llama/Llama-4-Scout-17B-16E-Instruct', label: '🦙 Llama 4 Scout', type: 'text' },
  { id: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo', label: '🦙 Llama 3.1 8B', type: 'text' },
  { id: 'gemini-2.5-flash-image', label: '🎨 Flash Image', type: 'image' },
  { id: 'gemini-3.1-flash-image-preview', label: '🎨 Nano Banana 2', type: 'image' },
  { id: 'gemini-3-pro-image-preview', label: '🎨 Nano Banana Pro', type: 'image' },
]

const TOOLS = ['shell_tool', 'db_tool', 'file_tool', 'image_tool']
const TOOL_LABELS = { shell_tool: '💻 Shell', db_tool: '🗄️ DB', file_tool: '📄 File', image_tool: '🎨 Image' }
const EMPTY_FORM = { name: '', role: '', llm_model: 'gemini-2.5-flash', capabilities: [], avatar: '', personality: '', speech_style: '', skills: [], system_prompt: '' }

function AvatarDisplay({ avatar, name, size = 40 }) {
  if (avatar?.startsWith('/')) return (
    <img src={avatar} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid #e5e5ea' }} />
  )
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: '#f3e8ff', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, fontWeight: 700, flexShrink: 0 }}>
      {avatar || name?.charAt(0) || '?'}
    </div>
  )
}

// ─── Worker Form Modal ────────────────────────────────────────────────────────
function WorkerFormModal({ initial, skills, onClose, onSaved }) {
  const isEdit = !!initial
  const [form, setForm] = useState({ ...EMPTY_FORM, ...(initial || {}), capabilities: initial?.capabilities || [], skills: initial?.skills || [] })
  const [avatarPreview, setAvatarPreview] = useState(initial?.avatar?.startsWith('/') ? initial.avatar : null)
  const [avatarFile, setAvatarFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef(null)

  const handleAvatarChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const toggleCap = (cap) => setForm(p => ({
    ...p, capabilities: p.capabilities.includes(cap) ? p.capabilities.filter(c => c !== cap) : [...p.capabilities, cap]
  }))
  const toggleSkill = (id) => setForm(p => ({
    ...p, skills: p.skills.includes(id) ? p.skills.filter(s => s !== id) : [...p.skills, id]
  }))

  const save = async () => {
    if (!form.name.trim() || !form.role.trim()) return
    setSaving(true)
    try {
      let savedId = initial?.id
      if (isEdit) {
        await fetch(`/api/worker-library/${initial.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form)
        })
      } else {
        const res = await fetch('/api/worker-library/', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form)
        })
        const data = await res.json()
        savedId = data.id
      }
      if (avatarFile && savedId) {
        const fd = new FormData()
        fd.append('file', avatarFile)
        await fetch(`/api/worker-library/${savedId}/avatar`, { method: 'POST', body: fd })
      }
    } finally {
      setSaving(false)
    }
    onSaved()
    onClose()
  }

  const canSave = form.name.trim() && form.role.trim() && !saving

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'white', borderRadius: 20, width: 640, maxWidth: '95vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 12px 48px rgba(0,0,0,0.2)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: '1px solid #f0eeff', flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
            {isEdit ? `✏️ แก้ไข: ${initial.name}` : '👤 Worker ใหม่'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#bbb', lineHeight: 1 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px 24px' }}>

          {/* Avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18, padding: 14, background: '#fafafa', borderRadius: 12, border: '1px solid #e5e5ea' }}>
            <div style={{ position: 'relative', cursor: 'pointer', flexShrink: 0 }} onClick={() => fileInputRef.current?.click()}>
              {avatarPreview
                ? <img src={avatarPreview} alt="preview" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '3px solid #7c3aed' }} />
                : <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#ede9fe', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', border: '3px dashed #c4b5fd' }}>
                    {form.avatar && !form.avatar.startsWith('/') ? form.avatar : '👤'}
                  </div>
              }
              <div style={{ position: 'absolute', bottom: 0, right: 0, background: '#7c3aed', color: 'white', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', border: '2px solid white' }}>📷</div>
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: 3 }}>รูป Profile</div>
              <div style={{ fontSize: '0.72rem', color: '#888', marginBottom: 7 }}>JPG, PNG, GIF, WEBP · ไม่เกิน 5MB</div>
              <button onClick={() => fileInputRef.current?.click()} style={{ background: '#ede9fe', color: '#7c3aed', border: '1px solid #c4b5fd', borderRadius: 7, padding: '4px 12px', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600 }}>🗂️ Browse...</button>
              {avatarFile && <span style={{ marginLeft: 8, fontSize: '0.72rem', color: '#059669' }}>✓ {avatarFile.name}</span>}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
          </div>

          {/* Name + emoji avatar */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 600 }}>ชื่อ <span style={{ color: '#f87171' }}>*</span></label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="เช่น มายด์"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e5e5ea', fontSize: '0.9rem', boxSizing: 'border-box', marginTop: 4 }} />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 600 }}>Avatar (emoji) — ถ้าไม่อัปโหลดรูป</label>
              <input value={form.avatar?.startsWith('/') ? '' : (form.avatar || '')} onChange={e => setForm(p => ({ ...p, avatar: e.target.value }))} placeholder="เช่น 🧠"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e5e5ea', fontSize: '0.9rem', boxSizing: 'border-box', marginTop: 4 }} />
            </div>
          </div>

          {/* Role */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 600 }}>บทบาท / Role <span style={{ color: '#f87171' }}>*</span></label>
            <input value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} placeholder="เช่น นักเขียนบทความ SEO มืออาชีพ"
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e5e5ea', fontSize: '0.9rem', boxSizing: 'border-box', marginTop: 4 }} />
          </div>

          {/* Model */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 600 }}>Model</label>
            <select value={form.llm_model} onChange={e => setForm(p => ({ ...p, llm_model: e.target.value }))}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e5e5ea', fontSize: '0.9rem', marginTop: 4, boxSizing: 'border-box', background: 'white', cursor: 'pointer' }}>
              {['text', 'image'].map(type => (
                <optgroup key={type} label={type === 'text' ? '🧠 Text Models' : '🎨 Image Models'}>
                  {ALL_MODELS.filter(m => m.type === type).map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Tools */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 600 }}>Tools / Capabilities</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              {TOOLS.map(c => (
                <span key={c} onClick={() => toggleCap(c)}
                  style={{ padding: '5px 12px', borderRadius: 20, fontSize: '0.78rem', cursor: 'pointer',
                    background: form.capabilities.includes(c) ? '#7c3aed' : '#f3f4f6',
                    color: form.capabilities.includes(c) ? 'white' : '#555',
                    border: `1.5px solid ${form.capabilities.includes(c) ? '#7c3aed' : '#e5e5ea'}` }}>
                  {form.capabilities.includes(c) ? '✓ ' : ''}{TOOL_LABELS[c]}
                </span>
              ))}
            </div>
          </div>

          {/* Personality */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 600 }}>นิสัย / บุคลิก</label>
            <textarea value={form.personality} onChange={e => setForm(p => ({ ...p, personality: e.target.value }))} rows={2}
              placeholder="เช่น ละเอียด รอบคอบ ชอบตรวจสอบซ้ำ"
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e5e5ea', fontSize: '0.85rem', resize: 'vertical', boxSizing: 'border-box', marginTop: 4, fontFamily: 'inherit' }} />
          </div>

          {/* Speech style */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 600 }}>สไตล์การพูด</label>
            <textarea value={form.speech_style} onChange={e => setForm(p => ({ ...p, speech_style: e.target.value }))} rows={2}
              placeholder="เช่น พูดสั้น กระชับ ตรงประเด็น"
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e5e5ea', fontSize: '0.85rem', resize: 'vertical', boxSizing: 'border-box', marginTop: 4, fontFamily: 'inherit' }} />
          </div>

          {/* Skills */}
          {skills.length > 0 && (
            <div>
              <label style={{ fontSize: '0.8rem', color: '#555', fontWeight: 600 }}>📚 Skills</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                {skills.map(s => {
                  const sel = form.skills.includes(s.id)
                  const isLib = s._source === 'library'
                  return (
                    <span key={s.id} onClick={() => toggleSkill(s.id)}
                      style={{ padding: '5px 12px', borderRadius: 20, fontSize: '0.75rem', cursor: 'pointer',
                        background: sel ? (isLib ? '#1d4ed8' : '#059669') : '#f3f4f6',
                        color: sel ? 'white' : '#555',
                        border: `1.5px solid ${sel ? (isLib ? '#1d4ed8' : '#059669') : '#e5e5ea'}` }}>
                      {sel ? '✓ ' : ''}{s.name}
                      {!sel && <span style={{ fontSize: '0.6rem', marginLeft: 4, opacity: 0.5 }}>{'📚'}</span>}
                    </span>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '14px 24px 20px', borderTop: '1px solid #f0eeff', flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 10, border: '1.5px solid #e5e5ea', background: 'white', cursor: 'pointer', fontSize: '0.88rem' }}>ยกเลิก</button>
          <button onClick={save} disabled={!canSave}
            style={{ padding: '9px 22px', borderRadius: 10, border: 'none', background: canSave ? '#7c3aed' : '#c4b5fd', color: 'white', fontWeight: 700, cursor: canSave ? 'pointer' : 'default', fontSize: '0.88rem' }}>
            {saving ? '⏳ กำลังบันทึก...' : '💾 บันทึก'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function WorkerLibrary() {
  const [templates, setTemplates] = useState([])
  const [skills, setSkills] = useState([])
  const [formModal, setFormModal] = useState(null)   // null | { initial }

  const load = async () => {
    const [tmpl, yujinSk, libSk] = await Promise.all([
      fetch('/api/worker-library/').then(r => r.json()),
      fetch('/api/skills/').then(r => r.json()),
      fetch('http://119.59.103.122:8040/api/skills/').then(r => r.json()).catch(() => []),
    ])
    // merge: library skills ใส่ prefix source เพื่อแยกแสดง
    const merged = [
      ...yujinSk.map(s => ({ ...s, _source: 'yujin' })),
      ...libSk.map(s => ({ ...s, _source: 'library' })),
    ]
    setTemplates(tmpl); setSkills(merged)
  }

  useEffect(() => { load() }, [])

  const del = async (id) => {
    if (!confirm('ลบ worker template นี้?')) return
    await fetch(`/api/worker-library/${id}`, { method: 'DELETE' })
    await load()
  }

  const modelLabel = (id) => ALL_MODELS.find(m => m.id === id)?.label || id

  return (
    <div style={{ padding: 24, flex: 1, overflowY: 'auto', height: '100vh' }}>

      {formModal !== null && (
        <WorkerFormModal
          initial={formModal.initial}
          skills={skills}
          onClose={() => setFormModal(null)}
          onSaved={load}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: '1.2rem' }}>👤 Worker Library</h2>
        <button onClick={() => setFormModal({ initial: null })}
          style={{ background: '#7c3aed', color: 'white', border: 'none', borderRadius: 10, padding: '8px 16px', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600 }}>
          + Worker ใหม่
        </button>
      </div>

      {templates.length === 0 && (
        <div style={{ textAlign: 'center', color: '#aaa', marginTop: 60 }}>
          <div style={{ fontSize: '3rem' }}>👤</div>
          <div>ยังไม่มี Worker template ค่ะ</div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {templates.map(t => (
          <div key={t.id} style={{ background: 'white', border: '1px solid #e5e5ea', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <AvatarDisplay avatar={t.avatar} name={t.name} size={44} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{t.name}</div>
              <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: 6 }}>{t.role}</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                <span style={{ background: '#fff1f2', color: '#be123c', fontSize: '0.7rem', padding: '2px 8px', borderRadius: 10, border: '1px solid #fecdd3' }}>{modelLabel(t.llm_model)}</span>
                {(t.capabilities || []).map(c => (
                  <span key={c} style={{ background: '#f0fdf4', color: '#15803d', fontSize: '0.65rem', padding: '2px 6px', borderRadius: 10, border: '1px solid #bbf7d0' }}>{TOOL_LABELS[c] || c}</span>
                ))}
              </div>
              {(t.skills || []).length > 0 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 5 }}>
                  {(t.skills || []).map(sid => {
                    const sk = skills.find(s => s.id === sid)
                    if (!sk) return null
                    const isLib = sk._source === 'library'
                    return (
                      <span key={sid} style={{ background: '#eff6ff', color: '#1d4ed8', fontSize: '0.65rem', padding: '2px 7px', borderRadius: 10, border: '1px solid #bfdbfe' }}>
                        📚 {sk.name}
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button onClick={() => setFormModal({ initial: t })}
                style={{ background: '#f3f4f6', color: '#555', border: 'none', borderRadius: 8, padding: '6px 10px', fontSize: '0.78rem', cursor: 'pointer' }}>✏️</button>
              <button onClick={() => del(t.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', opacity: 0.5, padding: '6px' }}>🗑️</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
