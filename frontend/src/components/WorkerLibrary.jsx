import { useState, useEffect } from 'react'

const ALL_MODELS = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', type: 'text' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', type: 'text' },
  { id: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite', type: 'text' },
  { id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', label: 'Llama 3.3 70B', type: 'text' },
  { id: 'meta-llama/Llama-4-Scout-17B-16E-Instruct', label: 'Llama 4 Scout', type: 'text' },
  { id: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo', label: 'Llama 3.1 8B', type: 'text' },
  { id: 'gemini-2.5-flash-image', label: '🎨 Flash Image', type: 'image' },
  { id: 'gemini-3.1-flash-image-preview', label: '🎨 Nano Banana 2', type: 'image' },
  { id: 'gemini-3-pro-image-preview', label: '🎨 Nano Banana Pro', type: 'image' },
]

const TOOLS = ['shell_tool', 'db_tool', 'file_tool', 'image_tool']
const TOOL_LABELS = { shell_tool: '💻 Shell', db_tool: '🗄️ DB', file_tool: '📄 File', image_tool: '🎨 Image' }

const EMPTY_FORM = { name: '', role: '', llm_model: 'gemini-2.5-flash', capabilities: [], avatar: '', personality: '', speech_style: '', skills: [], system_prompt: '' }

export default function WorkerLibrary() {
  const [templates, setTemplates] = useState([])
  const [skills, setSkills] = useState([])
  const [teams, setTeams] = useState([])
  const [mode, setMode] = useState('list') // list | edit | new
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [assignTarget, setAssignTarget] = useState(null) // template being assigned
  const [assignTeamId, setAssignTeamId] = useState('')

  const load = async () => {
    const [tmpl, sk, tm] = await Promise.all([
      fetch('/api/worker-library/').then(r => r.json()),
      fetch('/api/skills/').then(r => r.json()),
      fetch('/api/teams/').then(r => r.json()),
    ])
    setTemplates(tmpl)
    setSkills(sk)
    setTeams(tm)
  }

  useEffect(() => { load() }, [])

  const openNew = () => { setForm(EMPTY_FORM); setSelected(null); setMode('new') }
  const openEdit = (t) => { setForm({ ...EMPTY_FORM, ...t, capabilities: t.capabilities || [], skills: t.skills || [] }); setSelected(t); setMode('edit') }

  const save = async () => {
    if (!form.name.trim() || !form.role.trim()) return
    if (mode === 'new') {
      await fetch('/api/worker-library/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    } else {
      await fetch(`/api/worker-library/${selected.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    }
    await load(); setMode('list')
  }

  const del = async (id) => {
    if (!confirm('ลบ worker template นี้?')) return
    await fetch(`/api/worker-library/${id}`, { method: 'DELETE' })
    await load()
    if (mode === 'edit' && selected?.id === id) setMode('list')
  }

  const assign = async () => {
    if (!assignTeamId) return
    await fetch(`/api/worker-library/${assignTarget.id}/assign`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team_id: assignTeamId })
    })
    setAssignTarget(null); setAssignTeamId('')
    alert(`✅ เพิ่ม ${assignTarget.name} เข้าทีมแล้วค่ะ`)
  }

  const toggleCap = (cap) => setForm(p => ({
    ...p, capabilities: p.capabilities.includes(cap) ? p.capabilities.filter(c => c !== cap) : [...p.capabilities, cap]
  }))
  const toggleSkill = (id) => setForm(p => ({
    ...p, skills: p.skills.includes(id) ? p.skills.filter(s => s !== id) : [...p.skills, id]
  }))

  const modelLabel = (id) => ALL_MODELS.find(m => m.id === id)?.label || id

  if (mode === 'new' || mode === 'edit') return (
    <div style={{padding:24}}>
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20}}>
        <button onClick={() => setMode('list')} style={{background:'none',border:'none',cursor:'pointer',fontSize:'1.2rem'}}>←</button>
        <h2 style={{margin:0,fontSize:'1.1rem'}}>{mode === 'new' ? '👤 Worker ใหม่' : `✏️ แก้ไข: ${selected?.name}`}</h2>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
        <div>
          <label style={{fontSize:'0.8rem',color:'#555',fontWeight:600}}>ชื่อ</label>
          <input value={form.name} onChange={e => setForm(p=>({...p,name:e.target.value}))} placeholder="เช่น มายด์" style={{width:'100%',padding:'8px 10px',borderRadius:8,border:'1px solid #e5e5ea',fontSize:'0.9rem',boxSizing:'border-box',marginTop:4}} />
        </div>
        <div>
          <label style={{fontSize:'0.8rem',color:'#555',fontWeight:600}}>Avatar (emoji)</label>
          <input value={form.avatar} onChange={e => setForm(p=>({...p,avatar:e.target.value}))} placeholder="เช่น 🧠 หรือ ม" style={{width:'100%',padding:'8px 10px',borderRadius:8,border:'1px solid #e5e5ea',fontSize:'0.9rem',boxSizing:'border-box',marginTop:4}} />
        </div>
      </div>

      <label style={{fontSize:'0.8rem',color:'#555',fontWeight:600}}>บทบาท / Role</label>
      <input value={form.role} onChange={e => setForm(p=>({...p,role:e.target.value}))} placeholder="เช่น นักเขียนบทความ SEO มืออาชีพ" style={{width:'100%',padding:'8px 10px',borderRadius:8,border:'1px solid #e5e5ea',fontSize:'0.9rem',boxSizing:'border-box',marginTop:4,marginBottom:12}} />

      <label style={{fontSize:'0.8rem',color:'#555',fontWeight:600}}>Model</label>
      <select value={form.llm_model} onChange={e => setForm(p=>({...p,llm_model:e.target.value}))} style={{width:'100%',padding:'8px 10px',borderRadius:8,border:'1px solid #e5e5ea',fontSize:'0.9rem',marginTop:4,marginBottom:12,boxSizing:'border-box'}}>
        {['text','image'].map(type => <optgroup key={type} label={type === 'text' ? '🧠 Text Models' : '🎨 Image Models'}>
          {ALL_MODELS.filter(m => m.type === type).map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
        </optgroup>)}
      </select>

      <label style={{fontSize:'0.8rem',color:'#555',fontWeight:600}}>Tools / Capabilities</label>
      <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:4,marginBottom:12}}>
        {TOOLS.map(c => <span key={c} onClick={() => toggleCap(c)} style={{padding:'4px 10px',borderRadius:20,fontSize:'0.78rem',cursor:'pointer',background:form.capabilities.includes(c)?'#7c3aed':'#f3f4f6',color:form.capabilities.includes(c)?'white':'#555',border:`1px solid ${form.capabilities.includes(c)?'#7c3aed':'#e5e5ea'}`}}>{form.capabilities.includes(c)?'✓ ':''}{TOOL_LABELS[c]}</span>)}
      </div>

      <label style={{fontSize:'0.8rem',color:'#555',fontWeight:600}}>นิสัย / บุคลิก</label>
      <textarea value={form.personality} onChange={e => setForm(p=>({...p,personality:e.target.value}))} rows={2} placeholder="เช่น ละเอียด รอบคอบ ชอบตรวจสอบซ้ำ" style={{width:'100%',padding:'8px 10px',borderRadius:8,border:'1px solid #e5e5ea',fontSize:'0.85rem',resize:'vertical',boxSizing:'border-box',marginTop:4,marginBottom:12}} />

      <label style={{fontSize:'0.8rem',color:'#555',fontWeight:600}}>สไตล์การพูด</label>
      <textarea value={form.speech_style} onChange={e => setForm(p=>({...p,speech_style:e.target.value}))} rows={2} placeholder="เช่น พูดสั้น กระชับ ตรงประเด็น" style={{width:'100%',padding:'8px 10px',borderRadius:8,border:'1px solid #e5e5ea',fontSize:'0.85rem',resize:'vertical',boxSizing:'border-box',marginTop:4,marginBottom:12}} />

      {skills.length > 0 && <>
        <label style={{fontSize:'0.8rem',color:'#555',fontWeight:600}}>📚 Skills</label>
        <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:4,marginBottom:12}}>
          {skills.map(s => <span key={s.id} onClick={() => toggleSkill(s.id)} style={{padding:'4px 10px',borderRadius:20,fontSize:'0.75rem',cursor:'pointer',background:form.skills.includes(s.id)?'#059669':'#f3f4f6',color:form.skills.includes(s.id)?'white':'#555',border:`1px solid ${form.skills.includes(s.id)?'#059669':'#e5e5ea'}`}}>{form.skills.includes(s.id)?'✓ ':''}{s.name}</span>)}
        </div>
      </>}

      <div style={{display:'flex',gap:8,marginTop:8}}>
        <button onClick={save} style={{flex:1,background:'#7c3aed',color:'white',border:'none',borderRadius:10,padding:10,fontWeight:600,cursor:'pointer'}}>💾 บันทึก</button>
        <button onClick={() => setMode('list')} style={{flex:1,background:'#f3f4f6',color:'#555',border:'none',borderRadius:10,padding:10,cursor:'pointer'}}>ยกเลิก</button>
      </div>
    </div>
  )

  return (
    <div style={{padding:24}}>
      {assignTarget && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={() => setAssignTarget(null)}>
          <div style={{background:'white',borderRadius:16,padding:24,minWidth:320,boxShadow:'0 8px 32px rgba(0,0,0,0.18)'}} onClick={e => e.stopPropagation()}>
            <div style={{fontWeight:700,marginBottom:16}}>➕ Assign {assignTarget.name} เข้าทีม</div>
            <select value={assignTeamId} onChange={e => setAssignTeamId(e.target.value)} style={{width:'100%',padding:'8px 10px',borderRadius:8,border:'1px solid #e5e5ea',fontSize:'0.9rem',marginBottom:16}}>
              <option value="">เลือกทีม...</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <div style={{display:'flex',gap:8}}>
              <button onClick={assign} disabled={!assignTeamId} style={{flex:1,background:'#7c3aed',color:'white',border:'none',borderRadius:10,padding:10,fontWeight:600,cursor:'pointer',opacity:assignTeamId?1:0.5}}>✅ Assign</button>
              <button onClick={() => setAssignTarget(null)} style={{flex:1,background:'#f3f4f6',color:'#555',border:'none',borderRadius:10,padding:10,cursor:'pointer'}}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
        <h2 style={{margin:0,fontSize:'1.2rem'}}>👤 Worker Library</h2>
        <button onClick={openNew} style={{background:'#7c3aed',color:'white',border:'none',borderRadius:10,padding:'8px 16px',fontSize:'0.85rem',cursor:'pointer',fontWeight:600}}>+ Worker ใหม่</button>
      </div>

      {templates.length === 0 && (
        <div style={{textAlign:'center',color:'#aaa',marginTop:60}}>
          <div style={{fontSize:'3rem'}}>👤</div>
          <div>ยังไม่มี Worker template ค่ะ</div>
        </div>
      )}

      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {templates.map(t => (
          <div key={t.id} style={{background:'white',border:'1px solid #e5e5ea',borderRadius:12,padding:'14px 16px',display:'flex',alignItems:'center',gap:12}}>
            <div style={{width:40,height:40,borderRadius:'50%',background:'#f3e8ff',color:'#7c3aed',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.2rem',fontWeight:700,flexShrink:0}}>
              {t.avatar || t.name.charAt(0)}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:600,fontSize:'0.95rem'}}>{t.name}</div>
              <div style={{fontSize:'0.8rem',color:'#888',marginBottom:4}}>{t.role}</div>
              <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                <span style={{background:'#ecfdf5',color:'#059669',fontSize:'0.7rem',padding:'2px 8px',borderRadius:10,border:'1px solid #a7f3d0'}}>{modelLabel(t.llm_model)}</span>
                {(t.capabilities||[]).map(c => <span key={c} style={{background:'#eff6ff',color:'#2563eb',fontSize:'0.65rem',padding:'2px 6px',borderRadius:10,border:'1px solid #bfdbfe'}}>{TOOL_LABELS[c]||c}</span>)}
              </div>
            </div>
            <div style={{display:'flex',gap:6,flexShrink:0}}>
              <button onClick={() => setAssignTarget(t)} style={{background:'#7c3aed',color:'white',border:'none',borderRadius:8,padding:'6px 12px',fontSize:'0.78rem',cursor:'pointer',fontWeight:600}}>➕ Assign</button>
              <button onClick={() => openEdit(t)} style={{background:'#f3f4f6',color:'#555',border:'none',borderRadius:8,padding:'6px 10px',fontSize:'0.78rem',cursor:'pointer'}}>✏️</button>
              <button onClick={() => del(t.id)} style={{background:'none',border:'none',cursor:'pointer',fontSize:'1rem',opacity:0.5,padding:'6px'}}>🗑️</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
