import Navbar from './Navbar'
import ConnectionStatusBar from './ConnectionStatusBar'
import MiamFAB from '../miam/MiamFAB'
import MiamSheet from '../miam/MiamSheet'

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <ConnectionStatusBar />
      <main className="max-w-5xl mx-auto px-4 pt-18 md:pt-8 pb-20 md:pb-8">
        {children}
      </main>
      <MiamFAB />
      <MiamSheet />
    </div>
  )
}
