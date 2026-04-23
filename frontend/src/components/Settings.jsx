import { useState, useEffect } from 'react'

export default function Settings() {
  const [config, setConfig] = useState(null)
  const [selected, setSelected] = useState('')

  useEffect(() => {
    fetch('/api/config/').then(r => r.json()).then(data => {
      setConfig(data)
      setSelected(data.llm_model)
    })
  }, [])

  const save = async () => {
    const res = await fetch('/api/config/', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ llm_model: selected })
    })
    const data = await res.json()
    if (data.success) alert(`✅ เปลี่ยน Yujin ไปใช้ ${selected} แล้วค่ะ`)
  }

  if (!config) return <p>Loading...</p>

  return (
    <div className="settings-container">
      <h2>Settings</h2>
      <div className="setting-row">
        <label>สมองของ Yujin (Secretary)</label>
        <select value={selected} onChange={e => setSelected(e.target.value)}>
          {config.available_models.map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <button onClick={save}>บันทึก</button>
      </div>
      <p className="note">Worker แต่ละตัวจะได้รับ model จากตอน approve team</p>
    </div>
  )
}
