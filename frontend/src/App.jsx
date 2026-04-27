import { useState, useEffect } from 'react'
import Chat from './components/Chat'
import YujinAvatar from './components/YujinAvatar'
import Workspace from './components/Workspace'
import Settings from './components/Settings'
import Skills from './components/Skills'
import WorkerLibrary from './components/WorkerLibrary'
import './App.css'

const MODEL_SHORT = {
  'gemini-2.5-flash': 'Gemini 2.5 Flash',
  'gemini-2.5-pro': 'Gemini 2.5 Pro',
  'gemini-2.5-flash-8b': 'Gemini 2.5 Flash-8B',
  'meta-llama/Llama-3.3-70B-Instruct-Turbo': 'Llama 3.3 70B',
  'meta-llama/Llama-4-Scout-17B-16E-Instruct': 'Llama 4 Scout',
  'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo': 'Llama 3.1 8B',
  'gemini-2.5-flash-image': 'Gemini 2.5 Flash Image',
  'gemini-3.1-flash-image-preview': 'Nano Banana 2',
  'gemini-3-pro-image-preview': 'Nano Banana Pro',
}

export default function App() {
  const [tab, setTab] = useState('chat')
  const [yujinModel, setYujinModel] = useState('')

  useEffect(() => {
    fetch('/api/config/').then(r => r.json()).then(d => setYujinModel(d.llm_model || ''))
  }, [tab])

  const modelLabel = MODEL_SHORT[yujinModel] || yujinModel.split('/').pop() || 'AI Secretary'

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <YujinAvatar size={36} />
          <div>
            <div className="logo-name">AI Conductor</div>
            <div className="logo-sub">{modelLabel}</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          <button className={tab === 'chat' ? 'active' : ''} onClick={() => setTab('chat')}>
            <span>💬</span> Chat
          </button>
          <button className={tab === 'workspace' ? 'active' : ''} onClick={() => setTab('workspace')}>
            <span>🗂️</span> Workspace
          </button>
          <button className={tab === 'workers' ? 'active' : ''} onClick={() => setTab('workers')}>
            <span>👤</span> Workers
          </button>
          <button className={tab === 'skills' ? 'active' : ''} onClick={() => setTab('skills')}>
            <span>📚</span> Skills
          </button>
          <button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>
            <span>⚙️</span> Settings
          </button>
        </nav>
      </aside>
      <main className="main-content">
        {tab === 'chat' && <Chat />}
        {tab === 'workspace' && <Workspace />}
        {tab === 'workers' && <WorkerLibrary />}
        {tab === 'skills' && <Skills />}
        {tab === 'settings' && <Settings />}
      </main>
    </div>
  )
}
