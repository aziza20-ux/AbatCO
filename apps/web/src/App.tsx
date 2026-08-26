import { useEffect, useState, type ReactNode } from 'react'
import { ArrowRight, Check, CircleCheck, Clock3, FileCheck2, Menu, ScanLine, ShieldCheck, X } from 'lucide-react'

type Screen = 'home' | 'how-it-works' | 'about' | 'contact'

const screens: { id: Screen; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'how-it-works', label: 'How It Works' },
  { id: 'about', label: 'About / Trust' },
  { id: 'contact', label: 'Contact' },
]

const pageFromHash = (): Screen => {
  const hash = window.location.hash.replace('#/', '') as Screen
  return screens.some((screen) => screen.id === hash) ? hash : 'home'
}

export default function App() {
  const [screen, setScreen] = useState<Screen>(pageFromHash)
  const [menuOpen, setMenuOpen] = useState(false)

  const navigate = (next: Screen) => {
    setScreen(next)
    setMenuOpen(false)
    window.history.pushState({}, '', `#/${next}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    const syncScreen = () => setScreen(pageFromHash())
    window.addEventListener('popstate', syncScreen)
    window.addEventListener('hashchange', syncScreen)
    return () => { window.removeEventListener('popstate', syncScreen); window.removeEventListener('hashchange', syncScreen) }
  }, [])

  return <div className="public-site">
    <header className="site-header">
      <button className="site-logo" onClick={() => navigate('home')} aria-label="CycleLedger home"><span className="logo-mark">◉</span><span>Cycle<span>Ledger</span></span></button>
      <nav className={menuOpen ? 'site-nav open' : 'site-nav'}>{screens.map(({ id, label }) => <button className={screen === id ? 'active' : ''} key={id} onClick={() => navigate(id)}>{label}</button>)}</nav>
      <div className="header-actions"><button className="sign-in" onClick={() => navigate('contact')}>Sign in</button><button className="header-cta" onClick={() => navigate('contact')}>Get Started <ArrowRight size={13} /></button></div>
      <button className="menu-toggle" onClick={() => setMenuOpen((open) => !open)} aria-label="Toggle navigation">{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>
    </header>
    {screen === 'home' && <Home onNavigate={navigate} />}
    {screen === 'how-it-works' && <HowItWorks onNavigate={navigate} />}
    {screen === 'about' && <AboutTrust onNavigate={navigate} />}
    {screen === 'contact' && <Contact onNavigate={navigate} />}
    <Footer onNavigate={navigate} />
  </div>
}

function Home({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  return <>
    <main>
      <section className="hero home-hero"><div className="hero-copy"><p className="eyebrow">Independent bicycle records</p><h1>Record the<br /><em>transaction.</em><br /><span>Verify the ownership.</span></h1><p className="hero-text">CycleLedger provides an independent, secure record of bicycle ownership history. Keep every handover clear, searchable, and trusted.</p><div className="hero-actions"><button className="solid-button" onClick={() => onNavigate('contact')}>Start a record <ArrowRight size={15} /></button><button className="outline-button" onClick={() => onNavigate('how-it-works')}>How it works</button></div><div className="hero-proof"><span><strong>14,282</strong><small>records kept</small></span><span><strong>98.4%</strong><small>verified activity</small></span></div></div><div className="hero-image"><span className="image-caption">Asset record / 04.24</span></div></section>
      <section className="trust-strip"><div><ShieldCheck /><strong>Neutral record keeper</strong><small>We document ownership. We do not sell bicycles.</small></div><div><FileCheck2 /><strong>Verified handovers</strong><small>Clear records for every transfer.</small></div><div><Clock3 /><strong>Built for the field</strong><small>Online or offline, your record stays yours.</small></div></section>
      <section className="section process-section"><div className="section-heading"><p className="eyebrow">The verification process</p><h2>A clearer chain of custody.</h2><button className="text-link" onClick={() => onNavigate('how-it-works')}>See the full process <ArrowRight size={14} /></button></div><div className="process-grid"><ProcessCard number="01" title="Record once" copy="Capture the bicycle, owner and transaction details in one trusted record." imageClass="closeup" /><ProcessCard number="02" title="Verify together" copy="Both parties review the details before the record is sealed." imageClass="desk" /><ProcessCard number="03" title="Search anytime" copy="Find a bicycle's history when you need clarity, online or offline." imageClass="workshop" /></div></section>
      <section className="split-promo"><div className="promo-image"></div><div><p className="eyebrow">For manufacturers and enthusiasts</p><h2>Built for the people who keep bicycles moving.</h2><p>From a first registration to a decade of handovers, CycleLedger keeps the important details visible without taking ownership away from the people involved.</p><ul><li><Check size={14} /> A neutral, shared record</li><li><Check size={14} /> Designed for real-world verification</li><li><Check size={14} /> Auditable by design</li></ul></div></section>
      <section className="cta-band"><p className="eyebrow">Start with a record</p><h2>Give every bicycle<br />a trusted history.</h2><p>Join the record-keeping network built around clarity, not commerce.</p><button className="solid-button" onClick={() => onNavigate('contact')}>Create a secure record <ArrowRight size={15} /></button></section>
    </main>
  </>
}

function ProcessCard({ number, title, copy, imageClass }: { number: string; title: string; copy: string; imageClass: string }) { return <article className="process-card"><div className={`process-image ${imageClass}`}><span>{number}</span></div><div><h3>{title}</h3><p>{copy}</p><button className="circle-arrow" aria-label={`Learn about ${title}`}><ArrowRight size={14} /></button></div></article> }

function HowItWorks({ onNavigate }: { onNavigate: (screen: Screen) => void }) { const steps = [['01', 'Register the bicycle', 'Capture its frame number, details, photographs and current owner.'], ['02', 'Verify the parties', 'Record the people involved and surface mismatches before they become disputes.'], ['03', 'Seal the handover', 'Both parties review the record. The event becomes part of the bicycle history.'], ['04', 'Search with confidence', 'Find a clear, chronological history whenever the bicycle changes hands.']]; return <main className="inner-page"><section className="page-intro"><p className="eyebrow">A record, not a marketplace</p><h1>The immutable<br /><span>ledger for your ride.</span></h1><p>Every bicycle carries a story. We make that story legible, verifiable, and ready when you need it.</p><button className="solid-button" onClick={() => onNavigate('contact')}>Start a secure record <ArrowRight size={15} /></button></section><section className="steps-section"><div className="section-heading centered"><p className="eyebrow">Four steps to clarity</p><h2>From frame number to trusted history.</h2><p>A simple workflow for agents, owners and every person in between.</p></div><div className="steps-list">{steps.map(([number, title, copy], index) => <article className={index % 2 ? 'step-row reverse' : 'step-row'} key={number}><div className={`step-art step-${number}`}><ScanLine size={25} /></div><div className="step-copy"><span>{number}</span><h2>{title}</h2><p>{copy}</p><button className="text-link">Explore this step <ArrowRight size={14} /></button></div></article>)}</div></section><section className="quote-strip"><strong>“</strong><p>Trust is not a claim. It is a record of what happened, kept carefully over time.</p></section></main> }

function AboutTrust({ onNavigate }: { onNavigate: (screen: Screen) => void }) { return <main className="inner-page about-page"><section className="about-hero"><div><p className="eyebrow">The CycleLedger standard</p><h1>Trust has a<br /><span>paper trail.</span></h1><p>We are building the neutral infrastructure for bicycle ownership records: independent, practical, and accountable.</p></div><div className="about-art"><CircleCheck size={44} /></div></section><section className="trust-principles"><div className="section-heading centered"><p className="eyebrow">What we stand for</p><h2>Useful records. Honest context.</h2></div><div className="principle-grid"><Principle icon={<ShieldCheck />} title="Neutral by design" copy="CycleLedger is not a marketplace. We never broker a sale or decide who owns a bicycle." /><Principle icon={<FileCheck2 />} title="Auditable by default" copy="Important actions have a traceable place in the record, so the history can be understood later." /><Principle icon={<CircleCheck />} title="Human-first verification" copy="A mismatch is surfaced as a warning, not hidden or silently overwritten." /></div></section><section className="about-callout"><p className="eyebrow">Our promise</p><h2>Clarity at every handover.</h2><p>We make the tools, protocols and context available so people can make informed decisions about the bicycles in front of them.</p><button className="outline-button" onClick={() => onNavigate('contact')}>Talk to the team</button></section></main> }
function Principle({ icon, title, copy }: { icon: ReactNode; title: string; copy: string }) { return <article className="principle"><span>{icon}</span><h3>{title}</h3><p>{copy}</p></article> }

function Contact({ onNavigate }: { onNavigate: (screen: Screen) => void }) { return <main className="inner-page contact-page"><section className="contact-intro"><p className="eyebrow">Secure protocol inquiry channel</p><h1>Let's make the<br /><span>record clearer.</span></h1><p>Have a question about the network, field operations or bringing CycleLedger to your organization? Send us a note.</p></section><section className="contact-grid"><aside><p className="eyebrow">Technical ops</p><div className="contact-detail"><strong>General inquiries</strong><span>hello@cycleledger.example</span></div><div className="contact-detail"><strong>Field operations</strong><span>+1 (555) 000-0000</span></div><div className="contact-detail"><strong>Response time</strong><span>Within one business day</span></div></aside><form onSubmit={(event) => { event.preventDefault(); onNavigate('home') }}><p className="eyebrow">Initiate submission</p><h2>Tell us where the record needs to go.</h2><div className="form-two"><label>Full name<input required placeholder="Your name" /></label><label>Contact email<input required type="email" placeholder="you@example.com" /></label></div><label>Organization or role<input placeholder="Field agent, manufacturer, community..." /></label><label>Your message<textarea required placeholder="What would you like to know?" /></label><button className="solid-button" type="submit">Transmit data package <SendIcon /></button></form></section></main> }
function SendIcon() { return <ArrowRight size={15} /> }

function Footer({ onNavigate }: { onNavigate: (screen: Screen) => void }) { return <footer className="site-footer"><div><button className="site-logo footer-logo" onClick={() => onNavigate('home')}><span className="logo-mark">◉</span><span>Cycle<span>Ledger</span></span></button><p>Independent bicycle records<br />for clearer ownership.</p></div><div><strong>Explore</strong><button onClick={() => onNavigate('how-it-works')}>How it works</button><button onClick={() => onNavigate('about')}>About / Trust</button></div><div><strong>Connect</strong><button onClick={() => onNavigate('contact')}>Contact</button><button onClick={() => onNavigate('contact')}>Get started</button></div><small className="copyright">© 2026 CycleLedger. Built for the record.</small></footer> }
