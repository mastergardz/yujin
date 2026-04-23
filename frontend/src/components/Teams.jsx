import { useState, useEffect } from 'react'

export default function Teams() {
  const [teams, setTeams] = useState([])

  const load = () => fetch('/api/teams/').then(r => r.json()).then(setTeams)

  useEffect(() => { load() }, [])

  const deleteTeam = async (id, name) => {
    if (!confirm(`ลบทีม "${name}" ใช่มั๊ย?`)) return
    await fetch(`/api/teams/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="teams-container">
      <h2>ทีมงานทั้งหมด</h2>
      {teams.length === 0 && <p className="empty">ยังไม่มีทีม — สั่งงาน Yujin ได้เลยค่ะ</p>}
      {teams.map(t => (
        <div key={t.id} className="team-card">
          <div className="team-header">
            <h3>{t.name}</h3>
            <span className={`badge ${t.status}`}>{t.status}</span>
            <button className="delete-btn" onClick={() => deleteTeam(t.id, t.name)}>🗑️</button>
          </div>
          <p>{t.description}</p>
          <div className="workers">
            {t.workers.map(w => (
              <div key={w.id} className="worker-card">
                <b>{w.name}</b>
                <span>{w.role}</span>
                <span className="model-tag">{w.llm_model}</span>
                <span className={`status-dot ${w.status}`}>{w.status}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
