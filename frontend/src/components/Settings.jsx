import { useState, useEffect } from 'react'

export default function Settings() {
  const [config, setConfig] = useState(null)
  const [selectedModel, setSelectedModel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
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
    alert(`✅ เปลี่ยน Yujin ไปใช้ ${selectedModel} แล้วค่ะ`)
  }

  const saveApiKey = async () => {
    if (!apiKey.trim()) return
    setSaving(true)
    const res = await fetch('/api/config/apikey', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey.trim() })
    })
    const data = await res.json()
    setSaving(false)
    if (data.success) {
      setApiKey('')
      load()
      alert('✅ อัพเดท API Key แล้วค่ะ')
    }
  }

  if (!config) return <p style={{padding: '24px', color: '#888'}}>Loading...</p>

  return (
    <div className="settings-container">
      <h2>Settings</h2>

      <div className="setting-section">
        <h3>🔑 Gemini API Key</h3>
        <div className="current-key">
          <span>Key ปัจจุบัน: </span>
          <code>{config.api_key_masked}</code>
        </div>
        <div className="setting-row">
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="ใส่ API Key ใหม่..."
            className="key-input"
          />
          <button className="toggle-btn" onClick={() => setShowKey(!showKey)}>
            {showKey ? '🙈' : '👁️'}
          </button>
          <button onClick={saveApiKey} disabled={!apiKey.trim() || saving}>
            บันทึก
          </button>
        </div>
        <p className="note">
          สร้าง key ได้ที่ <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">Google AI Studio</a>
        </p>
      </div>

      <div className="setting-section">
        <h3>🧠 สมองของ Yujin</h3>
        <div className="setting-row">
          <select value={selectedModel} onChange={e => setSelectedModel(e.target.value)}>
            {config.available_models.map(m => (
              <option key={m.id} value={m.id}>{m.name} ({m.provider})</option>
            ))}
          </select>
          <button onClick={saveModel} disabled={saving}>บันทึก</button>
        </div>
        <p className="note">Worker แต่ละตัวได้รับ model ตอน approve team</p>
      </div>
    </div>
  )
}
