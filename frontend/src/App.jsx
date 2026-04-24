import { useState } from 'react'
import Chat from './components/Chat'
import YujinAvatar from './components/YujinAvatar'
import Teams from './components/Teams'
import Settings from './components/Settings'
import './App.css'

export default function App() {
  const [tab, setTab] = useState('chat')

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <YujinAvatar size={36} />
          <div>
            <div className="logo-name">Yujin</div>
            <div className="logo-sub">AI Secretary</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          <button className={tab === 'chat' ? 'active' : ''} onClick={() => setTab('chat')}>
            <span>💬</span> Chat
          </button>
          <button className={tab === 'teams' ? 'active' : ''} onClick={() => setTab('teams')}>
            <span>👥</span> Teams
          </button>
          <button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>
            <span>⚙️</span> Settings
          </button>
        </nav>
      </aside>
      <main className="main-content">
        {tab === 'chat' && <Chat />}
        {tab === 'teams' && <Teams />}
        {tab === 'settings' && <Settings />}
      </main>
    </div>
  )
}
