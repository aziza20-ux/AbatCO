import { useEffect, useState, type ReactNode } from 'react'
import { ArrowRight, Check, CircleCheck, Clock3, FileCheck2, Menu, ScanLine, ShieldCheck, X } from 'lucide-react'
import { useTranslation, type Lang } from './i18n/useTranslation'
import type { TranslationKey } from './i18n/en'

type Screen = 'home' | 'how-it-works' | 'about' | 'contact'

const screenIds: Screen[] = ['home', 'how-it-works', 'about', 'contact']
const navKeys: TranslationKey[] = ['nav.home', 'nav.howItWorks', 'nav.about', 'nav.contact']

const pageFromHash = (): Screen => {
  const hash = window.location.hash.replace('#/', '') as Screen
  return screenIds.includes(hash) ? hash : 'home'
}

export default function App() {
  const [screen, setScreen] = useState<Screen>(pageFromHash)
  const [menuOpen, setMenuOpen] = useState(false)
  const { lang, setLang, t } = useTranslation()

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

  const otherLang: Lang = lang === 'en' ? 'rw' : 'en'

  return <div className="public-site">
    <header className="site-header">
      <button className="site-logo" onClick={() => navigate('home')} aria-label={t('header.logoLabel')}><img src="/icons/icon-192.png" alt="Cycletrack" className="logo-icon" /><span>Cycle<span>track</span></span></button>
      <nav className={menuOpen ? 'site-nav open' : 'site-nav'}>
        {screenIds.map((id, i) => <button className={screen === id ? 'active' : ''} key={id} onClick={() => navigate(id)}>{t(navKeys[i])}</button>)}
        <button className="lang-switch-mobile" onClick={() => setLang(otherLang)}>{t(('lang.' + otherLang) as TranslationKey)}</button>
      </nav>
      <div className="header-actions">
        <button className="lang-switch" onClick={() => setLang(otherLang)} aria-label={t(('lang.' + otherLang) as TranslationKey)}>{t(('lang.' + otherLang) as TranslationKey)}</button>
        <button className="header-cta" onClick={() => navigate('contact')}>{t('header.getStarted')} <ArrowRight size={13} /></button>
      </div>
      <button className="menu-toggle" onClick={() => setMenuOpen((open) => !open)} aria-label={t('header.toggleNav')}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>
    </header>
    {screen === 'home' && <Home onNavigate={navigate} t={t} />}
    {screen === 'how-it-works' && <HowItWorks onNavigate={navigate} t={t} />}
    {screen === 'about' && <AboutTrust onNavigate={navigate} t={t} />}
    {screen === 'contact' && <Contact t={t} />}
    <Footer onNavigate={navigate} t={t} />
  </div>
}

type T = (key: TranslationKey) => string

function Home({ onNavigate, t }: { onNavigate: (screen: Screen) => void; t: T }) {
  return <>
    <main>
      <section className="hero home-hero"><div className="hero-copy"><p className="eyebrow">{t('home.hero.eyebrow')}</p><h1>{t('home.hero.heading1')}<br /><em>{t('home.hero.heading2')}</em><br /><span>{t('home.hero.heading3')}</span></h1><p className="hero-text">{t('home.hero.text')}</p><div className="hero-actions"><button className="solid-button" onClick={() => onNavigate('contact')}>{t('home.hero.cta')} <ArrowRight size={15} /></button><button className="outline-button" onClick={() => onNavigate('how-it-works')}>{t('home.hero.howItWorks')}</button></div><div className="hero-proof"><span><strong>{t('home.hero.stat1Value')}</strong><small>{t('home.hero.stat1Label')}</small></span><span><strong>{t('home.hero.stat2Value')}</strong><small>{t('home.hero.stat2Label')}</small></span></div></div><div className="hero-image"><span className="image-caption">{t('home.hero.imageCaption')}</span></div></section>
      <section className="trust-strip"><div><ShieldCheck /><strong>{t('home.trust.neutral.title')}</strong><small>{t('home.trust.neutral.copy')}</small></div><div><FileCheck2 /><strong>{t('home.trust.verified.title')}</strong><small>{t('home.trust.verified.copy')}</small></div><div><Clock3 /><strong>{t('home.trust.field.title')}</strong><small>{t('home.trust.field.copy')}</small></div></section>
      <section className="section process-section"><div className="section-heading"><p className="eyebrow">{t('home.process.eyebrow')}</p><h2>{t('home.process.heading')}</h2><button className="text-link" onClick={() => onNavigate('how-it-works')}>{t('home.process.link')} <ArrowRight size={14} /></button></div><div className="process-grid"><ProcessCard number={t('home.process.card1.number')} title={t('home.process.card1.title')} copy={t('home.process.card1.copy')} imageClass="closeup" /><ProcessCard number={t('home.process.card2.number')} title={t('home.process.card2.title')} copy={t('home.process.card2.copy')} imageClass="desk" /><ProcessCard number={t('home.process.card3.number')} title={t('home.process.card3.title')} copy={t('home.process.card3.copy')} imageClass="workshop" /></div></section>
      <section className="split-promo"><div className="promo-image"></div><div><p className="eyebrow">{t('home.promo.eyebrow')}</p><h2>{t('home.promo.heading')}</h2><p>{t('home.promo.copy')}</p><ul><li><Check size={14} /> {t('home.promo.li1')}</li><li><Check size={14} /> {t('home.promo.li2')}</li><li><Check size={14} /> {t('home.promo.li3')}</li></ul></div></section>
      <section className="cta-band"><p className="eyebrow">{t('home.cta.eyebrow')}</p><h2>{t('home.cta.heading1')}<br />{t('home.cta.heading2')}</h2><p>{t('home.cta.copy')}</p><button className="solid-button" onClick={() => onNavigate('contact')}>{t('home.cta.button')} <ArrowRight size={15} /></button></section>
    </main>
  </>
}

function ProcessCard({ number, title, copy, imageClass }: { number: string; title: string; copy: string; imageClass: string }) { return <article className="process-card"><div className={`process-image ${imageClass}`}><span>{number}</span></div><div><h3>{title}</h3><p>{copy}</p></div></article> }

function HowItWorks({ onNavigate, t }: { onNavigate: (screen: Screen) => void; t: T }) {
  const steps: [TranslationKey, TranslationKey][] = [
    ['hiw.step1.title', 'hiw.step1.copy'],
    ['hiw.step2.title', 'hiw.step2.copy'],
    ['hiw.step3.title', 'hiw.step3.copy'],
    ['hiw.step4.title', 'hiw.step4.copy'],
  ]
  const numbers = ['01', '02', '03', '04']
  return <main className="inner-page"><section className="page-intro"><p className="eyebrow">{t('hiw.eyebrow')}</p><h1>{t('hiw.heading1')}<br /><span>{t('hiw.heading2')}</span></h1><p>{t('hiw.copy')}</p><button className="solid-button" onClick={() => onNavigate('contact')}>{t('hiw.cta')} <ArrowRight size={15} /></button></section><section className="steps-section"><div className="section-heading centered"><p className="eyebrow">{t('hiw.steps.eyebrow')}</p><h2>{t('hiw.steps.heading')}</h2><p>{t('hiw.steps.subheading')}</p></div><div className="steps-list">{steps.map(([titleKey, copyKey], index) => <article className={index % 2 ? 'step-row reverse' : 'step-row'} key={numbers[index]}><div className={`step-art step-0${index + 1}`}><ScanLine size={25} /></div><div className="step-copy"><span>{numbers[index]}</span><h2>{t(titleKey)}</h2><p>{t(copyKey)}</p></div></article>)}</div></section><section className="quote-strip"><strong>"</strong><p>{t('hiw.quote')}</p></section></main>
}

function AboutTrust({ onNavigate, t }: { onNavigate: (screen: Screen) => void; t: T }) { return <main className="inner-page about-page"><section className="about-hero"><div><p className="eyebrow">{t('about.eyebrow')}</p><h1>{t('about.heading1')}<br /><span>{t('about.heading2')}</span></h1><p>{t('about.copy')}</p></div><div className="about-art"><CircleCheck size={44} /></div></section><section className="trust-principles"><div className="section-heading centered"><p className="eyebrow">{t('about.principles.eyebrow')}</p><h2>{t('about.principles.heading')}</h2></div><div className="principle-grid"><Principle icon={<ShieldCheck />} title={t('about.p1.title')} copy={t('about.p1.copy')} /><Principle icon={<FileCheck2 />} title={t('about.p2.title')} copy={t('about.p2.copy')} /><Principle icon={<CircleCheck />} title={t('about.p3.title')} copy={t('about.p3.copy')} /></div></section><section className="about-callout"><p className="eyebrow">{t('about.callout.eyebrow')}</p><h2>{t('about.callout.heading')}</h2><p>{t('about.callout.copy')}</p><button className="outline-button" onClick={() => onNavigate('contact')}>{t('about.callout.button')}</button></section></main> }
function Principle({ icon, title, copy }: { icon: ReactNode; title: string; copy: string }) { return <article className="principle"><span>{icon}</span><h3>{title}</h3><p>{copy}</p></article> }

function Contact({ t }: { t: T }) { return <main className="inner-page contact-page"><section className="contact-intro"><p className="eyebrow">{t('contact.eyebrow')}</p><h1>{t('contact.heading1')}<br /><span>{t('contact.heading2')}</span></h1><p>{t('contact.copy')}</p></section><section className="contact-grid"><aside><p className="eyebrow">{t('contact.ops.eyebrow')}</p><div className="contact-detail"><strong>{t('contact.general.label')}</strong><span>{t('contact.general.value')}</span></div><div className="contact-detail"><strong>{t('contact.field.label')}</strong><span>{t('contact.field.value')}</span></div><div className="contact-detail"><strong>{t('contact.response.label')}</strong><span>{t('contact.response.value')}</span></div></aside></section></main> }

function Footer({ onNavigate, t }: { onNavigate: (screen: Screen) => void; t: T }) {
  const tagline = t('footer.tagline').split('\n')
  return <footer className="site-footer"><div><button className="site-logo footer-logo" onClick={() => onNavigate('home')}><img src="/icons/icon-192.png" alt="Cycletrack" className="logo-icon" /><span>Cycle<span>track</span></span></button><p>{tagline[0]}<br />{tagline[1]}</p></div><div><strong>{t('footer.explore')}</strong><button onClick={() => onNavigate('how-it-works')}>{t('footer.howItWorks')}</button><button onClick={() => onNavigate('about')}>{t('footer.about')}</button></div><div><strong>{t('footer.connect')}</strong><button onClick={() => onNavigate('contact')}>{t('footer.contact')}</button><button onClick={() => onNavigate('contact')}>{t('footer.getStarted')}</button></div><small className="copyright">{t('footer.copyright')}</small></footer>
}
