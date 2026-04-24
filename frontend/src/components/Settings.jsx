import { useState, useEffect } from 'react'

const PROVIDERS = [
  { id: "google",     label: "🟦 Google Gemini" },
  { id: "deepinfra",  label: "🟧 DeepInfra (Meta Llama)" },
]

export default function Settings() {
  const [config, setConfig] = useState(null)
  const [selectedModel, setSelectedModel] = useState('')
  const [keys, setKeys] = useState({ google: '', deepinfra: '' })
  const [show, setShow] = useState({ google: false, deepinfra: false })
  const [saving, setSaving] = useState(false)

  const load = () => fetch('/api/config/').then(r => r.json()).then(data => {
    setConfig(data)
    setSelectedModel(data.llm_model)
  })

  useEffect(() => { load() }, [])

  const saveModel = async () => {
    setSaving(true)
    await fetch('/api/config/', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ llm_model: selectedModel })
    })
    setSaving(false)
    load()
    alert(`✅ เปลี่ยน Yujin ไปใช้ ${selectedModel} แล้วค่ะ`)
  }

  const saveKey = async (provider) => {
    if (!keys[provider].trim()) return
    setSaving(true)
    await fetch('/api/config/apikey', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, api_key: keys[provider].trim() })
    })
    setSaving(false)
    setKeys(prev => ({ ...prev, [provider]: '' }))
    load()
    alert('✅ บันทึก API Key แล้วค่ะ')
  }

  if (!config) return <p style={{padding:'24px',color:'#888'}}>Loading...</p>

  const textModels = config.available_models.filter(m => m.type !== 'image')
  const imageModels = config.available_models.filter(m => m.type === 'image')
  const byProvider = PROVIDERS.map(p => ({
    ...p,
    models: textModels.filter(m => m.provider === p.id)
  }))

  return (
    <div className="settings-container">
      <h2>Settings</h2>

      <div className="setting-section">
        <h3>🧠 สมองของ Yujin</h3>
        <p style={{fontSize:'0.8rem',color:'#888',marginBottom:'12px'}}>เลือก model สำหรับ Yujin และ worker (เฉพาะ text model)</p>
        {byProvider.map(p => (
          <div key={p.id} className="provider-group">
            <div className="provider-label">{p.label}</div>
            {p.models.map(m => (
              <label key={m.id} className={`model-option ${selectedModel === m.id ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="model"
                  value={m.id}
                  checked={selectedModel === m.id}
                  onChange={() => setSelectedModel(m.id)}
                />
                <div>
                  <div>{m.name}</div>
                  {m.description && <div className="model-desc">{m.description}</div>}
                </div>
              </label>
            ))}
          </div>
        ))}
        <button onClick={saveModel} disabled={saving} style={{marginTop:'12px'}}>บันทึก</button>
      </div>

      {imageModels.length > 0 && (
        <div className="setting-section">
          <h3>🎨 Image Generation Models</h3>
          <p style={{fontSize:'0.8rem',color:'#888',marginBottom:'12px'}}>worker ที่มี <code>image_tool</code> จะใช้ model เหล่านี้สร้างรูป</p>
          <div className="provider-group">
            {imageModels.map(m => (
              <div key={m.id} className="model-option" style={{cursor:'default'}}>
                <div>
                  <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                    <span>{m.name}</span>
                    <code style={{fontSize:'0.7rem',background:'#f3e8ff',color:'#7c3aed',padding:'1px 6px',borderRadius:'6px'}}>{m.id}</code>
                  </div>
                  {m.description && <div className="model-desc">{m.description}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="setting-section">
        <h3>🔑 API Keys</h3>
        {PROVIDERS.map(p => (
          <div key={p.id} className="key-row">
            <div className="key-label">
              <span>{p.label}</span>
              <code>{config.keys[p.id]}</code>
            </div>
            <div className="setting-row">
              <input
                type={show[p.id] ? 'text' : 'password'}
                value={keys[p.id]}
                onChange={e => setKeys(prev => ({ ...prev, [p.id]: e.target.value }))}
                placeholder={`ใส่ ${p.label} API Key ใหม่...`}
                className="key-input"
              />
              <button className="toggle-btn" onClick={() => setShow(prev => ({ ...prev, [p.id]: !prev[p.id] }))}>
                {show[p.id] ? '🙈' : '👁️'}
              </button>
              <button onClick={() => saveKey(p.id)} disabled={!keys[p.id].trim() || saving}>บันทึก</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
