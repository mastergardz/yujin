import { useState, useEffect } from 'react'
import Workspace from './Workspace'

export default function Teams() {
  const [teams, setTeams] = useState([])
  const [activeTeam, setActiveTeam] = useState(null)

  const load = () => fetch('/api/teams/').then(r => r.json()).then(data => {
    setTeams(data)
    if (data.length > 0 && !activeTeam) setActiveTeam(data[0])
  })

  useEffect(() => { load() }, [])

  const deleteTeam = async (e, id, name) => {
    e.stopPropagation()
    if (!confirm(`ลบทีม "${name}" ใช่มั๊ย?`)) return
    await fetch(`/api/teams/${id}`, { method: 'DELETE' })
    load()
    if (activeTeam?.id === id) setActiveTeam(null)
  }

  return (
    <div className="chat-layout">
      {/* Team list sidebar */}
      <div className="room-sidebar">
        <div className="room-header">
          <span>ทีมงาน</span>
        </div>
        <div className="room-list">
          {teams.length === 0 && <div style={{padding:'12px',color:'#444',fontSize:'0.8rem'}}>ยังไม่มีทีม</div>}
          {teams.map(t => (
            <div
              key={t.id}
              className={`room-item ${activeTeam?.id === t.id ? 'active' : ''}`}
              onClick={() => setActiveTeam(t)}
            >
              <div style={{flex:1}}>
                <div className="room-name">👥 {t.name}</div>
                <div style={{fontSize:'0.7rem',color:'#555',marginTop:'2px'}}>
                  {t.workers.length} workers
                </div>
              </div>
              <div className="room-actions">
                <button onClick={e => deleteTeam(e, t.id, t.name)}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Workspace */}
      <div style={{flex:1, overflow:'hidden'}}>
        {activeTeam
          ? <Workspace key={activeTeam.id} team={activeTeam} />
          : <div className="empty-chat"><div className="empty-icon">👥</div><div>เลือกทีมด้านซ้าย</div></div>
        }
      </div>
    </div>
  )
}
