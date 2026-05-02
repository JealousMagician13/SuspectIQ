import './App.css'
import Hero from '../components/Hero'
import ModelSection from '../components/ModelSection'
import Upload from '../components/Upload'
import Team from '../components/Team'
import Footer from '../components/Footer'

export default function App() {
  return (
    <main className="site-shell">
      <Hero />
      <ModelSection />
      <Upload />
      <Team />
      <Footer />
    </main>
  )
}
