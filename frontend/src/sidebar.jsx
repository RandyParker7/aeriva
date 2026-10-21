import { useEffect, useState } from 'react'
import './layout.css'
import './sidebar.css'
import './theme.css'
import PredictionPage from './pages/PredictionPage'
import EvaluationPage from './pages/EvaluationPage'
import InformationPage from './pages/InformationPage'
import AboutPage from './pages/AboutPage'

const menuItems = [
  { id: 'prediction', label: 'Prediction' },
  { id: 'evaluation', label: 'Evaluation' },
  { id: 'information', label: 'Information' },
  { id: 'about', label: 'About' },
]

const pageMap = {
  prediction: PredictionPage,
  evaluation: EvaluationPage,
  information: InformationPage,
  about: AboutPage,
}

function App() {
  const [activeMenu, setActiveMenu] = useState('prediction')
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isDarkMode, setIsDarkMode] = useState(
    () => window.localStorage.getItem('aeriva-theme') === 'dark',
  )
  const ActivePage = pageMap[activeMenu] || AboutPage

  useEffect(() => {
    window.localStorage.setItem('aeriva-theme', isDarkMode ? 'dark' : 'light')
  }, [isDarkMode])

  return (
    <div
      className={`app-shell ${isSidebarOpen ? '' : 'sidebar-closed'} ${
        isDarkMode ? 'dark-mode' : ''
      }`}
    >
      <aside className="sidebar">
        <div className="sidebar-header">
          <a className="brand" href="/" aria-label="Aeriva home">
            <span className="brand-logo" aria-hidden="true">
              <svg viewBox="0 0 32 32" focusable="false">
                <path d="M16 4 28 26h-7l-5-9-5 9H4L16 4Z" />
                <path d="M13.2 20h5.6l-2.8-5.1-2.8 5.1Z" />
              </svg>
            </span>
            <span className="brand-name">Aeriva</span>
          </a>
          <button
            className={`sidebar-toggle ${isSidebarOpen ? '' : 'sidebar-reopen'}`}
            type="button"
            aria-label={isSidebarOpen ? 'Tutup sidebar' : 'Buka sidebar'}
            title={isSidebarOpen ? 'Tutup sidebar' : 'Buka sidebar'}
            aria-expanded={isSidebarOpen}
            onClick={() => setIsSidebarOpen((open) => !open)}
          >
            {isSidebarOpen ? (
              <span aria-hidden="true">›</span>
            ) : (
              <svg
                className="sidebar-menu-icon"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

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

        <div className="sidebar-footer">
          <button
            className="theme-toggle"
            type="button"
            aria-label={`Aktifkan mode ${isDarkMode ? 'terang' : 'gelap'}`}
            aria-pressed={isDarkMode}
            onClick={() => setIsDarkMode((enabled) => !enabled)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              {isDarkMode ? (
                <circle cx="12" cy="12" r="4" />
              ) : (
                <path d="M20.2 15.5A8.5 8.5 0 0 1 8.5 3.8 8.5 8.5 0 1 0 20.2 15.5Z" />
              )}
              {isDarkMode && (
                <path d="M12 2v2m0 16v2m10-10h-2M4 12H2m17.1-7.1-1.4 1.4M6.3 17.7l-1.4 1.4m14.2 0-1.4-1.4M6.3 6.3 4.9 4.9" />
              )}
            </svg>
            <span>{isDarkMode ? 'Mode terang' : 'Mode gelap'}</span>
          </button>
        </div>
      </aside>

      <main className="content-panel">
        <ActivePage />
      </main>
    </div>
  )
}

export default App
