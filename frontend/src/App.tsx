// Main React component that puts the page sections together in display order.
import './App.css'
import Hero from '../components/Hero'
import ModelSection from '../components/ModelSection'
import Upload from '../components/Upload'
import Team from '../components/Team'
import Footer from '../components/Footer'

// Renders the main site sections in the order users see them.
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
