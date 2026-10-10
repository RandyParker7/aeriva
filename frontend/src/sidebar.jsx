import { useState } from 'react'
import './sidebar.css'
import PredictionPage from './pages/PredictionPage'
import CreationPage from './pages/CreationPage'
import InformationPage from './pages/InformationPage'
import AboutPage from './pages/AboutPage'

const menuItems = [
  { id: 'prediction', label: 'Prediction' },
  { id: 'creation', label: 'Creation' },
  { id: 'information', label: 'Information' },
  { id: 'about', label: 'About' },
]

const pageMap = {
  prediction: PredictionPage,
  creation: CreationPage,
  information: InformationPage,
  about: AboutPage,
}

function App() {
  const [activeMenu, setActiveMenu] = useState('prediction')
  const ActivePage = pageMap[activeMenu] || AboutPage

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <nav className="nav-menu" aria-label="Sidebar navigation">
          {menuItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${activeMenu === item.id ? 'active' : ''}`}
              onClick={() => setActiveMenu(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="content-panel">
        <ActivePage />
      </main>
    </div>
  )
}

export default App
