import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="w-full bg-night-950 border-t border-night-750 mt-auto">
      <div className="max-w-[1120px] mx-auto py-12 px-6 flex flex-col md:flex-row justify-between items-center gap-6">
        <Link to="/" className="font-headline font-bold text-pitch-500 text-xl italic tracking-tighter">
          LiveFooty
        </Link>
        <div className="flex flex-wrap justify-center gap-6">
          <Link to="/terms" className="text-xs text-ink-600 hover:text-ink-100 transition-colors">
            Terms of Service
          </Link>
          <Link to="/terms" className="text-xs text-ink-600 hover:text-ink-100 transition-colors">
            Privacy Policy
          </Link>
          <span className="text-xs text-ink-600 hover:text-ink-100 transition-colors cursor-pointer">
            Contact Us
          </span>
          <Link to="/terms" className="text-xs text-ink-600 hover:text-ink-100 transition-colors">
            FAQ
          </Link>
        </div>
        <span className="text-xs text-ink-600">© 2026 LiveFooty. All rights reserved.</span>
      </div>
    </footer>
  )
}