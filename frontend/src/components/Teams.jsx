import { useState, useEffect } from 'react'
import Workspace from './Workspace'

export default function Teams() {
  const [teams, setTeams] = useState([])
  const [activeTeam, setActiveTeam] = useState(null)

  const load = () => fetch('/api/teams/').then(r => r.json()).then(data => {
    setTeams(data)
  })

  useEffect(() => { load() }, [])

  const deleteTeam = async (e, id, name) => {
    e.stopPropagation()
    if (!confirm(`ลบทีม "${name}" ใช่มั๊ย?`)) return
    await fetch(`/api/teams/${id}`, { method: 'DELETE' })
    if (activeTeam?.id === id) setActiveTeam(null)
    load()
  }

  return (
    <div className="chat-layout">
      <div className="room-sidebar">
        <div className="room-header">
          <span>ทีมงาน</span>
        </div>
        <div className="room-list">
          {teams.length === 0 && <div style={{padding:'12px',color:'#888',fontSize:'0.8rem'}}>ยังไม่มีทีม</div>}
          {teams.map(t => (
            <div
              key={t.id}
              className={`room-item ${activeTeam?.id === t.id ? 'active' : ''}`}
              onClick={() => setActiveTeam(t)}
            >
              <div style={{flex:1, minWidth:0}}>
                <div className="room-name" style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  👥 {t.name}
                </div>
                <div style={{fontSize:'0.7rem',color:'#888',marginTop:'2px'}}>
                  {t.workers.length} workers
                </div>
              </div>
              <button
                onClick={e => deleteTeam(e, t.id, t.name)}
                style={{
                  flexShrink:0, background:'none', border:'none', cursor:'pointer',
                  fontSize:'1rem', padding:'2px 4px', borderRadius:'4px',
                  color:'#ccc', transition:'color 0.15s'
                }}
                onMouseEnter={e => e.target.style.color='#ef4444'}
                onMouseLeave={e => e.target.style.color='#ccc'}
                title="ลบทีม"
              >🗑️</button>
            </div>
          ))}
        </div>
      </div>

      <div style={{flex:1, overflow:'hidden', display:'flex', flexDirection:'column'}}>
        {activeTeam
          ? <Workspace key={activeTeam.id} team={activeTeam} onTeamUpdated={load} />
          : <div className="empty-chat"><div className="empty-icon">👥</div><div>เลือกทีมด้านซ้ายค่ะ</div></div>
        }
      </div>
    </div>
  )
}
