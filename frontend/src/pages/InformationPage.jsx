import './InformationPage.css'

const pollutants = [
  { symbol: 'PM2.5', name: 'Partikulat halus' },
  { symbol: 'CO', name: 'Karbon monoksida' },
  { symbol: 'NO₂', name: 'Nitrogen dioksida' },
  { symbol: 'SO₂', name: 'Sulfur dioksida' },
  { symbol: 'O₃', name: 'Ozon' },
]

const cities = ['Surabaya', 'Pasuruan', 'Malang', 'Kediri', 'Jember']

const scenarios = [
  {
    icon: 'history',
    name: 'Skenario 1',
    description:
      'Menggunakan nilai historis polutan yang diprediksi pada tiga waktu sebelumnya',
    type: 'Polutan',
  },
  {
    icon: 'weather',
    name: 'Skenario 2',
    description:
      'Menggunakan nilai historis polutan dan kondisi meteorologi pada tiga waktu sebelumnya.',
    type: 'Polutan + meteorologi',
  },
]

function InformationIcon({ name }) {
  const iconPaths = {
    air: (
      <>
        <path d="M3 8h12a2 2 0 1 0-2-2" />
        <path d="M2 12h16a2 2 0 1 1-2 2" />
        <path d="M4 16h6" />
      </>
    ),
    location: (
      <>
        <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    history: (
      <>
        <path d="M3 12a9 9 0 1 0 2.6-6.4L3 8" />
        <path d="M3 3v5h5" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    weather: (
      <>
        <path d="M7 18h9a4 4 0 0 0 .5-8A6 6 0 0 0 5 11a3.5 3.5 0 0 0 2 7Z" />
        <path d="m9 21-1 2M14 21l-1 2M19 21l-1 2" />
      </>
    ),
    model: (
      <>
        <rect x="4" y="4" width="6" height="6" rx="1.5" />
        <rect x="14" y="4" width="6" height="6" rx="1.5" />
        <rect x="9" y="15" width="6" height="6" rx="1.5" />
        <path d="M7 10v2h9v-2M12 12v3" />
      </>
    ),
    insight: (
      <>
        <path d="M4 19V5M4 19h17" />
        <path d="m7 15 4-4 3 2 5-6" />
        <path d="M16 7h3v3" />
      </>
    ),
  }

  return (
    <svg
      className="information-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {iconPaths[name]}
    </svg>
  )
}

function InformationPage() {
  return (
    <main className="page-content information-page">
      <header className="information-page-header">
        <h1>Information</h1>
        <section className="information-opening" aria-labelledby="information-opening-title">
          <div className="information-opening-content">
            <span className="information-opening-badge">
              <InformationIcon name="air" />
              Kualitas udara Jawa Timur
            </span>
            <h2 id="information-opening-title">
              <span>AERIVA</span>
            </h2>
            <p>
              AERIVA merupakan aplikasi yang dirancang untuk memprediksi konsentrasi polutan udara di Provinsi Jawa Timur 
              menggunakan algoritma LightGBM (Light Gradient Boosting Machine). Aplikasi ini dilengkapi interpretasi SHAP 
              untuk menjelaskan faktor yang memengaruhi hasil prediksi, serta menyediakan pilihan lokasi, skenario prediksi, 
              dan visualisasi evaluasi model.
            </p>
            <ul className="information-opening-highlights" aria-label="Cakupan AERIVA">
              <li><strong>5</strong><span>kota</span></li>
              <li><strong>5</strong><span>polutan</span></li>
              <li><strong>2</strong><span>skenario</span></li>
            </ul>
          </div>
          <div className="information-opening-visual" aria-hidden="true">
            <img src="/aeriva-logo.png" alt="" />
          </div>
        </section>
      </header>
      <section className="information-overview" aria-label="Informasi prediksi AERIVA">
        <div className="information-coverage">
          <article className="information-card">
            <div className="information-card-heading">
              <span className="information-card-icon">
                <InformationIcon name="air" />
              </span>
              <div>
                <h2>Polutan yang diprediksi</h2>
                <p>Lima parameter kualitas udara</p>
              </div>
            </div>
            <ul className="information-pollutants">
              {pollutants.map((pollutant) => (
                <li key={pollutant.symbol}>
                  <span className="information-pollutant-symbol">
                    {pollutant.symbol}
                  </span>
                  <span>{pollutant.name}</span>
                </li>
              ))}
            </ul>
          </article>

          <article className="information-card">
            <div className="information-card-heading">
              <span className="information-card-icon">
                <InformationIcon name="location" />
              </span>
              <div>
                <h2>Cakupan wilayah</h2>
                <p>Lima kota di Provinsi Jawa Timur</p>
              </div>
            </div>
            <ul className="information-city-list">
              {cities.map((city) => (
                <li key={city}>
                  <InformationIcon name="location" />
                  {city}
                </li>
              ))}
            </ul>
          </article>
        </div>

        <section className="information-scenarios" aria-labelledby="scenarios-title">
          <div className="information-section-heading">
            <span className="information-eyebrow">Pendekatan prediksi</span>
            <h2 id="scenarios-title">Dua skenario, fitur yang berbeda</h2>
          </div>
          <div className="information-scenario-grid">
            {scenarios.map((scenario) => (
              <article className="information-scenario-card" key={scenario.name}>
                <div className="information-scenario-topline">
                  <span className="information-card-icon">
                    <InformationIcon name={scenario.icon} />
                  </span>
                  <span className="information-scenario-type">
                    {scenario.type}
                  </span>
                </div>
                <h3>{scenario.name}</h3>
                <p>{scenario.description}</p>
              </article>
            ))}
          </div>
        </section>

        <aside className="information-method" aria-label="Model dan interpretasi">
          <div className="information-method-copy">
            <span className="information-eyebrow">Model &amp; interpretasi</span>
            <div className="information-method-heading">
              <span className="information-card-icon">
                <InformationIcon name="model" />
              </span>
              <h2>LightGBM</h2>
            </div>
            <p>
              Prediksi dibuat dengan model LightGBM, algoritma machine
              learning berbasis pohon keputusan yang efisien untuk mempelajari
              pola dari data historis.
            </p>
          </div>
          <div className="information-method-note">
            <span className="information-card-icon">
              <InformationIcon name="insight" />
            </span>
            <div>
              <h3>Interpretasi SHAP</h3>
              <p>
                SHAP menunjukkan kontribusi setiap fitur terhadap hasil:
                nilai positif mendorong prediksi naik, sedangkan nilai negatif
                mendorongnya turun. Ini menjelaskan pengaruh fitur, bukan
                hubungan sebab-akibat.
              </p>
            </div>
          </div>
        </aside>

        <section className="information-tutorial" aria-labelledby="tutorial-title">
          <div className="information-section-heading">
            <span className="information-eyebrow">Panduan penggunaan</span>
            <h2 id="tutorial-title">AERIVA</h2>
          </div>
          <ol className="information-tutorial-steps">
            <li className="information-tutorial-step">
              <span className="information-tutorial-number">01</span>
              <div>
                <h3>Buka Halaman Prediction</h3>
                <p>
                  Pilih skenario, kota, dan polutan yang ingin diprediksi.
                  Skenario 1 memakai riwayat polutan; Skenario 2 juga memakai
                  data meteorologi.
                </p>
              </div>
            </li>
            <li className="information-tutorial-step">
              <span className="information-tutorial-number">02</span>
              <div>
                <h3>Tentukan waktu prediksi</h3>
                <p>
                  Pilih tanggal dan jam prediksi, lalu tekan
                  <strong> Prediksi</strong>. Hasil menampilkan estimasi
                  konsentrasi polutan pada waktu tersebut.
                </p>
              </div>
            </li>
            <li className="information-tutorial-step">
              <span className="information-tutorial-number">03</span>
              <div>
                <h3>Pahami faktor yang mempengaruhi hasil prediksi</h3>
                <p>
                  Baca bagian Interpretasi SHAP, garis hijau menunjukkan fitur
                  yang mendorong hasil naik, garis merah mendorong hasil turun.
                  Panjang garis menunjukkan besar kontribusi masing - masing fitur.
                </p>
              </div>
            </li>
            <li className="information-tutorial-step">
              <span className="information-tutorial-number">04</span>
              <div>
                <h3>Bandingkan Hasil Prediksi di halaman Evaluation</h3>
                <p>
                  Pilih kota, jenis polutan, dan rentang waktu untuk mengevaluasi performa model. 
                  Lihat perbandingan metrik evaluasi, hasil prediksi Skenario 1 dan 2, serta data aktual. 
                  Arahkan kursor ke grafik untuk melihat detail nilai pada setiap jam.
                </p>
              </div>
            </li>
          </ol>
        </section>
      </section>
    </main>
  )
}

export default InformationPage
