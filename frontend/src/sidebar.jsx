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

function ThemeIcon({ isDarkMode }) {
  return (
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
  )
}

function InstallIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v11m0 0 4-4m-4 4-4-4M5 14v6h14v-6" />
    </svg>
  )
}

function App() {
  const [activeMenu, setActiveMenu] = useState('prediction')
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isDarkMode, setIsDarkMode] = useState(
    () => window.localStorage.getItem('aeriva-theme') === 'dark',
  )
  const [installPrompt, setInstallPrompt] = useState(null)
  const [isInstalled, setIsInstalled] = useState(
    () =>
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true,
  )
  const [showInstallHelp, setShowInstallHelp] = useState(false)
  const ActivePage = pageMap[activeMenu] || AboutPage

  useEffect(() => {
    window.localStorage.setItem('aeriva-theme', isDarkMode ? 'dark' : 'light')
  }, [isDarkMode])

  useEffect(() => {
    function handleBeforeInstallPrompt(event) {
      event.preventDefault()
      setInstallPrompt(event)
    }

    function handleAppInstalled() {
      setIsInstalled(true)
      setInstallPrompt(null)
      setShowInstallHelp(false)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  async function handleGetApp() {
    if (!installPrompt) {
      setShowInstallHelp(true)
      return
    }

    await installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    setInstallPrompt(null)
    if (outcome === 'accepted') {
      setIsInstalled(true)
    } else {
      setShowInstallHelp(true)
    }
  }

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
          <div className="sidebar-header-controls">
            <button
                className="theme-toggle-mobile"
                type="button"
                aria-label={`Aktifkan mode ${isDarkMode ? 'terang' : 'gelap'}`}
                title={`Aktifkan mode ${isDarkMode ? 'terang' : 'gelap'}`}
                aria-pressed={isDarkMode}
                onClick={() => setIsDarkMode((enabled) => !enabled)}
              >
                <ThemeIcon isDarkMode={isDarkMode} />
            </button>
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
            <ThemeIcon isDarkMode={isDarkMode} />
            <span>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
          {!isInstalled && (
            <button
              className="get-app-button"
              type="button"
              onClick={handleGetApp}
            >
              <InstallIcon />
              <span>Get app</span>
            </button>
          )}
        </div>
      </aside>

      <main className="content-panel">
        <ActivePage />
      </main>
      {showInstallHelp && (
        <div
          className="install-help-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setShowInstallHelp(false)
            }
          }}
        >
          <section
            className="install-help-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-help-title"
          >
            <button
              className="install-help-close"
              type="button"
              aria-label="Tutup petunjuk"
              onClick={() => setShowInstallHelp(false)}
            >
              ×
            </button>
            <span className="install-help-icon">
              <InstallIcon />
            </span>
            <h2 id="install-help-title">Pasang AERIVA di perangkat</h2>
            <p className="install-help-intro">
              Tambahkan AERIVA ke layar utama agar mudah dibuka seperti aplikasi.
            </p>
            <div className="install-help-platform">
              <h3>Android</h3>
              <p>
                Buka menu browser Chrome, lalu pilih <strong>Install app</strong>
                {' '}atau <strong>Add to Home screen</strong>.
              </p>
            </div>
            <div className="install-help-platform">
              <h3>iPhone atau iPad</h3>
              <p>
                Buka halaman ini di Safari, tekan tombol <strong>Bagikan</strong>,
                lalu pilih <strong>Add to Home Screen</strong>.
              </p>
            </div>
            <p className="install-help-note">
              Opsi pemasangan tersedia saat website dibuka melalui HTTPS.
            </p>
          </section>
        </div>
      )}
    </div>
  )
}

export default App
