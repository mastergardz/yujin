import { useState, useEffect, useRef, useCallback } from 'react'
import JSZip from 'jszip'
import { marked } from 'marked'

const LIBRARY_URL = 'http://119.59.103.122:8040'

const CATEGORIES = [
  { value: 'general',       label: '🗂 General' },
  { value: 'coding',        label: '💻 Coding' },
  { value: 'writing',       label: '✍️ Writing' },
  { value: 'analysis',      label: '🔍 Analysis' },
  { value: 'image',         label: '🖼 Image' },
  { value: 'workflow',      label: '⚙️ Workflow' },
  { value: 'communication', label: '💬 Communication' },
  { value: 'research',      label: '🔬 Research' },
  { value: 'translation',   label: '🌐 Translation' },
  { value: 'marketing',     label: '📣 Marketing' },
  { value: 'legal',         label: '⚖️ Legal & Compliance' },
]

function catLabel(val) {
  return CATEGORIES.find(c => c.value === val)?.label || val
}

// ─── Tag Input ────────────────────────────────────────────────────────────────
function TagInput({ tags, onChange }) {
  const [input, setInput] = useState('')
  const add = (val) => {
    const v = val.trim()
    if (v && !tags.includes(v)) onChange([...tags, v])
    setInput('')
  }
  const remove = (t) => onChange(tags.filter(x => x !== t))
  return (
    <div style={{ border: '1.5px solid #e5e5ea', borderRadius: 9, padding: '6px 10px', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', background: 'white', minHeight: 40, cursor: 'text' }}>
      {tags.map(t => (
        <span key={t} style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '0.8rem', padding: '2px 8px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
          #{t}
          <button onClick={() => remove(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0369a1', padding: 0, fontSize: '0.8rem', lineHeight: 1 }}>✕</button>
        </span>
      ))}
      <input value={input} onChange={e => setInput(e.target.value)}
        onKeyDown={e => {
          if ((e.key === 'Enter' || e.key === ',') && input.trim()) { e.preventDefault(); add(input) }
          if (e.key === 'Backspace' && !input && tags.length) remove(tags[tags.length - 1])
        }}
        onBlur={() => input.trim() && add(input)}
        placeholder={tags.length === 0 ? 'พิมพ์แล้วกด Enter เพื่อเพิ่ม' : ''}
        style={{ border: 'none', outline: 'none', fontSize: '0.85rem', flex: 1, minWidth: 100, background: 'transparent', fontFamily: 'inherit' }} />
    </div>
  )
}

// ─── Skill Form Modal ─────────────────────────────────────────────────────────
function RefRow({ ref: r, onChange, onRemove }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 10 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <input
          value={r.path}
          onChange={e => onChange({ ...r, path: e.target.value })}
          placeholder="path เช่น references/script.md"
          style={{ width: '100%', padding: '6px 10px', borderRadius: 7, border: '1.5px solid #e5e7eb', fontSize: '0.78rem', fontFamily: 'monospace', boxSizing: 'border-box' }}
        />
        <textarea
          value={r.content}
          onChange={e => onChange({ ...r, content: e.target.value })}
          placeholder="เนื้อหา reference..."
          rows={6}
          style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1.5px solid #e5e7eb', fontSize: '0.78rem', fontFamily: 'monospace', resize: 'vertical', boxSizing: 'border-box' }}
        />
      </div>
      <button onClick={onRemove}
        style={{ padding: '5px 9px', borderRadius: 6, border: '1px solid #fca5a5', background: 'white', color: '#dc2626', cursor: 'pointer', fontSize: '0.8rem', flexShrink: 0, marginTop: 2 }}>✕</button>
    </div>
  )
}

function SkillFormModal({ initial, onClose, onSaved }) {
  const isEdit = !!initial
  const [form, setForm] = useState({
    name: initial?.name || '',
    description: initial?.description || '',
    category: initial?.category || 'general',
    tags: initial?.tags || [],
    content: initial?.content || '',
    refs: initial?.refs || [],
    version: initial?.version || 'v1.0',
  })
  const [saving, setSaving] = useState(false)
  const [skillFileLoaded, setSkillFileLoaded] = useState(false)
  const skillFileRef = useRef(null)
  const refFileRef = useRef(null)

  useEffect(() => {
    if (initial?.id) {
      // โหลด refs จาก server ถ้าเป็น edit
      fetch(`/api/skills/${initial.id}`)
        .then(r => r.json())
        .then(d => setForm(p => ({ ...p, refs: d.refs || [] })))
        .catch(() => {})
    }
  }, [initial?.id])

  const handleSkillFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    try {
      const zip = await JSZip.loadAsync(file)
      let skillContent = ''
      const loadedRefs = []
      for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
        if (zipEntry.dir) continue
        const parts = relativePath.split('/')
        const filename = parts[parts.length - 1]
        if (filename === 'SKILL.md') {
          skillContent = await zipEntry.async('string')
        } else if (relativePath.includes('references/') && filename.endsWith('.md')) {
          const refContent = await zipEntry.async('string')
          const refPath = parts.slice(parts.findIndex(p => p === 'references')).join('/')
          loadedRefs.push({ path: refPath, content: refContent })
        }
      }
      if (skillContent) setForm(p => ({ ...p, content: skillContent }))
      if (loadedRefs.length > 0) setForm(p => ({ ...p, refs: loadedRefs }))
      setSkillFileLoaded(true)
    } catch {
      alert('ไม่สามารถอ่านไฟล์ .skill ได้ค่ะ')
    }
  }

  const uploadRef = (e) => {
    const files = Array.from(e.target.files || [])
    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = ev => {
        setForm(p => ({ ...p, refs: [...p.refs, { path: `references/${file.name}`, content: ev.target.result }] }))
      }
      reader.readAsText(file)
    })
    e.target.value = ''
  }

  const save = async () => {
    if (!form.name.trim() || !form.content.trim()) return
    setSaving(true)
    const body = { name: form.name, description: form.description, category: form.category, tags: form.tags, content: form.content, refs: form.refs, version: form.version }
    if (isEdit) {
      await fetch(`/api/skills/${initial.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    } else {
      await fetch('/api/skills/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    }
    setSaving(false)
    onSaved()
    onClose()
  }

  const canSave = form.name.trim() && form.content.trim() && !saving

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'white', borderRadius: 20, width: 780, maxWidth: '95vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 12px 48px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: '1px solid #f0eeff', flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
            {isEdit ? `✏️ แก้ไข: ${initial.name}` : '✨ Skill ใหม่'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#bbb', lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Upload .skill banner */}
          <div style={{
            background: skillFileLoaded ? '#f0fdf4' : '#eff6ff',
            border: `1px solid ${skillFileLoaded ? '#86efac' : '#bfdbfe'}`,
            borderRadius: 10, padding: '11px 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          }}>
            <div>
              <div style={{ fontSize: '0.83rem', fontWeight: 600, color: skillFileLoaded ? '#16a34a' : '#1d4ed8' }}>
                {skillFileLoaded ? '✅ โหลด .skill ไฟล์แล้ว — content + references พร้อมแล้วค่า' : '📦 มีไฟล์ .skill มั้ยคะ?'}
              </div>
              {!skillFileLoaded && <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 2 }}>upload แล้ว content + references จะถูก fill ให้อัตโนมัติเลยค่า</div>}
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button onClick={() => skillFileRef.current?.click()}
                style={{ padding: '6px 14px', borderRadius: 8, border: '1.5px solid #bfdbfe', background: 'white', color: '#1d4ed8', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                {skillFileLoaded ? '🔄 เปลี่ยนไฟล์' : '📂 Upload .skill'}
              </button>
              {skillFileLoaded && (
                <button onClick={() => { setForm(p => ({ ...p, content: '', refs: [] })); setSkillFileLoaded(false) }}
                  style={{ padding: '6px 12px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: 'white', color: '#6b7280', cursor: 'pointer', fontSize: '0.8rem' }}>ล้าง</button>
              )}
            </div>
          </div>
          <input ref={skillFileRef} type="file" accept=".skill,.zip" style={{ display: 'none' }} onChange={handleSkillFile} />

          {/* Name */}
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>ชื่อ Skill <span style={{ color: '#f87171' }}>*</span></label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="เช่น SEO Copywriting Standard"
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: '0.88rem', boxSizing: 'border-box' }} />
          </div>

          {/* Description */}
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>คำอธิบาย</label>
            <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="สั้นๆ ว่า skill นี้ทำอะไร"
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: '0.88rem', boxSizing: 'border-box' }} />
          </div>

          {/* Category + Tags + Version */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.8fr 90px', gap: 12 }}>
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Category</label>
              <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: '0.85rem', fontFamily: 'inherit', background: 'white', cursor: 'pointer' }}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Tags <span style={{ color: '#aaa', fontWeight: 400, fontSize: '0.72rem' }}>(Enter หรือ , เพื่อเพิ่ม)</span></label>
              <TagInput tags={form.tags} onChange={tags => setForm(p => ({ ...p, tags }))} />
            </div>
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Version</label>
              <input value={form.version} onChange={e => setForm(p => ({ ...p, version: e.target.value }))}
                placeholder="v1.0"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: '0.85rem', fontFamily: 'monospace', boxSizing: 'border-box' }} />
            </div>
          </div>

          {/* Content */}
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
              เนื้อหา (Markdown) <span style={{ color: '#f87171' }}>*</span>
              {skillFileLoaded && <span style={{ fontSize: '0.7rem', color: '#16a34a', fontWeight: 400, marginLeft: 8 }}>✅ โหลดจาก SKILL.md</span>}
            </label>
            <textarea value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
              placeholder={'# มาตรฐาน\n- ข้อ 1\n- ข้อ 2\n\n## วิธีทำงาน\n...'}
              rows={12}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: '0.84rem', fontFamily: 'monospace', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.65 }} />
          </div>

          {/* Reference Files */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151' }}>
                Reference Files
                <span style={{ fontSize: '0.72rem', color: '#9ca3af', fontWeight: 400, marginLeft: 8 }}>({form.refs.length} ไฟล์)</span>
                {skillFileLoaded && form.refs.length > 0 && <span style={{ fontSize: '0.7rem', color: '#16a34a', fontWeight: 400, marginLeft: 8 }}>✅ โหลดจาก .skill</span>}
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => refFileRef.current?.click()}
                  style={{ padding: '5px 12px', borderRadius: 7, border: '1.5px solid #e5e7eb', background: 'white', color: '#374151', cursor: 'pointer', fontSize: '0.78rem' }}>📎 Upload .md</button>
                <button onClick={() => setForm(p => ({ ...p, refs: [...p.refs, { path: 'references/', content: '' }] }))}
                  style={{ padding: '5px 12px', borderRadius: 7, border: '1.5px solid #e5e7eb', background: 'white', color: '#374151', cursor: 'pointer', fontSize: '0.78rem' }}>+ เพิ่ม ref</button>
              </div>
            </div>
            <input ref={refFileRef} type="file" multiple accept=".md,.txt" style={{ display: 'none' }} onChange={uploadRef} />
            {form.refs.length === 0 ? (
              <div style={{ fontSize: '0.8rem', color: '#9ca3af', padding: '10px 0' }}>ยังไม่มี reference — กด "+ เพิ่ม ref" หรือ "📎 Upload .md" ค่า</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {form.refs.map((r, i) => (
                  <RefRow key={i} ref={r}
                    onChange={updated => setForm(p => ({ ...p, refs: p.refs.map((x, j) => j === i ? updated : x) }))}
                    onRemove={() => setForm(p => ({ ...p, refs: p.refs.filter((_, j) => j !== i) }))}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '14px 24px 20px', borderTop: '1px solid #f0eeff', flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 10, border: '1.5px solid #e5e5ea', background: 'white', cursor: 'pointer', fontSize: '0.88rem' }}>ยกเลิก</button>
          <button onClick={save} disabled={!canSave}
            style={{ padding: '9px 22px', borderRadius: 10, border: 'none', background: canSave ? '#7c3aed' : '#c4b5fd', color: 'white', fontWeight: 700, cursor: canSave ? 'pointer' : 'default', fontSize: '0.88rem' }}>
            {saving ? 'กำลังบันทึก...' : '💾 บันทึก'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Skill Detail Modal ───────────────────────────────────────────────────────
function SkillDetail({ skill, source, onClose, onEdit, onDelete }) {
  const isLibrary = source === 'library'
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'white', borderRadius: 18, width: 640, maxWidth: '95vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
        <div style={{ padding: '20px 24px 14px', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 6 }}>
                <span style={{ fontSize: '1.05rem', fontWeight: 700 }}>{skill.name}</span>
                <span style={{ fontSize: '0.7rem', padding: '2px 9px', borderRadius: 8, fontWeight: 700,
                  background: isLibrary ? '#eff6ff' : '#f5f0ff',
                  color: isLibrary ? '#1d4ed8' : '#7c3aed',
                  border: `1px solid ${isLibrary ? '#bfdbfe' : '#e9d5ff'}` }}>
                  {isLibrary ? '📦 Skills Library' : '🎙 AI Conductor'}
                </span>
                {skill.category && (
                  <span style={{ fontSize: '0.7rem', background: '#f3f4f6', color: '#6b7280', padding: '2px 9px', borderRadius: 8 }}>{catLabel(skill.category)}</span>
                )}
              </div>
              {skill.description && <div style={{ fontSize: '0.84rem', color: '#666', marginBottom: 6 }}>{skill.description}</div>}
              {skill.tags?.length > 0 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {skill.tags.map(t => <span key={t} style={{ fontSize: '0.68rem', background: '#e0f2fe', color: '#0369a1', padding: '1px 7px', borderRadius: 6 }}>#{t}</span>)}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
              {skill.version && (
                <span style={{ fontSize: '0.72rem', color: '#6b7280', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 5, padding: '2px 8px', fontFamily: 'monospace', fontWeight: 600 }}>
                  {skill.version}
                </span>
              )}
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#bbb', lineHeight: 1 }}>✕</button>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* SKILL.md content */}
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#7c3aed', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>📄 SKILL.md</div>
            <div style={{ background: '#f8f7ff', borderRadius: 12, padding: '14px 16px', border: '1px solid #ede9fe' }}>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.82rem', color: '#374151', fontFamily: 'inherit', lineHeight: 1.75 }}>
                {skill.content || '(ไม่มีเนื้อหา)'}
              </pre>
            </div>
          </div>
          {/* Reference files */}
          {skill.refs?.length > 0 && (
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0369a1', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>📎 Reference Files ({skill.refs.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {skill.refs.map((ref, i) => (
                  <details key={i} style={{ background: '#f0f9ff', borderRadius: 10, border: '1px solid #bae6fd', overflow: 'hidden' }}>
                    <summary style={{ padding: '9px 14px', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem', color: '#0369a1', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: '0.65rem', background: '#0369a1', color: 'white', padding: '1px 6px', borderRadius: 4, fontFamily: 'monospace' }}>{ref.path}</span>
                    </summary>
                    <div style={{ padding: '10px 14px', borderTop: '1px solid #bae6fd' }}>
                      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.79rem', color: '#374151', fontFamily: 'inherit', lineHeight: 1.7 }}>
                        {ref.content}
                      </pre>
                    </div>
                  </details>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px 18px', borderTop: '1px solid #f3f4f6', flexShrink: 0 }}>
          <div>
            {!isLibrary && (
              <a href={`/api/skills/${skill.id}/export`} download
                style={{ padding: '7px 14px', borderRadius: 9, border: '1.5px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, textDecoration: 'none', display: 'inline-block' }}>
                ⬇️ Download .skill
              </a>
            )}
          </div>
          {!isLibrary && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { onDelete(skill.id); onClose() }}
                style={{ padding: '8px 16px', borderRadius: 9, border: '1.5px solid #fca5a5', background: 'white', color: '#dc2626', cursor: 'pointer', fontSize: '0.85rem' }}>
                🗑️ ลบ
              </button>
              <button onClick={() => { onClose(); onEdit(skill) }}
                style={{ padding: '8px 18px', borderRadius: 9, border: 'none', background: '#7c3aed', color: 'white', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>
                ✏️ แก้ไข
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Skill Card ───────────────────────────────────────────────────────────────
function SkillCard({ skill, source, onClick }) {
  const isLibrary = source === 'library'
  const cat = skill.category || 'general'
  return (
    <div onClick={onClick} style={{
      background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
      padding: 16, cursor: 'pointer', transition: 'all 0.15s',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column',
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#93c5fd'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(37,99,235,0.08)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)' }}>
      {/* Row 1: category + version */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ede9fe', display: 'inline-block' }}>
          {catLabel(cat)}
        </span>
        {skill.version && (
          <span style={{ fontSize: 11, color: '#6b7280', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 4, padding: '1px 6px', fontFamily: 'monospace' }}>
            {skill.version}
          </span>
        )}
      </div>
      {/* Row 2: name */}
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6, color: '#1a1a2e' }}>{skill.name}</div>
      {/* Row 3: description */}
      {skill.description && (
        <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 10, lineHeight: 1.5 }}>{skill.description}</div>
      )}
      {/* Row 4: tags */}
      {skill.tags?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {skill.tags.slice(0, 5).map(t => (
            <span key={t} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: '#eff6ff', color: '#2563eb', border: '1px solid #dbeafe' }}>
              {t}
            </span>
          ))}
          {skill.tags.length > 5 && <span style={{ fontSize: 11, color: '#aaa' }}>+{skill.tags.length - 5}</span>}
        </div>
      )}
      {/* Row 5: date */}
      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 'auto' }}>
        {new Date(skill.created_at).toLocaleDateString('th-TH')}
      </div>
    </div>
  )
}
// ─── Section Divider ──────────────────────────────────────────────────────────
function SectionDivider({ isLibrary, count }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 14px' }}>
      <div style={{ height: 1, flex: 1, background: isLibrary ? '#dbeafe' : '#f0eeff' }} />
      <span style={{ fontSize: '0.76rem', fontWeight: 700, padding: '3px 14px', borderRadius: 20,
        color: isLibrary ? '#1d4ed8' : '#7c3aed',
        background: isLibrary ? '#eff6ff' : '#f5f0ff',
        border: `1px solid ${isLibrary ? '#bfdbfe' : '#e9d5ff'}` }}>
        {isLibrary ? '📦 Skills Library' : '🎙 AI Conductor'} · {count} skill
      </span>
      <div style={{ height: 1, flex: 1, background: isLibrary ? '#dbeafe' : '#f0eeff' }} />
    </div>
  )
}


// ─── AI Creator ───────────────────────────────────────────────────────────────
marked.setOptions({ breaks: true, gfm: true })

const STORAGE_KEY_YUJIN = 'yujin_skill_creator_history'

function parseSkillName(text) {
  const m = text.match(/^---[\s\S]*?name:\s*(.+?)[\s\S]*?---/m)
  return m ? m[1].trim() : 'skill'
}
function parseRefPaths(text) {
  const re = new RegExp("references/[^\\s]+\\.md", "g")
  const matches = text.matchAll(re)
  return [...new Set([...matches].map(m => m[0]))]
}
function isSkillContent(text) {
  return /^---[\s\S]+?---/m.test(text)
}

async function downloadSkillZip(text) {
  const skillName = parseSkillName(text)
  const folderName = skillName.replace(/\s+/g, '-').toLowerCase()
  const refPaths = parseRefPaths(text)
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()
  zip.file(`${folderName}/SKILL.md`, text)
  for (const refPath of refPaths) {
    const filename = refPath.split('/').pop()
    zip.file(`${folderName}/${refPath}`, `# ${filename.replace('.md','').replace(/-/g,' ')}\n\n<!-- เพิ่มเนื้อหา reference ที่นี่ -->\n`)
  }
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `${folderName}.skill`; a.click()
  URL.revokeObjectURL(url)
}

function AIChatBubble({ msg, onSaveToYujin }) {
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const isSkill = msg.role === 'assistant' && isSkillContent(msg.content)

  const handleCopy = () => {
    navigator.clipboard?.writeText(msg.content).catch(() => {})
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }
  const handleDownload = async () => {
    setDownloading(true)
    await downloadSkillZip(msg.content)
    setDownloading(false)
  }
  const handleSave = async () => {
    setSaving(true)
    await onSaveToYujin(msg.content)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
      <div style={{
        maxWidth: '82%', padding: '10px 14px', borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '4px 18px 18px 18px',
        background: msg.role === 'user' ? '#7c3aed' : '#f8f7ff',
        color: msg.role === 'user' ? 'white' : '#1a1a2e',
        border: msg.role === 'user' ? 'none' : '1px solid #ede9fe',
        fontSize: '0.86rem', lineHeight: 1.65,
      }}>
        {msg.files?.map((f, i) => (
          <div key={i} style={{ marginBottom: 8 }}>
            {f.type === 'image'
              ? <img src={`data:${f.mime_type};base64,${f.data}`} alt={f.name} style={{ maxWidth: 220, maxHeight: 160, borderRadius: 6, display: 'block' }} />
              : <div style={{ fontSize: '0.75rem', background: 'rgba(0,0,0,0.06)', borderRadius: 4, padding: '3px 8px' }}>📄 {f.name}</div>
            }
          </div>
        ))}
        {msg.role === 'assistant'
          ? <div className="ai-md" dangerouslySetInnerHTML={{ __html: marked.parse(msg.content) }} />
          : <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
        }
        {msg.role === 'assistant' && (
          <div style={{ display: 'flex', gap: 5, marginTop: 10, flexWrap: 'wrap' }}>
            {isSkill && (
              <>
                <button onClick={handleSave} disabled={saving || saved}
                  style={{ padding: '4px 11px', borderRadius: 6, border: '1.5px solid #a7f3d0', background: saved ? '#dcfce7' : '#f0fdf4', color: saved ? '#15803d' : '#059669', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
                  {saved ? '✅ บันทึกแล้ว' : saving ? '⏳...' : '💾 บันทึกเข้า Yujin'}
                </button>
                <button onClick={handleDownload} disabled={downloading}
                  style={{ padding: '4px 11px', borderRadius: 6, border: '1.5px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', cursor: 'pointer', fontSize: '0.75rem' }}>
                  {downloading ? '⏳' : '⬇️'} Download .skill
                </button>
              </>
            )}
            <button onClick={handleCopy}
              style={{ padding: '4px 11px', borderRadius: 6, border: '1.5px solid #e5e7eb', background: copied ? '#dcfce7' : '#f3f4f6', color: copied ? '#16a34a' : '#6b7280', cursor: 'pointer', fontSize: '0.75rem' }}>
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function AICreator({ onSkillSaved }) {
  const GEMINI_KEY_STORAGE = 'yujin_gemini_key'
  const [messages, setMessages] = useState(() => {
    try { const s = localStorage.getItem(STORAGE_KEY_YUJIN); if (s) return JSON.parse(s) } catch {}
    return [{ role: 'assistant', content: 'สวัสดีค่า! หนูคือ Skill Creator ช่วยออกแบบ skill .md ให้นะคะ\n\nบอกหนูได้เลยว่าอยากสร้าง skill อะไร หรือแนบไฟล์/รูปมาได้เลย 😊', files: [] }]
  })
  const [input, setInput] = useState('')
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [clearConfirm, setClearConfirm] = useState(false)
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem(GEMINI_KEY_STORAGE) || '')
  const [showKeyInput, setShowKeyInput] = useState(false)
  const bottomRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_YUJIN, JSON.stringify(messages)) } catch {}
  }, [messages])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  const saveKey = (k) => { setGeminiKey(k); localStorage.setItem(GEMINI_KEY_STORAGE, k); setShowKeyInput(false) }

  const uploadFile = async (rawFile) => {
    const fd = new FormData(); fd.append('file', rawFile)
    const r = await fetch('/api/ai/upload', { method: 'POST', body: fd })
    if (!r.ok) throw new Error('Upload failed')
    return r.json()
  }

  const handleFileInput = async (e) => {
    if (!e.target.files?.length) return
    const uploaded = await Promise.all(Array.from(e.target.files).map(uploadFile))
    setFiles(prev => [...prev, ...uploaded])
    e.target.value = ''
  }

  const handlePaste = async (e) => {
    const items = e.clipboardData?.items
    if (!items) return
    const imgs = Array.from(items).filter(i => i.kind === 'file' && i.type.startsWith('image/'))
    if (imgs.length > 0) {
      e.preventDefault()
      const uploaded = await Promise.all(imgs.map(i => uploadFile(i.getAsFile())))
      setFiles(prev => [...prev, ...uploaded])
    }
  }

  const handleDrop = async (e) => {
    e.preventDefault()
    if (e.dataTransfer.files?.length) {
      const uploaded = await Promise.all(Array.from(e.dataTransfer.files).map(uploadFile))
      setFiles(prev => [...prev, ...uploaded])
    }
  }

  const send = async () => {
    if ((!input.trim() && files.length === 0) || loading) return
    if (!geminiKey) { setShowKeyInput(true); return }
    const userMsg = { role: 'user', content: input.trim(), files: [...files] }
    const history = messages.map(m => ({ role: m.role, content: m.content, files: m.files || [] }))
    setMessages(prev => [...prev, userMsg]); setInput(''); setFiles([]); setLoading(true)
    try {
      const r = await fetch('/api/ai/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg.content, history, gemini_api_key: geminiKey })
      })
      const d = await r.json()
      setMessages(prev => [...prev, { role: 'assistant', content: d.reply || d.detail || 'Error', files: [] }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠ Connection error', files: [] }])
    }
    setLoading(false)
  }

  const handleKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }

  const handleClear = () => {
    if (!clearConfirm) { setClearConfirm(true); setTimeout(() => setClearConfirm(false), 3000); return }
    const init = [{ role: 'assistant', content: 'สวัสดีค่า! หนูคือ Skill Creator ช่วยออกแบบ skill .md ให้นะคะ\n\nบอกหนูได้เลยว่าอยากสร้าง skill อะไร หรือแนบไฟล์/รูปมาได้เลย 😊', files: [] }]
    setMessages(init); localStorage.setItem(STORAGE_KEY_YUJIN, JSON.stringify(init)); setClearConfirm(false)
  }

  const saveToYujin = async (skillContent) => {
    const name = parseSkillName(skillContent) || 'untitled-skill'
    const refPaths = parseRefPaths(skillContent)
    const refs = refPaths.map(p => ({ path: p, content: '' }))
    await fetch('/api/skills/', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description: '', category: 'general', tags: [], content: skillContent, refs })
    })
    onSkillSaved()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 28px 12px', borderBottom: '1px solid #f0eeff', flexShrink: 0 }}>
        <div style={{ fontSize: '0.84rem', color: '#888' }}>สร้าง skill ด้วย AI — พิมพ์บอกว่าอยากได้ skill แบบไหน</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {!geminiKey && !showKeyInput && (
            <span style={{ fontSize: '0.75rem', color: '#f59e0b', background: '#fef3c7', padding: '3px 10px', borderRadius: 7, border: '1px solid #fde68a' }}>
              ⚠ ยังไม่มี Gemini API Key
            </span>
          )}
          <button onClick={() => setShowKeyInput(v => !v)}
            style={{ padding: '5px 12px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: 'white', color: '#6b7280', cursor: 'pointer', fontSize: '0.78rem' }}>
            🔑 {geminiKey ? 'เปลี่ยน Key' : 'ตั้งค่า API Key'}
          </button>
          <button onClick={handleClear}
            style={{ padding: '5px 12px', borderRadius: 8, border: `1.5px solid ${clearConfirm ? '#fca5a5' : '#e5e7eb'}`, background: clearConfirm ? '#fff1f2' : 'white', color: clearConfirm ? '#dc2626' : '#6b7280', cursor: 'pointer', fontSize: '0.78rem' }}>
            {clearConfirm ? 'ยืนยัน Clear?' : '🗑 Clear'}
          </button>
        </div>
      </div>

      {/* API Key input */}
      {showKeyInput && (
        <div style={{ padding: '10px 28px', background: '#fffbeb', borderBottom: '1px solid #fde68a', display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="password" placeholder="Gemini API Key..."
            defaultValue={geminiKey}
            onKeyDown={e => e.key === 'Enter' && saveKey(e.target.value)}
            style={{ flex: 1, padding: '7px 12px', borderRadius: 8, border: '1.5px solid #fde68a', fontSize: '0.85rem', fontFamily: 'monospace' }}
            id="gemini-key-input"
          />
          <button onClick={() => saveKey(document.getElementById('gemini-key-input').value)}
            style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#7c3aed', color: 'white', cursor: 'pointer', fontSize: '0.83rem', fontWeight: 600 }}>บันทึก</button>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 28px' }}
        onDrop={handleDrop} onDragOver={e => e.preventDefault()}>
        {messages.map((m, i) => <AIChatBubble key={i} msg={m} onSaveToYujin={saveToYujin} />)}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
            <div style={{ padding: '10px 16px', borderRadius: '4px 18px 18px 18px', background: '#f8f7ff', border: '1px solid #ede9fe', color: '#9ca3af', fontSize: '0.84rem' }}>
              กำลังคิดอยู่...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* File chips */}
      {files.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, padding: '6px 28px 0' }}>
          {files.map((f, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#eff6ff', border: '1px solid #dbeafe', borderRadius: 6, padding: '3px 8px', fontSize: '0.75rem', color: '#2563eb' }}>
              {f.type === 'image' ? '🖼' : '📄'} <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
              <button onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#93c5fd', fontSize: 13, lineHeight: 1, padding: 0 }}>×</button>
            </span>
          ))}
        </div>
      )}

      {/* Input row */}
      <div style={{ padding: '10px 28px 18px', display: 'flex', gap: 8, alignItems: 'flex-end', borderTop: '1px solid #f0eeff', flexShrink: 0 }}>
        <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey} onPaste={handlePaste}
          rows={2} placeholder="พิมพ์ข้อความ, วางรูป (Ctrl+V), หรือลากไฟล์มาวางได้เลย... (Enter ส่ง, Shift+Enter ขึ้นบรรทัด)"
          style={{ flex: 1, padding: '9px 14px', borderRadius: 10, border: '1.5px solid #e5e5ea', fontSize: '0.87rem', fontFamily: 'inherit', resize: 'none', outline: 'none', lineHeight: 1.5 }} />
        <button onClick={() => fileInputRef.current?.click()}
          style={{ padding: '9px 13px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: '1rem', flexShrink: 0 }} title="แนบไฟล์">📎</button>
        <button onClick={send} disabled={loading}
          style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: loading ? '#c4b5fd' : '#7c3aed', color: 'white', fontWeight: 700, cursor: loading ? 'default' : 'pointer', fontSize: '0.87rem', flexShrink: 0 }}>ส่ง</button>
      </div>
      <input ref={fileInputRef} type="file" multiple accept="image/*,.md,.txt,.pdf,.json,.yaml,.csv" style={{ display: 'none' }} onChange={handleFileInput} />
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Skills() {
  const [yujinSkills, setYujinSkills] = useState([])
  const [librarySkills, setLibrarySkills] = useState([])
  const [loadingLib, setLoadingLib] = useState(true)
  const [libError, setLibError] = useState(false)
  const [viewing, setViewing] = useState(null)
  const [formModal, setFormModal] = useState(null)   // null | { initial }
  const [tab, setTab] = useState('all')
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('all')  // 'all' | category value

  const loadYujin = () => fetch('/api/skills/').then(r => r.json()).then(setYujinSkills)

  const loadLibrary = async () => {
    setLoadingLib(true)
    try {
      const data = await fetch(`${LIBRARY_URL}/api/skills/`).then(r => r.json())
      setLibrarySkills(data)
      setLibError(false)
    } catch {
      setLibError(true)
    } finally {
      setLoadingLib(false)
    }
  }

  useEffect(() => { loadYujin(); loadLibrary() }, [])

  const openEdit = async (skill) => {
    const full = await fetch(`/api/skills/${skill.id}`).then(r => r.json())
    setFormModal({ initial: full })
  }

  const del = async (id) => {
    if (!confirm('ลบ skill นี้?')) return
    await fetch(`/api/skills/${id}`, { method: 'DELETE' })
    await loadYujin()
  }

  const handleImportSkill = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    try {
      const JSZip = (await import('jszip')).default
      const zip = await JSZip.loadAsync(file)
      let skillContent = ''
      const refs = []
      for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
        if (zipEntry.dir) continue
        const parts = relativePath.split('/')
        const filename = parts[parts.length - 1]
        if (filename === 'SKILL.md') {
          skillContent = await zipEntry.async('string')
        } else if (relativePath.includes('references/') && filename.endsWith('.md')) {
          const refContent = await zipEntry.async('string')
          const refPath = parts.slice(parts.findIndex(p => p === 'references')).join('/')
          refs.push({ path: refPath, content: refContent })
        }
      }
      if (!skillContent) {
        // ไม่มี zip — อ่านเป็น text ตรงๆ
        skillContent = await file.text()
      }
      const nameMatch = skillContent.match(/^---[\s\S]*?name:\s*(.+?)[\s\S]*?---/m)
      const name = nameMatch ? nameMatch[1].trim() : file.name.replace(/\.skill$|\.zip$|\.md$/, '')
      await fetch('/api/skills/', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: '', category: 'general', tags: [], content: skillContent, refs })
      })
      loadYujin()
    } catch {
      alert('ไม่สามารถอ่านไฟล์ได้ค่ะ')
    }
  }

  const openView = async (skill, source) => {
    if (source === 'library') {
      try {
        const full = await fetch(`${LIBRARY_URL}/api/skills/${skill.id}`).then(r => r.json())
        setViewing({ skill: full, source })
      } catch { setViewing({ skill, source }) }
    } else {
      const full = await fetch(`/api/skills/${skill.id}`).then(r => r.json())
      setViewing({ skill: full, source })
    }
  }

  const matchSearch = (s) => {
    const q = search.trim().toLowerCase()
    const matchQ = !q || s.name.toLowerCase().includes(q) || (s.description || '').toLowerCase().includes(q) || (s.tags || []).some(t => t.toLowerCase().includes(q))
    const matchCat = catFilter === 'all' || (s.category || 'general') === catFilter
    return matchQ && matchCat
  }

  const filteredYujin = yujinSkills.filter(matchSearch)
  const filteredLibrary = librarySkills.filter(matchSearch)

  // หา categories ที่มีอยู่จริง (union ทั้งสองแหล่ง)
  const allSkills = [...yujinSkills, ...librarySkills]
  const usedCats = ['all', ...CATEGORIES.map(c => c.value).filter(v => allSkills.some(s => (s.category || 'general') === v))]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden' }}>

      {formModal !== null && (
        <SkillFormModal initial={formModal.initial} onClose={() => setFormModal(null)} onSaved={loadYujin} />
      )}
      {viewing && (
        <SkillDetail skill={viewing.skill} source={viewing.source} onClose={() => setViewing(null)}
          onEdit={s => { setViewing(null); openEdit(s) }}
          onDelete={id => { del(id); setViewing(null) }} />
      )}

      {/* Top bar */}
      <div style={{ padding: '18px 28px 0', flexShrink: 0, borderBottom: '2px solid #f0eeff' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: '1.15rem' }}>📚 Skills</h2>
          <button onClick={() => setFormModal({ initial: null })}
            style={{ padding: '8px 18px', borderRadius: 10, border: 'none', background: '#7c3aed', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '0.86rem' }}>
            + Skill ใหม่
          </button>
        </div>

        {/* Search + Category filter — hide on creator tab */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#bbb', fontSize: '0.9rem', pointerEvents: 'none' }}>🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="ค้นหาจากชื่อ, คำอธิบาย, หรือ tag..."
              style={{ width: '100%', padding: '9px 14px 9px 34px', borderRadius: 10, border: '1.5px solid #e5e5ea', fontSize: '0.88rem', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }} />
          </div>
          {search && (
            <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '1rem', flexShrink: 0 }}>✕</button>
          )}
          {/* Category pills */}
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {usedCats.map(v => {
              const label = v === 'all' ? 'ทุก Category' : catLabel(v)
              const active = catFilter === v
              return (
                <button key={v} onClick={() => setCatFilter(v)}
                  style={{ padding: '5px 12px', borderRadius: 20, border: `1.5px solid ${active ? '#7c3aed' : '#e5e5ea'}`,
                    background: active ? '#7c3aed' : 'white',
                    color: active ? 'white' : '#666',
                    fontSize: '0.78rem', fontWeight: active ? 700 : 400,
                    cursor: 'pointer', transition: 'all 0.12s', whiteSpace: 'nowrap' }}>
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Source tabs */}
        <div style={{ display: 'flex', gap: 2 }}>
          {[
            { key: 'all', label: 'ทั้งหมด', count: filteredYujin.length + filteredLibrary.length },
            { key: 'library', label: '📦 Skills Library', count: filteredLibrary.length },
            { key: 'yujin', label: '🎙 AI Conductor', count: filteredYujin.length },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.83rem',
                fontWeight: tab === t.key ? 700 : 400,
                color: tab === t.key ? '#7c3aed' : '#888',
                borderBottom: tab === t.key ? '2.5px solid #7c3aed' : '2.5px solid transparent',
                marginBottom: -2 }}>
              {t.label}{t.count !== null && <span style={{ fontSize: '0.75rem', opacity: 0.7 }}> ({t.count})</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px 28px' }}>

        {(tab === 'all' || tab === 'library') && (
          <div>
            {tab === 'all' && <SectionDivider isLibrary={true} count={filteredLibrary.length} />}
            {loadingLib ? (
              <div style={{ textAlign: 'center', color: '#aaa', padding: '20px 0', fontSize: '0.84rem' }}>กำลังโหลด Skills Library...</div>
            ) : libError ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ color: '#f87171', fontSize: '0.84rem', marginBottom: 6 }}>เชื่อมต่อ Skills Library ไม่ได้ค่ะ (port 8040)</div>
                <button onClick={loadLibrary} style={{ fontSize: '0.8rem', color: '#7c3aed', background: 'none', border: '1px solid #e9d5ff', borderRadius: 8, padding: '4px 12px', cursor: 'pointer' }}>🔄 ลองใหม่</button>
              </div>
            ) : filteredLibrary.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#bbb', padding: '20px 0', fontSize: '0.84rem' }}>
                {tab === 'library' ? 'ไม่มี skill ใน Skills Library ค่ะ' : 'ไม่มีผล'}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 10 }}>
                {filteredLibrary.map(s => <SkillCard key={s.id} skill={s} source="library" onClick={() => openView(s, 'library')} />)}
              </div>
            )}
          </div>
        )}

        {(tab === 'all' || tab === 'yujin') && (
          <div style={{ marginBottom: 0 }}>
            {tab === 'all' && <SectionDivider isLibrary={false} count={filteredYujin.length} />}
            {filteredYujin.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#bbb', padding: '20px 0', fontSize: '0.84rem' }}>
                {tab === 'yujin' ? 'ยังไม่มี skill จาก AI Conductor ค่ะ' : 'ไม่มีผล'}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 10 }}>
                {filteredYujin.map(s => <SkillCard key={s.id} skill={s} source="yujin" onClick={() => openView(s, 'yujin')} />)}
              </div>
            )}
          </div>
        )}

        {!loadingLib && filteredYujin.length + filteredLibrary.length === 0 && (search || catFilter !== 'all') && (
          <div style={{ textAlign: 'center', color: '#aaa', marginTop: 40 }}>
            <div style={{ fontSize: '2rem' }}>🔍</div>
            <div style={{ marginTop: 8, fontSize: '0.85rem' }}>ไม่พบ skill ที่ตรงกับเงื่อนไขค่ะ</div>
          </div>
        )}
      </div>
    </div>
  )
}
