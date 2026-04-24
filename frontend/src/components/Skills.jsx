import { useState, useEffect } from 'react'

export default function Skills() {
  const [skills, setSkills] = useState([])
  const [selected, setSelected] = useState(null) // skill being viewed/edited
  const [form, setForm] = useState({ name: '', description: '', content: '' })
  const [mode, setMode] = useState('list') // list | edit | new

  const load = () => fetch('/api/skills/').then(r => r.json()).then(setSkills)

  useEffect(() => { load() }, [])

  const openNew = () => {
    setForm({ name: '', description: '', content: '' })
    setMode('new')
    setSelected(null)
  }

  const openEdit = async (s) => {
    const full = await fetch(`/api/skills/${s.id}`).then(r => r.json())
    setForm({ name: full.name, description: full.description || '', content: full.content })
    setSelected(full)
    setMode('edit')
  }

  const save = async () => {
    if (!form.name.trim() || !form.content.trim()) return
    if (mode === 'new') {
      await fetch('/api/skills/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    } else {
      await fetch(`/api/skills/${selected.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    }
    await load()
    setMode('list')
  }

  const del = async (id) => {
    if (!confirm('ลบ skill นี้?')) return
    await fetch(`/api/skills/${id}`, { method: 'DELETE' })
    await load()
    if (mode === 'edit' && selected?.id === id) setMode('list')
  }

  if (mode === 'new' || mode === 'edit') return (
    <div className="skills-editor">
      <div className="skills-editor-header">
        <button onClick={() => setMode('list')} style={{background:'none',border:'none',cursor:'pointer',fontSize:'1.2rem'}}>←</button>
        <h2>{mode === 'new' ? '✨ Skill ใหม่' : `✏️ แก้ไข: ${selected?.name}`}</h2>
      </div>
      <label className="skill-label">ชื่อ Skill</label>
      <input className="skill-input" value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} placeholder="เช่น SEO Copywriting Standard" />
      <label className="skill-label">คำอธิบาย</label>
      <input className="skill-input" value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))} placeholder="สั้นๆ ว่า skill นี้ทำอะไร" />
      <label className="skill-label">เนื้อหา (Markdown)</label>
      <textarea
        className="skill-textarea"
        value={form.content}
        onChange={e => setForm(p => ({...p, content: e.target.value}))}
        placeholder={'# มาตรฐาน\n- ข้อ 1\n- ข้อ 2\n\n## วิธีทำงาน\n...'}
        rows={18}
      />
      <div style={{display:'flex', gap:8, marginTop:12}}>
        <button className="skill-save-btn" onClick={save}>💾 บันทึก</button>
        <button className="skill-cancel-btn" onClick={() => setMode('list')}>ยกเลิก</button>
      </div>
    </div>
  )

  return (
    <div className="skills-page">
      <div className="skills-header">
        <h2>📚 Skills Library</h2>
        <button className="skill-new-btn" onClick={openNew}>+ Skill ใหม่</button>
      </div>
      {skills.length === 0 && (
        <div style={{textAlign:'center', color:'#aaa', marginTop:60}}>
          <div style={{fontSize:'3rem'}}>📄</div>
          <div>ยังไม่มี Skill ค่ะ สร้างเลยนะคะ</div>
        </div>
      )}
      <div className="skills-list">
        {skills.map(s => (
          <div key={s.id} className="skill-card">
            <div className="skill-card-body" onClick={() => openEdit(s)}>
              <div className="skill-card-name">📄 {s.name}</div>
              {s.description && <div className="skill-card-desc">{s.description}</div>}
              <div className="skill-card-date">{new Date(s.created_at).toLocaleDateString('th-TH')}</div>
            </div>
            <button className="skill-del-btn" onClick={() => del(s.id)}>🗑️</button>
          </div>
        ))}
      </div>
    </div>
  )
}
