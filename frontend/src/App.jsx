import { useState } from 'react'
import Chat from './components/Chat'
import Teams from './components/Teams'
import Settings from './components/Settings'
import './App.css'

export default function App() {
  const [tab, setTab] = useState('chat')

  return (
    <div className="app">
      <header className="header">
        <h1>🤖 Yujin</h1>
        <p>AI Secretary</p>
        <nav>
          <button className={tab === 'chat' ? 'active' : ''} onClick={() => setTab('chat')}>Chat</button>
          <button className={tab === 'teams' ? 'active' : ''} onClick={() => setTab('teams')}>Teams</button>
          <button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>Settings</button>
        </nav>
      </header>
      <main>
        {tab === 'chat' && <Chat />}
        {tab === 'teams' && <Teams />}
        {tab === 'settings' && <Settings />}
      </main>
    </div>
  )
}
