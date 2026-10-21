import './AboutPage.css'

const dospem = [
  { number: '01', name: 'Teny Handhayani S.Kom., M.Kom., Ph.D.' },
  { number: '02', name: 'Irvan Lewenusa S.Kom., M.Kom.' },
]

function PersonIcon() {
  return (
    <svg
      className="about-person-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  )
}

function AboutPage() {
  return (
    <main className="page-content about-page">
      <header className="about-page-header">
        <h1>About</h1>
        <p>Tentang Pengembangan AERIVA.</p>
      </header>

      <section className="about-author" aria-labelledby="about-author-title">
        <div className="about-avatar">
          <PersonIcon />
        </div>
        <div className="about-author-copy">
          <span className="about-eyebrow">Tentang Penulis</span>
          <h2 id="about-author-title">Fahrrandy Estevvan</h2>
          <p>
            AERIVA merupakan aplikasi yang dikembangkan sebagai bagian dari proyek skripsi penulis di bidang Data Science. Aplikasi ini berfokus pada prediksi konsentrasi polutan udara di Provinsi Jawa Timur menggunakan algoritma LightGBM serta interpretasi SHAP untuk menjelaskan faktor-faktor yang memengaruhi hasil prediksi.
          </p>
        </div>
      </section>

      <section className="about-supervisors" aria-labelledby="about-supervisors-title">
        <header className="about-section-header">
          <span className="about-eyebrow">Ucapan terima kasih</span>
          <h2 id="about-supervisors-title">Dosen Pembimbing</h2>
          <p>
            Terima kasih atas Bimbingan dan arahan dari Ibu & Bapak selama proses perancangan serta pengembangan
            AERIVA.
          </p>
        </header>
        <div className="about-supervisor-grid">
          {dospem.map((dospem) => (
            <article className="about-supervisor-card" key={dospem.number}>
              <span className="about-supervisor-number">{dospem.number}</span>
              <div className="about-supervisor-avatar">
                <PersonIcon />
              </div>
              <div>
                <span className="about-supervisor-role">
                  Dosen Pembimbing {dospem.number}
                </span>
                <h3>{dospem.name}</h3>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}

export default AboutPage
