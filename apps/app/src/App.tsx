import { useState, useEffect, type ReactNode } from 'react'
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { Activity, ArrowLeft, ArrowRight, Bike, CalendarDays, Check, ChevronRight, Cloud, Database, Eye, FileText, Flag, Home, LockKeyhole, MapPin, Plus, QrCode, Search, Send, Settings, ShieldAlert, ShieldCheck, Signal, Smartphone, Trash2, TrendingUp, Type, UserRound, Users, Wifi, WifiOff, X } from 'lucide-react'
import { type BicycleRecord, type PersonRecord, mockUser } from './mock/data'
import { db } from './lib/db'
import * as api from './lib/api'
import { startSyncWorker } from './lib/sync'

type Screen = 'login' | 'forgot-password' | 'reset-password' | 'home' | 'admin-home' | 'admin-transactions' | 'transaction-record' | 'flagged-queue' | 'bicycle-inventory' | 'ownership-chain' | 'registry-profile' | 'agent-management' | 'agent-onboarding' | 'agent-terminal' | 'reports-exports' | 'transaction' | 'register' | 'search' | 'details' | 'activity' | 'profile' | 'people' | 'person-activity'
type RegisterOrigin = 'home' | 'admin-home'
type Role = 'AGENT' | 'ADMIN'

const navItems: { screen: Screen; label: string; icon: typeof Home }[] = [
  { screen: 'home', label: 'Home', icon: Home },
  { screen: 'search', label: 'Search', icon: Search },
  { screen: 'activity', label: 'Activity', icon: Activity },
  { screen: 'people', label: 'People', icon: Users },
]

export default function App() {
  const [screen, setScreen] = useState<Screen>('login')
  const [role, setRole] = useState<Role>('AGENT')
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; role: Role } | null>(null)
  const [selected, setSelected] = useState<BicycleRecord | null>(null)
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null)
  const [detailsOrigin, setDetailsOrigin] = useState<Screen>('search')
  const [transactionOrigin, setTransactionOrigin] = useState<Screen>('admin-transactions')
  const [registerOrigin, setRegisterOrigin] = useState<RegisterOrigin>('home')
  const [query, setQuery] = useState('')
  const [transactionStep, setTransactionStep] = useState(0)
  const [saved, setSaved] = useState(false)
  const [ownerDetails, setOwnerDetails] = useState<PersonRecord | null>(null)
  const [selectedAgent, setSelectedAgent] = useState<api.Agent | null>(null)
  const [selectedOwnershipBicycle, setSelectedOwnershipBicycle] = useState<api.Bicycle | null>(null)
  const [selectedPerson, setSelectedPerson] = useState<api.Person | null>(null)
  const [forgotEmail, setForgotEmail] = useState('')
  const [fontSize, setFontSize] = useState<'sm' | 'md' | 'lg'>(() => (localStorage.getItem('fontSize') as 'sm' | 'md' | 'lg') ?? 'md')
  const [pendingCount, setPendingCount] = useState(0)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const refreshPending = () =>
    Promise.all([
      db.pendingTransactions.toArray(),
      db.pendingRegistrations.toArray(),
      db.syncMetadata.toArray(),
    ]).then(([txs, regs, meta]) => {
      const blockedIds = new Set(meta.map((m) => m.key.replace(/^(conflict|error):/, '')))
      const count = [...txs, ...regs].filter((r) => !blockedIds.has(r.id)).length
      setPendingCount(count)
    })
  useEffect(() => {
    refreshPending()
    const interval = setInterval(refreshPending, 3000)
    const on = () => { setIsOnline(true); refreshPending() }
    const off = () => { setIsOnline(false); refreshPending() }
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { clearInterval(interval); window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  useEffect(() => {
    if (screen !== 'login') return startSyncWorker()
  }, [screen])

  const openDetails = (record: BicycleRecord, origin: Screen = 'search') => { setSelected(record); setDetailsOrigin(origin); setScreen('details') }
  const openDetailsById = async (id: string, frameNumber: string) => {
    const result = await api.listBicycles(frameNumber).catch(() => null)
    const bike = result?.data.find((b) => b.id === id) ?? result?.data[0]
    if (bike) openDetails({ id: bike.id, frameNumber: bike.frameNumber, name: `${bike.brand ?? ''} ${bike.model ?? ''}`.trim() || bike.frameNumber, type: 'Bicycle', color: bike.color ?? '—', owner: bike.currentOwner?.name ?? '—', location: '—', status: bike.status === 'ACTIVE' ? 'Verified' : 'Needs review', date: '' }, 'activity')
  }
  const profileOrigin = (): Screen => role === 'ADMIN' ? 'admin-home' : 'home'
  const go = (next: Screen) => { setSaved(false); if (next === 'transaction') setTransactionStep(0); setScreen(next) }

  if (screen === 'login') return <Login onLogin={(user) => { setCurrentUser(user); setRole(user.role); go(user.role === 'ADMIN' ? 'admin-home' : 'home') }} onForgot={() => go('forgot-password')} />
  if (screen === 'forgot-password') return <ForgotPasswordScreen onBack={() => go('login')} onNext={(email) => { setForgotEmail(email); go('reset-password') }} />
  if (screen === 'reset-password') return <ResetPasswordScreen email={forgotEmail} onBack={() => go('forgot-password')} onDone={() => go('login')} />

  const zoom = ({ sm: 0.88, md: 1, lg: 1.14 } as Record<string, number>)[fontSize] ?? 1

  return <div className="terminal-shell" style={{ zoom }}>
    <header className="terminal-header">
      {screen !== 'home' && screen !== 'admin-home' && <button className="back-button" onClick={() => go(screen === 'details' ? detailsOrigin : screen === 'transaction-record' ? transactionOrigin : screen === 'person-activity' ? (role === 'ADMIN' ? 'registry-profile' : 'people') : screen === 'register' ? registerOrigin : screen === 'ownership-chain' ? 'bicycle-inventory' : screen === 'profile' ? profileOrigin() : role === 'ADMIN' ? 'admin-home' : 'home')} aria-label="Go back"><ArrowLeft size={17} /></button>}
      <strong>{screenTitle(screen)}</strong>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="wifi-badge" title={isOnline ? 'Online' : 'Offline'} style={{ color: isOnline ? '#4caf7d' : '#e05' }}>{isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}</span>
        <button className="settings-icon-btn" onClick={() => go('profile')} aria-label="Profile settings"><Settings size={16} /></button>
      </div>
    </header>
    <div className="terminal-content">
      {screen === 'home' && <HomeScreen onNavigate={go} onSelect={openDetails} pendingCount={pendingCount} isOnline={isOnline} />}
      {screen === 'admin-home' && <AdminHomeScreen onNavigate={go} onManageProfile={() => go('profile')} onSetRegisterOrigin={setRegisterOrigin} />}
      {screen === 'admin-transactions' && <AdminTransactionsScreen onNavigate={go} onSelectTransaction={(id) => { setSelectedTransactionId(id); setTransactionOrigin('admin-transactions') }} />}
      {screen === 'transaction-record' && <AdminRecordScreen transactionId={selectedTransactionId} onNavigate={go} />}
      {screen === 'flagged-queue' && <FlaggedQueueScreen onNavigate={go} onSelectTransaction={(id) => { setSelectedTransactionId(id); setTransactionOrigin('flagged-queue') }} />}
      {screen === 'bicycle-inventory' && <BicycleInventoryScreen onNavigate={go} onSelectBicycle={(bike) => { setSelectedOwnershipBicycle(bike); go('ownership-chain') }} />}
      {screen === 'ownership-chain' && <OwnershipChainScreen bicycle={selectedOwnershipBicycle} />}
      {screen === 'agent-management' && <AgentManagementScreen onNavigate={go} onSelectAgent={(a) => { setSelectedAgent(a); go('agent-terminal') }} />}
      {screen === 'agent-onboarding' && <AgentOnboardingScreen onNavigate={(s) => { if (s !== 'agent-onboarding') setSelectedAgent(null); go(s) }} />}
      {screen === 'agent-terminal' && <AgentTerminalScreen agent={selectedAgent} onNavigate={go} />}
      {screen === 'reports-exports' && <ReportsExportsScreen onNavigate={go} />}
      {screen === 'transaction' && <TransactionFlow step={transactionStep} setStep={setTransactionStep} saved={saved} onSave={() => { setSaved(true); refreshPending() }} onCancel={() => go('home')} onViewOwner={setOwnerDetails} />}
      {screen === 'register' && <RegisterScreen onSave={() => { setSaved(true); refreshPending() }} saved={saved} onCancel={() => go(registerOrigin)} onViewOwner={setOwnerDetails} />}
      {screen === 'search' && <SearchScreen query={query} setQuery={setQuery} onSelect={openDetails} />}
      {screen === 'details' && selected && <DetailsScreen record={selected} />}
      {screen === 'activity' && <ActivityScreen onOpenDetails={openDetailsById} onSelectTransaction={(id) => { setSelectedTransactionId(id); setTransactionOrigin('activity'); go('transaction-record') }} />}
      {screen === 'people' && <PeopleScreen onSelectPerson={(p) => { setSelectedPerson(p); go('person-activity') }} />}
      {screen === 'person-activity' && <PersonActivityScreen person={selectedPerson} onSelectTransaction={(id) => { setSelectedTransactionId(id); setTransactionOrigin('person-activity'); go('transaction-record') }} onOpenDetails={openDetailsById} />}
      {screen === 'registry-profile' && <PeopleScreen onSelectPerson={(p) => { setSelectedPerson(p); go('person-activity') }} />}
      {screen === 'profile' && <ProfileScreen user={currentUser} role={role} fontSize={fontSize} onChangeFontSize={(v) => { setFontSize(v); localStorage.setItem('fontSize', v) }} onLogout={async () => { await api.logout().catch(() => undefined); setCurrentUser(null); setRole('AGENT'); go('login') }} />}
    </div>
    {role === 'ADMIN' ? <AdminBottomNav screen={screen} onNavigate={go} /> : screen !== 'transaction' && screen !== 'register' && screen !== 'details' && screen !== 'person-activity' && <BottomNav screen={screen} onNavigate={go} />}
    {ownerDetails && <OwnerDetailsModal person={ownerDetails} onClose={() => setOwnerDetails(null)} />}
  </div>
}

function screenTitle(screen: Screen) {
  return { home: 'Agent Dashboard', 'admin-home': 'Biketrack Admin', 'admin-transactions': 'All Transactions', 'transaction-record': 'Transaction Record', 'flagged-queue': 'Flagged Queue', 'bicycle-inventory': 'Bicycle Inventory', 'ownership-chain': 'Ownership Chain', 'registry-profile': 'Registry Profile', 'agent-management': 'Field Agent Management', 'agent-onboarding': 'Agent Onboarding', 'agent-terminal': 'Agent Terminal', 'reports-exports': 'Reports & Exports', transaction: 'New Transaction', register: 'Register Bicycle', search: 'Search Field Records', details: 'Record Details', activity: 'Recent Activity', profile: 'Agent Profile & Settings', people: 'People Registry', 'person-activity': 'Person Activity', login: 'Login', 'forgot-password': 'Reset Password', 'reset-password': 'Reset Password' }[screen]
}

function ForgotPasswordScreen({ onBack, onNext }: { onBack: () => void; onNext: (email: string) => void }) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async () => {
    setBusy(true); setError(null)
    try { await api.forgotPassword(email); onNext(email) }
    catch { setError('Something went wrong. Try again.') }
    finally { setBusy(false) }
  }
  return <main className="login-screen">
    <div className="login-hero"><div className="hero-bike"><img src="/icons/icon-192.png" alt="AbatCO" /></div><strong>CycleTrack</strong><small></small></div>
    <section className="login-panel"><p className="screen-kicker">RESET PASSWORD</p><p className="login-copy">Enter your account email. A 6-digit code will be sent to you.</p>
      <label><span><Smartphone size={12} /> Email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="agent@example.com" /></label>
      {error && <p style={{ color: '#e05', fontSize: 13 }}>{error}</p>}
      <button className="action-button" disabled={busy || !email} onClick={() => void submit()}>{busy ? 'Sending...' : 'Send code'} <ArrowRight size={16} /></button>
      <button className="quiet-button" style={{ marginTop: 12 }} onClick={onBack}>Back to login</button>
    </section>
  </main>
}

function ResetPasswordScreen({ email, onBack, onDone }: { email: string; onBack: () => void; onDone: () => void }) {
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(30)
  const [resending, setResending] = useState(false)
  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])
  const resend = async () => {
    setResending(true); setError(null)
    try { await api.forgotPassword(email); setResendCooldown(30) }
    catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? ''
      setError(msg.includes('30') ? 'Please wait 30 seconds before resending.' : 'Failed to resend code. Try again.')
    }
    finally { setResending(false) }
  }
  const submit = async () => {
    if (newPassword !== confirm) { setError('Passwords do not match'); return }
    if (newPassword.length < 12) { setError('Password must be at least 12 characters'); return }
    setBusy(true); setError(null)
    try { await api.resetPassword(email, otp, newPassword); setDone(true) }
    catch { setError('Invalid or expired code') }
    finally { setBusy(false) }
  }
  return <main className="login-screen">
    <div className="login-hero"><div className="hero-bike"><img src="/icons/icon-192.png" alt="AbatCO" /></div><strong>CycleTrack</strong><small>FIELD AGENT TERMINAL</small></div>
    <section className="login-panel"><p className="screen-kicker">RESET PASSWORD</p>
      {done ? <>
        <p style={{ color: '#4caf7d', margin: '12px 0' }}><Check size={14} /> Password reset successfully.</p>
        <button className="action-button" onClick={onDone}>Back to login <ArrowRight size={16} /></button>
      </> : <>
        <p className="login-copy">Enter the 6-digit code sent to <strong>{email}</strong> and your new password.</p>
        <label><span><LockKeyhole size={12} /> Code</span><input value={otp} onChange={(e) => setOtp(e.target.value)} maxLength={6} placeholder="000000" /></label>
        <label><span><LockKeyhole size={12} /> New password (min 12)</span><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></label>
        <label><span><LockKeyhole size={12} /> Confirm password</span><input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label>
        {error && <p style={{ color: '#e05', fontSize: 13 }}>{error}</p>}
        <button className="action-button" disabled={busy || !otp || !newPassword || !confirm} onClick={() => void submit()}>{busy ? 'Resetting...' : 'Reset password'} <ArrowRight size={16} /></button>
        <button className="quiet-button" style={{ marginTop: 8 }} disabled={resendCooldown > 0 || resending} onClick={() => void resend()}>
          {resending ? 'Sending...' : resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
        </button>
        <button className="quiet-button" style={{ marginTop: 4 }} onClick={onBack}>Back</button>
      </>}
    </section>
  </main>
}

function Login({ onLogin, onForgot }: { onLogin: (user: { id: string; name: string; role: Role }) => void; onForgot: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const submit = async () => {
    if (!email || !password) return
    setLoading(true); setError(null)
    try { const result = await api.login(email, password); onLogin(result.user) }
    catch { setError('Invalid credentials') }
    finally { setLoading(false) }
  }
  return <main className="login-screen">
    <div className="login-hero"><div className="hero-bike"><img src="/icons/icon-192.png" alt="AbatCO" /></div><strong>CycleTrack</strong><small></small></div>
    <section className="login-panel"><p className="screen-kicker">SECURE ENTRY</p><p className="login-copy">Authorized personnel only.</p>
      <label><span><Smartphone size={12} /> Email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" /></label>
      <label><span><LockKeyhole size={12} /> Password</span><div className="password-input"><input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} /><Eye size={15} style={{ cursor: 'pointer', flexShrink: 0 }} onClick={() => setShowPassword((v) => !v)} /></div></label>
      {error && <p className="error-text" style={{color:'#e05'}}>{error}</p>}
      <button className="action-button" disabled={loading || !email || !password} onClick={() => void submit()}>{loading ? 'Signing in...' : 'Login'} <ArrowRight size={16} /></button>
      <button className="quiet-button" style={{ marginTop: 12 }} onClick={onForgot}>Forgot password?</button>
    </section>
    <footer className="offline-bar"><span><Signal size={14} /> Connectivity</span><strong>Offline-ready mode</strong><small>v2.4.1-field</small></footer>
  </main>
}

function HomeScreen({ onNavigate, onSelect, pendingCount, isOnline }: { onNavigate: (screen: Screen) => void; onSelect: (record: BicycleRecord) => void; pendingCount: number; isOnline: boolean }) {
  const { data: recentData } = useQuery({ queryKey: ['bicycles', '', 1], queryFn: () => api.listBicycles(undefined, 1) })
  const recentBike = recentData?.data[0] ?? null
  const recentRecord: BicycleRecord | null = recentBike ? { id: recentBike.id, frameNumber: recentBike.frameNumber, name: `${recentBike.brand ?? ''} ${recentBike.model ?? ''}`.trim() || recentBike.frameNumber, type: 'Bicycle', color: recentBike.color ?? '—', owner: recentBike.currentOwner?.name ?? '—', location: '—', status: recentBike.status === 'ACTIVE' ? 'Verified' : 'Needs review', date: '' } : null
  return <>
    <section className="welcome"><p className="screen-kicker">LOGGED IN AS FIELD AGENT</p><h1>Operations Center</h1></section>
    <button className="feature-button" onClick={() => onNavigate('transaction')}><span className="feature-icon"><FileText size={22} /></span><span><strong>New Transaction</strong><small>Initiate bicycle sale or transfer</small></span><ArrowRight /></button>
    <button className="feature-button" onClick={() => onNavigate('register')}><span className="feature-icon"><Bike size={22} /></span><span><strong>Register Bicycle</strong><small>Capture serial & owner data</small></span><ArrowRight /></button>
    <div className="quick-grid"><button onClick={() => onNavigate('search')}><Search size={20} /><strong>Search</strong></button><button onClick={() => onNavigate('activity')}><Activity size={20} /><strong>Activity</strong></button></div>
    <p className="section-label">Session intelligence</p><div className="intelligence"><div><small>Today's tasks</small><strong>{pendingCount > 0 ? `${pendingCount} pending sync` : 'All synced'}</strong></div><div><small>Local cache</small><strong className="lime">Active</strong></div>{!isOnline && <footer><Database size={13} /> Offline database active</footer>}</div>
    {recentRecord && <><p className="section-label">Last modified record</p><button className="record-row" onClick={() => onSelect(recentRecord)}><span className="record-icon"><Bike size={18} /></span><span><strong>{recentRecord.frameNumber}</strong><small>◷ Most recent bicycle</small></span><ChevronRight size={17} /></button></>}
  </>
}

function AdminHomeScreen({ onNavigate, onManageProfile, onSetRegisterOrigin }: { onNavigate: (screen: Screen) => void; onManageProfile: () => void; onSetRegisterOrigin: (o: RegisterOrigin) => void }) {
  const { data: dashData } = useQuery({ queryKey: ['dashboard'], queryFn: () => api.getDashboard() })
  const stats = dashData?.data ?? null
  const metrics = [['Total registered', stats ? String(stats.bicycles) : '…', TrendingUp], ['Active agents', stats ? String(stats.activeAgents) : '…', Users], ['Transactions', stats ? String(stats.transactions) : '…', Cloud], ['Flagged alerts', stats ? String(stats.flags) : '…', Flag]] as const
  const modules = [['Transactions', 'Historical log', Activity], ['Bicycles', 'Registry inventory', Bike], ['People', 'Owner directory', Users], ['Field agents', 'Team management', UserRound], ['Reports', 'Export & analytics', FileText], ['Flagged', 'Priority queue', Flag]] as const
  return <section className="admin-home">
    <div className="admin-brand"><span>BIKETRACK ADMIN</span><small>RECORD-KEEPING CONTROL CENTER</small></div>
    <div className="admin-metrics">{metrics.map(([label, value, Icon]) => <div className="admin-metric" key={label}><div><Icon size={14} /></div><small>{label}</small><strong>{value}</strong></div>)}</div>
    <div className="admin-section-heading"><span><Flag size={13} /> Flagged queue</span><button onClick={() => onNavigate('flagged-queue')}>View all</button></div><p className="admin-subtitle">Immediate resolution required</p>
    <p className="admin-section-label"><TrendingUp size={11} /> Control modules</p><div className="module-grid">{modules.map(([label, copy, Icon], index) => <button key={label} className={index === 5 ? 'module danger' : 'module'} onClick={() => onNavigate(['admin-transactions', 'bicycle-inventory', 'registry-profile', 'agent-management', 'reports-exports', 'flagged-queue'][index] as Screen)}><Icon size={15} /><strong>{label}</strong><small>{copy}</small>{index === 5 && <b>!</b>}</button>)}</div>
    <button className="admin-register" onClick={() => { onSetRegisterOrigin('admin-home'); onNavigate('register') }}><Plus size={14} /> Register new bicycle</button>
    <div className="admin-footer-actions"><button onClick={onManageProfile}>Manage profile</button></div><p className="admin-integrity">"Integrity in every record, security in every chain."</p>
  </section>
}

function AdminTransactionsScreen({ onNavigate, onSelectTransaction }: { onNavigate: (screen: Screen) => void; onSelectTransaction: (id: string) => void }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<string>('All')
  const flagStatus = filter === 'Flagged' ? 'FLAGGED' : undefined
  const type = filter === 'Sales' ? 'SALE' : filter === 'Transfers' ? 'TRANSFER' : undefined
  const { data, isLoading: loading } = useQuery({ queryKey: ['transactions', query, filter], queryFn: () => api.listTransactions({ q: query || undefined, flagStatus, type }) })
  const transactions = data?.data ?? []
  return <section className="admin-transactions">
    <div className="admin-page-heading"><div><p className="screen-kicker">CONTROL MODULE</p><h1>All Transactions</h1><p>Network-wide historical record</p></div>
      <button className="admin-icon-button" aria-label="Export transactions" onClick={() => api.downloadTransactionsXlsx().catch(() => undefined)}><Send size={15} /></button>
    </div>
    <div className="admin-search"><Search size={14} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search ID, frame, owner..." /></div>
    <div className="admin-filters">{['All','Sales','Transfers','Flagged'].map((f) => <button key={f} className={filter === f ? 'selected' : ''} onClick={() => setFilter(f)}>{f}</button>)}</div>
    {loading && <p className="empty-state">Loading...</p>}
    <div className="transaction-list">{transactions.map((t) => <button className="transaction-item" key={t.id} onClick={() => { onSelectTransaction(t.id); onNavigate('transaction-record') }}>
      <div className="transaction-item-head"><span className={`transaction-type ${t.type.toLowerCase()}`}>{t.type}</span><em className={t.flagStatus === 'NONE' ? 'verified' : t.flagStatus === 'FLAGGED' ? 'flagged' : 'pending'}>{t.flagStatus}</em></div>
      <strong>{t.bicycle.brand} {t.bicycle.model}</strong><small className="transaction-frame">{t.bicycle.frameNumber} · {t.transactionId}</small>
      <div className="transaction-meta"><span>{t.seller?.name ?? '—'} → {t.buyer?.name ?? '—'}</span><span>{t.recordingAgent.name}</span><span>{new Date(t.transactionDate).toLocaleDateString()}</span></div>
      <ChevronRight size={15} /></button>)}
    </div>
    {!loading && transactions.length === 0 && <p className="empty-state">No transactions match this search.</p>}
  </section>
}

function AdminRecordScreen({ transactionId, onNavigate }: { transactionId: string | null; onNavigate: (screen: Screen) => void }) {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['transaction', transactionId], queryFn: () => api.getTransaction(transactionId!), enabled: !!transactionId })
  const [note, setNote] = useState('')
  const [noteOpen, setNoteOpen] = useState(false)
  const { mutate: review, isPending } = useMutation({
    mutationFn: (status: 'REVIEWED' | 'FLAGGED') => api.reviewTransaction(transactionId!, status, note || undefined),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['transaction', transactionId] }); queryClient.invalidateQueries({ queryKey: ['transactions'] }); setNoteOpen(false); setNote('') },
  })
  const t = data?.data
  return <AdminPanel title="Transaction Record" kicker={t ? t.transactionId : 'LOADING...'}>
    {isLoading && <p className="empty-state">Loading...</p>}
    {t && <>
      {(t.flagStatus === 'FLAGGED' || t.flagStatus === 'CONFLICTED') && <div className="admin-record-alert"><ShieldAlert size={14} /><strong>Resolution required</strong><small>{t.flagReason ?? 'Flagged record requires administrator review.'}</small></div>}
      <AdminInfo title="Transaction summary" rows={[`${t.type} · ${new Date(t.transactionDate).toLocaleString()}`, `${t.bicycle.brand ?? ''} ${t.bicycle.model ?? ''} · ${t.bicycle.frameNumber}`, `${t.seller?.name ?? '—'} → ${t.buyer?.name ?? '—'}`, `Recorded by ${t.recordingAgent.name}`]} />
      <em className={t.flagStatus === 'NONE' || t.flagStatus === 'REVIEWED' ? 'verified' : 'flagged'} style={{ display: 'block', marginBottom: 12 }}>{t.flagStatus}</em>
      {noteOpen && <label style={{ display: 'block', marginBottom: 8 }}>Admin note<textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional review note..." style={{ width: '100%', marginTop: 4 }} /></label>}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {t.flagStatus !== 'REVIEWED' && <button className="action-button" disabled={isPending} onClick={() => { setNoteOpen(true); review('REVIEWED') }}>{isPending ? 'Saving...' : <><Check size={13} /> Mark reviewed</>}</button>}
        {t.flagStatus !== 'FLAGGED' && <button className="admin-wide-button" style={{ background: 'transparent', border: '1px solid #e05', color: '#e05' }} disabled={isPending} onClick={() => { setNoteOpen(true); review('FLAGGED') }}><Flag size={13} /> Flag</button>}
        {!noteOpen && <button className="quiet-button" onClick={() => setNoteOpen((v) => !v)}>Add note</button>}
      </div>
    </> }
    <button className="admin-wide-button" onClick={() => onNavigate('flagged-queue')}>Open flagged queue</button>
  </AdminPanel>
}
function FlaggedQueueScreen({ onNavigate, onSelectTransaction }: { onNavigate: (screen: Screen) => void; onSelectTransaction: (id: string) => void }) {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<'flagged' | 'conflicts'>('flagged')
  const { data, isLoading: loading } = useQuery({ queryKey: ['transactions', '', 'FLAGGED'], queryFn: () => api.listTransactions({ flagStatus: 'FLAGGED' }) })
  const { data: conflictsData, isLoading: conflictsLoading } = useQuery({ queryKey: ['conflicts'], queryFn: () => api.listConflicts() })
  const flagged = data?.data ?? []
  const conflicts = conflictsData?.data ?? []
  const { mutate: resolve, isPending: resolving, variables: resolvingVars } = useMutation({
    mutationFn: ({ id, resolution, note }: { id: string; resolution: 'ACCEPT' | 'REJECT'; note?: string }) => api.resolveConflict(id, resolution, note),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['conflicts'] }); queryClient.invalidateQueries({ queryKey: ['transactions'] }) },
  })
  return <AdminPanel title="Flagged Queue" kicker={`ACTIVE INCIDENTS · ${flagged.length + conflicts.length}`}>
    <div className="admin-filters" style={{ marginBottom: 12 }}>
      <button className={tab === 'flagged' ? 'selected' : ''} onClick={() => setTab('flagged')}>Flagged ({flagged.length})</button>
      <button className={tab === 'conflicts' ? 'selected' : ''} onClick={() => setTab('conflicts')}>Conflicts ({conflicts.length})</button>
    </div>
    {tab === 'flagged' && <>
      {loading && <p className="empty-state">Loading...</p>}
      {flagged.map((t) => <button className="incident-card" key={t.id} onClick={() => { onSelectTransaction(t.id); onNavigate('transaction-record') }}>
        <Flag size={14} /><strong>{t.bicycle.brand} {t.bicycle.model}<small>{t.flagReason ?? 'Flagged for review'}</small></strong><em>Review <ChevronRight size={12} /></em>
      </button>)}
      {!loading && flagged.length === 0 && <p className="empty-state">No flagged transactions.</p>}
    </> }
    {tab === 'conflicts' && <>
      {conflictsLoading && <p className="empty-state">Loading...</p>}
      {conflicts.map((c) => {
        const busy = resolving && (resolvingVars as { id: string })?.id === c.id
        return <div className="incident-card" key={c.id} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
            <ShieldAlert size={14} />
            <strong style={{ flex: 1 }}>{c.entity}<small>{c.user.name} · {new Date(c.createdAt).toLocaleDateString()}</small></strong>
          </div>
          {c.conflictReason && <small style={{ color: '#e05' }}>{c.conflictReason}</small>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="action-button" style={{ fontSize: 12, padding: '4px 10px' }} disabled={busy} onClick={() => resolve({ id: c.id, resolution: 'ACCEPT' })}>{busy ? '...' : <><Check size={12} /> Accept</>}</button>
            <button className="quiet-button" style={{ fontSize: 12, padding: '4px 10px', color: '#e05' }} disabled={busy} onClick={() => resolve({ id: c.id, resolution: 'REJECT' })}>Reject</button>
          </div>
        </div>
      })}
      {!conflictsLoading && conflicts.length === 0 && <p className="empty-state">No pending conflicts.</p>}
    </> }
  </AdminPanel>
}
function BicycleInventoryScreen({ onNavigate, onSelectBicycle }: { onNavigate: (screen: Screen) => void; onSelectBicycle: (bike: api.Bicycle) => void }) {
  const [q, setQ] = useState('')
  const { data } = useQuery({ queryKey: ['bicycles', q], queryFn: () => api.listBicycles(q || undefined) })
  const bicycles = data?.data ?? []
  return <AdminPanel title="Bicycle Inventory" kicker="REGISTRY INVENTORY">
    <div className="admin-search"><Search size={14} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search SN, Brand, or Owner..." /></div>
    {bicycles.map((bike) => <button className="inventory-item" key={bike.id} onClick={() => onSelectBicycle(bike)}><Bike size={18} /><strong>{bike.brand} {bike.model}<small>SN: {bike.frameNumber} · {bike.currentOwner?.name ?? '—'}</small></strong><em>{bike.status}</em><ChevronRight size={14} /></button>)}
    {bicycles.length === 0 && <p className="empty-state">No bicycles found.</p>}
  </AdminPanel>
}
function OwnershipChainScreen({ bicycle }: { bicycle: api.Bicycle | null }) {
  const { data: txData } = useQuery({ queryKey: ['transactions', bicycle?.frameNumber], queryFn: () => api.listTransactions({ q: bicycle?.frameNumber }), enabled: !!bicycle })
  const { data: regData } = useQuery({ queryKey: ['registrations', bicycle?.id], queryFn: () => api.listRegistrations({ bicycleId: bicycle!.id }), enabled: !!bicycle })
  const transactions = txData?.data ?? []
  const registration = regData?.data?.[0]
  const currentOwner = bicycle?.currentOwner as (api.Person & { nationalId?: string }) | undefined
  return <AdminPanel title="Ownership Chain" kicker={bicycle ? `${bicycle.brand ?? ''} ${bicycle.model ?? ''}`.trim() || bicycle.frameNumber : 'SELECT A BICYCLE'}>
    {bicycle && <>
      <div className="chain-card">
        <small>Current owner</small>
        <strong>{currentOwner?.name ?? '—'}</strong>
        {currentOwner && <dl className="chain-owner-details">
          {currentOwner.nationalId && <><dt>National ID</dt><dd>{currentOwner.nationalId}</dd></>}
          {currentOwner.phone && <><dt>Phone</dt><dd>{currentOwner.phone}</dd></>}
          {currentOwner.cell && <><dt>Cell</dt><dd>{currentOwner.cell}</dd></>}
          {currentOwner.sector && <><dt>Sector</dt><dd>{currentOwner.sector}</dd></>}
          {currentOwner.village && <><dt>Village</dt><dd>{currentOwner.village}</dd></>}
        </dl>}
        <span>SN: {bicycle.frameNumber}</span>
      </div>
      {registration && <div className="chain-event" key="reg"><span></span><strong>Registration · {new Date(registration.createdAt).toLocaleDateString()}<small>Owner: {registration.owner.name} · Recorded by {registration.recordingAgent.name}</small></strong></div>}
      {transactions.map((t) => <div className="chain-event" key={t.id}><span></span><strong>{t.type === 'SALE' ? 'Sale' : 'Transfer'} · {new Date(t.transactionDate).toLocaleDateString()}<small>{t.seller?.name ?? '—'} → {t.buyer?.name ?? '—'} · {t.transactionId}</small></strong></div>)}
      {transactions.length === 0 && !registration && <p className="empty-state">No chain history found.</p>}
    </> }
    {!bicycle && <p className="empty-state">No bicycle selected.</p>}
  </AdminPanel>
}
function RegistryProfileScreen({ onNavigate }: { onNavigate: (screen: Screen) => void }) { return <AdminPanel title="Registry Profile" kicker="MARCUS V. STERLING"><div className="registry-identity"><span className="profile-avatar">MV</span><strong>Verified registry owner<small>REG-99285-MV · Sector 4 Administrative District</small></strong></div><div className="inventory-summary"><strong>2<small>Currently owned</small></strong><strong className="rust-number">1<small>System flags</small></strong></div><button className="inventory-item" onClick={() => onNavigate('bicycle-inventory')}><Bike size={18} /><strong>Specialized Rockhopper Expert<small>SP-88218-Z2 · Active residence</small></strong><em>Registered</em></button><button className="inventory-item"><Bike size={18} /><strong>Cannondale Quick Disc 3<small>CN-11923-Q · Active residence</small></strong><em>Registered</em></button></AdminPanel> }
function AgentManagementScreen({ onNavigate, onSelectAgent }: { onNavigate: (screen: Screen) => void; onSelectAgent: (agent: api.Agent) => void }) {
  const [pendingRevoke, setPendingRevoke] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const queryClient = useQueryClient()
  const { data, isLoading: loading } = useQuery({ queryKey: ['agents'], queryFn: () => api.listAgents() })
  const agents = data?.data ?? []
  const { mutate: revoke } = useMutation({ mutationFn: (id: string) => api.revokeAgent(id), onSuccess: (_, id) => { queryClient.setQueryData<typeof data>(['agents'], (old) => old ? { data: old.data.map((ag) => ag.id === id ? { ...ag, isActive: false } : ag) } : old); setPendingRevoke(null) } })
  const filtered = agents.filter((a) => a.name.toLowerCase().includes(q.toLowerCase()) || a.email.toLowerCase().includes(q.toLowerCase()))
  return <AdminPanel title="Field Agent Management" kicker="AUTHORIZED PERSONNEL">
    <div className="admin-search"><Search size={14} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or email..." /></div>
    {loading && <p className="empty-state">Loading...</p>}
    {filtered.map((agent) => <div className="agent-item" key={agent.id}>
      <button className="agent-main" onClick={() => onSelectAgent(agent)}>
        <span className="profile-avatar">{agent.name.split(' ').map((p) => p[0]).join('').slice(0,2)}</span>
        <strong>{agent.name}<small>{agent.isActive ? 'ACTIVE' : 'REVOKED'} · {agent._count.transactions} records</small></strong>
        <ChevronRight size={14} />
      </button>
      {agent.isActive && <button className="delete-agent" onClick={() => setPendingRevoke(agent.id)} aria-label={`Revoke ${agent.name}`}><Trash2 size={14} /></button>}
    </div>)}
    {!loading && filtered.length === 0 && <p className="empty-state">No agents found.</p>}
    <button className="admin-wide-button" onClick={() => onNavigate('agent-onboarding')}><Plus size={14} /> Onboard new agent</button>
    {pendingRevoke && <div className="delete-confirm"><p>Revoke this agent?</p><small>They will no longer be able to log in.</small><div><button onClick={() => setPendingRevoke(null)}>Cancel</button><button className="danger-confirm" onClick={() => revoke(pendingRevoke)}>Revoke agent</button></div></div>}
  </AdminPanel>
}
function AgentOnboardingScreen({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const update = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }))
  const submit = async () => {
    setSaving(true); setError(null)
    try { await api.createAgent({ name: form.name, email: form.email, phone: form.phone || undefined, password: form.password }); queryClient.invalidateQueries({ queryKey: ['agents'] }); onNavigate('agent-management') }
    catch { setError('Failed to create agent. Check all fields and try again.') }
    finally { setSaving(false) }
  }
  const ready = form.name.trim() && form.email.trim() && form.password.length >= 12
  return <AdminPanel title="Agent Onboarding" kicker="NEW FIELD AGENT">
    <label>Full legal name<input value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="e.g. Marcus Thorne" /></label>
    <label>Official email<input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="agent@biketrack.gov" /></label>
    <label>Phone number<input type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="+233 24 000 0000" /></label>
    <label>Password (min 12 chars)<input type="password" value={form.password} onChange={(e) => update('password', e.target.value)} /></label>
    {error && <p className="error-text" style={{ color: '#e05' }}>{error}</p>}
    <button className="admin-wide-button" disabled={!ready || saving} onClick={() => void submit()}>{saving ? 'Creating...' : 'Create agent credentials'} <ArrowRight size={14} /></button>
  </AdminPanel>
}
function AgentTerminalScreen({ agent, onNavigate }: { agent: api.Agent | null; onNavigate: (screen: Screen) => void }) {
  const queryClient = useQueryClient()
  const normalise = (p: api.AgentPermissions | null | undefined): api.AgentPermissions => ({
    canRegister: p?.canRegister === true,
    canTransfer: p?.canTransfer === true,
    canFlag: p?.canFlag === true,
    canOverride: p?.canOverride === true,
  })
  const [perms, setPerms] = useState<api.AgentPermissions>(() => normalise(agent?.permissions))
  useEffect(() => { setPerms(normalise(agent?.permissions)) }, [agent])
  const { mutate: savePerms, isPending } = useMutation({
    mutationFn: (next: api.AgentPermissions) => api.updateAgentPermissions(agent!.id, next),
    onSuccess: (result) => {
      const next = normalise(result.data.permissions)
      setPerms(next)
      queryClient.setQueryData<{ data: api.Agent[] }>(['agents'], (old) =>
        old ? { data: old.data.map((a) => a.id === agent!.id ? { ...a, permissions: next } : a) } : old
      )
    },
  })
  const toggle = (key: keyof api.AgentPermissions) => {
    const next = { ...perms, [key]: !perms[key] }
    setPerms(next)
    savePerms(next)
  }
  const protocols: { key: keyof api.AgentPermissions; name: string; copy: string }[] = [
    { key: 'canRegister', name: 'New registration', copy: 'Allow agent to record and sync records' },
    { key: 'canTransfer', name: 'Asset transfers', copy: 'Allow agent to record and sync records' },
    { key: 'canFlag', name: 'Flag authority', copy: 'Grant power to review suspicious assets' },
    { key: 'canOverride', name: 'Remote override', copy: 'Grant power to review suspicious assets' },
  ]
  const initials = agent ? agent.name.split(' ').map((p) => p[0]).join('').slice(0, 2) : '??'
  return <AdminPanel title="Agent Terminal" kicker={agent ? `${agent.name.toUpperCase()} · ${agent.isActive ? 'ACTIVE' : 'REVOKED'}` : 'AGENT DETAILS'}>
    <div className="registry-identity">
      <span className="profile-avatar">{initials}</span>
      <span><strong>{agent?.name ?? '—'}</strong><small>{agent?.email ?? '—'}</small></span>
    </div>
    {agent && <div className="admin-info">
      <h2>Agent details</h2>
      <p>Phone: {agent.phone ?? '—'}</p>
      <p>Status: {agent.isActive ? 'Active' : 'Revoked'}</p>
      <p>Transactions recorded: {agent._count.transactions}</p>
      <p>Member since: {new Date(agent.createdAt).toLocaleDateString()}</p>
    </div>}
    <p className="admin-section-label">Access protocols {isPending && <span style={{ color: '#7f8d87', marginLeft: 6 }}>Saving...</span>}</p>
    {protocols.map(({ key, name, copy }) => <div className="protocol-row" key={key}>
      <ShieldCheck size={14} />
      <strong>{name}<small>{copy}</small></strong>
      <button
        className={`toggle ${perms[key] ? 'on' : ''}`}
        onClick={() => agent && toggle(key)}
        disabled={!agent || isPending}
        aria-label={`${perms[key] ? 'Disable' : 'Enable'} ${name}`}
        style={{ cursor: agent ? 'pointer' : 'not-allowed' }}
      />
    </div>)}
    <button className="admin-wide-button" onClick={() => onNavigate('agent-management')}>Return to agents</button>
  </AdminPanel>
}
function ReportsExportsScreen({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const run = async (key: string, params: Parameters<typeof api.downloadTransactionsXlsx>[0]) => {
    setBusy(key); setError(null)
    try { await api.downloadTransactionsXlsx(params) }
    catch { setError('Export failed. Try again.') }
    finally { setBusy(null) }
  }
  const reports: { key: string; label: string; sub: string; params: Parameters<typeof api.downloadTransactionsXlsx>[0] }[] = [
    { key: 'all', label: 'Transaction audit log', sub: 'All transactions — full history', params: {} },
    { key: 'sales', label: 'Sales report', sub: 'SALE type transactions only', params: { type: 'SALE' } },
    { key: 'transfers', label: 'Transfers report', sub: 'TRANSFER type transactions only', params: { type: 'TRANSFER' } },
    { key: 'flagged', label: 'Flagged incident summary', sub: 'All flagged and conflicted records', params: { flagStatus: 'FLAGGED' } },
  ]
  return <AdminPanel title="Reports & Exports" kicker="ADVANCED ANALYTICS">
    <div className="report-hero"><TrendingUp size={25} /><strong>Generate encrypted audit reports</strong><small>Industry-standard audit trails and operational summaries.</small></div>
    {error && <p className="error-text" style={{ color: '#e05', marginBottom: 8 }}>{error}</p>}
    {reports.map(({ key, label, sub, params }) => <button className="report-option" key={key} disabled={busy !== null} onClick={() => void run(key, params)}>
      <FileText size={15} /><strong>{label}<small>{sub}</small></strong>{busy === key ? <span style={{ fontSize: 11, color: '#7f8d87' }}>Downloading...</span> : <ChevronRight size={14} />}
    </button>)}
    <button className="admin-wide-button" style={{ marginTop: 8 }} onClick={() => onNavigate('admin-home')}>Back to admin home</button>
  </AdminPanel>
}
function AdminPanel({ title, kicker, children }: { title: string; kicker: string; children: ReactNode }) { return <section className="admin-panel"><p className="screen-kicker">{kicker}</p><h1>{title}</h1>{children}</section> }
function AdminInfo({ title, rows }: { title: string; rows: string[] }) { return <div className="admin-info"><h2>{title}</h2>{rows.map((row) => <p key={row}>{row}</p>)}</div> }

type TransactionDraft = { type: 'SALE' | 'TRANSFER'; frameNumber: string; bicycleBrand: string; bicycleModel: string; bicycleColor: string; distinguishingFeatures: string; sellerName: string; sellerNationalId: string; sellerPhone: string; sellerCell: string; sellerSector: string; sellerVillage: string; buyerName: string; buyerNationalId: string; buyerPhone: string; buyerCell: string; buyerSector: string; buyerVillage: string; bicyclePrice: string; serviceFee: string; reason: string }

const emptyTransaction: TransactionDraft = { type: (localStorage.getItem('defaultTxType') as 'SALE' | 'TRANSFER') ?? 'SALE', frameNumber: '', bicycleBrand: '', bicycleModel: '', bicycleColor: '', distinguishingFeatures: '', sellerName: '', sellerNationalId: '', sellerPhone: '', sellerCell: '', sellerSector: '', sellerVillage: '', buyerName: '', buyerNationalId: '', buyerPhone: '', buyerCell: '', buyerSector: '', buyerVillage: '', bicyclePrice: '', serviceFee: '5.00', reason: '' }

function TransactionFlow({ step, setStep, saved, onSave, onCancel, onViewOwner }: { step: number; setStep: (step: number) => void; saved: boolean; onSave: () => void; onCancel: () => void; onViewOwner: (person: PersonRecord) => void }) {
  const [draft, setDraft] = useState<TransactionDraft>(emptyTransaction)
  const [serialChecked, setSerialChecked] = useState(false)
  const [serialFound, setSerialFound] = useState(false)
  const [serialOwner, setSerialOwner] = useState<PersonRecord | null>(null)
  const [serialConfirmed, setSerialConfirmed] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const update = <K extends keyof TransactionDraft>(key: K, value: TransactionDraft[K]) => setDraft((current) => ({ ...current, [key]: value }))
  const verifySerial = async (): Promise<{ found: boolean; owner: PersonRecord | null }> => {
    const normalized = draft.frameNumber.trim()
    if (!normalized) { setSerialChecked(true); setSerialFound(false); setSerialOwner(null); setSerialConfirmed(false); return { found: false, owner: null } }
    setSerialChecked(false)
    let found = false
    let owner: PersonRecord | null = null
    try {
      const result = await api.listBicycles(normalized)
      const match = result.data.find((b) => b.frameNumber.toLowerCase() === normalized.toLowerCase())
      if (match) {
        owner = match.currentOwner ? { id: match.currentOwner.id, name: match.currentOwner.name, nationalId: (match.currentOwner as api.Person).nationalId ?? '', phone: (match.currentOwner as api.Person).phone ?? '', cell: (match.currentOwner as api.Person).cell ?? '', sector: (match.currentOwner as api.Person).sector ?? '', village: (match.currentOwner as api.Person).village ?? '' } : null
        found = true
      }
    } catch {
      // offline — fall back to Dexie cache
      const cachedBicycle = (await db.cachedBicycles.toArray()).find((r) => ((r.data as { frameNumber?: string }).frameNumber ?? '').toLowerCase() === normalized.toLowerCase())
      const cachedOwnerId = cachedBicycle ? (cachedBicycle.data as { currentOwnerId?: string }).currentOwnerId : undefined
      const cachedOwner = cachedOwnerId ? (await db.cachedPeople.get(cachedOwnerId))?.data as PersonRecord | undefined : undefined
      owner = cachedOwner ?? null
      found = Boolean(cachedBicycle)
    }
    setSerialOwner(owner); setSerialFound(found); setSerialConfirmed(false); setSerialChecked(true)
    return { found, owner }
  }
  const total = (Number(draft.bicyclePrice) || 0) + (Number(draft.serviceFee) || 0)
  const saveTransaction = async () => {
    setIsSaving(true)
    const clientOperationId = crypto.randomUUID()
    try {
      const [seller, buyer, bicycle] = await Promise.all([
        draft.sellerNationalId.trim() ? api.upsertPersonByNationalId({ name: draft.sellerName, nationalId: draft.sellerNationalId, phone: draft.sellerPhone, cell: draft.sellerCell, sector: draft.sellerSector, village: draft.sellerVillage }) : Promise.resolve(null),
        api.upsertPersonByNationalId({ name: draft.buyerName, nationalId: draft.buyerNationalId, phone: draft.buyerPhone, cell: draft.buyerCell, sector: draft.buyerSector, village: draft.buyerVillage }),
        api.upsertBicycleByFrameNumber({ frameNumber: draft.frameNumber, brand: draft.bicycleBrand, model: draft.bicycleModel, color: draft.bicycleColor, distinguishingFeatures: draft.distinguishingFeatures }),
      ])
      const payload = {
        type: draft.type, bicycleId: bicycle.id, sellerId: seller?.id, buyerId: buyer.id,
        price: draft.type === 'SALE' ? Number(draft.bicyclePrice) : undefined,
        serviceFee: Number(draft.serviceFee) || undefined, reason: draft.reason || undefined,
      }
      await db.pendingTransactions.put({ id: clientOperationId, payload, createdAt: Date.now() })
    } catch {
      // offline — store _raw natural keys, server resolves IDs on sync
      await db.pendingTransactions.put({
        id: clientOperationId,
        payload: { _raw: { type: draft.type, bicycle: { frameNumber: draft.frameNumber, brand: draft.bicycleBrand, model: draft.bicycleModel, color: draft.bicycleColor, distinguishingFeatures: draft.distinguishingFeatures }, seller: draft.sellerNationalId.trim() ? { name: draft.sellerName, nationalId: draft.sellerNationalId, phone: draft.sellerPhone, cell: draft.sellerCell, sector: draft.sellerSector, village: draft.sellerVillage } : undefined, buyer: { name: draft.buyerName, nationalId: draft.buyerNationalId, phone: draft.buyerPhone, cell: draft.buyerCell, sector: draft.buyerSector, village: draft.buyerVillage }, price: draft.type === 'SALE' ? Number(draft.bicyclePrice) : undefined, serviceFee: Number(draft.serviceFee) || undefined, reason: draft.reason || undefined } },
        createdAt: Date.now(),
      })
    }
    await import('./lib/sync').then(({ flushPendingOperations }) => flushPendingOperations()).catch(() => undefined)
    setIsSaving(false); onSave()
  }
  if (saved) return <Success title="Transaction recorded" copy="The bicycle and transaction are saved locally. They will sync when connectivity returns." onDone={onCancel} />
  const steps = ['Type', 'Serial', 'Bicycle', 'Parties', 'Review', 'Done']
  const next = async () => {
    if (step === 0) { setStep(1); return }
    if (step === 1) {
      if (serialChecked && serialFound && !serialConfirmed) return // duplicate not yet acknowledged
      setStep(serialChecked && serialFound ? 3 : 2)
      return
    }
    if (step === 2) { setStep(3); return }
    if (step === 3) { setStep(4); return }
    if (step === 4) void saveTransaction()
  }
  return <section className="flow-screen"><div className="stepper">{steps.map((label, index) => <span key={label} className={index <= step ? 'current' : ''}><i>{index + 1}</i><small>{label}</small></span>)}</div>
    {step === 0 && <ChoiceStep type={draft.type} onTypeChange={(type) => update('type', type)} />}
    {step === 1 && <SerialStep value={draft.frameNumber} onChange={(value) => update('frameNumber', value)} checked={serialChecked} found={serialFound} owner={serialOwner} confirmed={serialConfirmed} onVerify={verifySerial} onConfirm={() => setSerialConfirmed(true)} onUse={() => setStep(3)} onViewOwner={onViewOwner} />}
    {step === 2 && <BicycleCaptureStep draft={draft} update={update} />}
    {step === 3 && <PartyStep draft={draft} update={update} />}
    {step === 4 && <ReviewStep draft={draft} total={total} onPrint={() => window.print()} />}
    <div className="flow-actions"><button className="quiet-button" onClick={step === 0 ? onCancel : () => setStep(step === 3 && serialFound ? 1 : step - 1)}>Back</button><button className="action-button" disabled={isSaving || (step === 2 && !draft.frameNumber.trim()) || (step === 3 && (!draft.sellerNationalId.trim() || !draft.sellerName.trim() || !draft.sellerPhone.trim() || !draft.buyerNationalId.trim() || !draft.buyerName.trim() || !draft.buyerPhone.trim()))} onClick={() => void next()}>{isSaving ? 'Saving...' : step === 4 ? 'Save transaction' : 'Continue'} <ArrowRight size={15} /></button></div>
  </section>
}

function ChoiceStep({ type, onTypeChange }: { type: TransactionDraft['type']; onTypeChange: (type: TransactionDraft['type']) => void }) { const options: [TransactionDraft['type'], string, string, typeof FileText][] = [['SALE', 'Sell', 'Record a sale and permanent change of ownership', FileText], ['TRANSFER', 'Ownership transfer', 'Transfer ownership without a sale price', MapPin]]; return <div className="flow-body"><h2>Select transaction type</h2><p>Choose the record type for this field operation. Both flows verify the people involved by national ID.</p>{options.map(([value, title, copy, Icon]) => <button className={`choice-card ${type === value ? 'selected-choice' : ''}`} key={value} onClick={() => onTypeChange(value)}><span><Icon size={19} /></span><b>{title}</b><small>{copy}</small><ChevronRight /></button>)}</div> }
function SerialStep({ value, onChange, checked, found, owner, confirmed, onVerify, onConfirm, onUse, onViewOwner }: { value: string; onChange: (value: string) => void; checked: boolean; found: boolean; owner: PersonRecord | null; confirmed: boolean; onVerify: () => void; onConfirm: () => void; onUse: () => void; onViewOwner: (person: PersonRecord) => void }) { return <div className="flow-body"><h2>Verify serial number</h2><p>Check the local database before creating a bicycle record.</p><label>Frame serial number<div className="serial-input"><QrCode size={16} /><input value={value} onChange={(event) => onChange(event.target.value)} placeholder="E.G. AB12345678" /><Smartphone size={16} /></div></label><button className="secondary-button" onClick={() => void onVerify()}><Search size={15} /> Verify database</button>{checked && found && <div className="duplicate-warning"><ShieldAlert size={17} /><span><strong>Duplicate bicycle found</strong><small>This serial is already linked to an owner. Resolve the issue before continuing.</small>{owner && <><button className="owner-details-link" onClick={() => onViewOwner(owner)}>View owner details <ArrowRight size={12} /></button><div className="owner-details"><b>{owner.name}</b><small>{owner.nationalId} · {owner.phone}</small><small>{owner.sector} · {owner.village}</small></div></>}</span><div className="duplicate-actions">{confirmed ? <Check className="confirmation-check" size={17} /> : <button className="confirm-warning" onClick={onConfirm}>Issue resolved</button>}<button className="use-bicycle-btn" onClick={onUse}>Use this bicycle <ArrowRight size={12} /></button></div></div>}{checked && !found && <div className="verification-result not-found"><Check size={15} /><span><strong>Serial available</strong><small>No bicycle record was found. Continue to capture the bicycle.</small></span></div>}<p className="section-label">Common serial locations</p><div className="location-grid"><span>Bottom bracket<b>Under pedals</b></span><span>Head tube<b>Front of frame</b></span><span>Seat tube<b>Near saddle</b></span><span>Rear dropout<b>Back wheel hub</b></span></div></div> }
function BicycleCaptureStep({ draft, update }: { draft: TransactionDraft; update: <K extends keyof TransactionDraft>(key: K, value: TransactionDraft[K]) => void }) {
  const [serialLocked, setSerialLocked] = useState(!!draft.frameNumber)
  return <div className="flow-body"><h2>Record the bicycle</h2><p>Capture the bicycle details before recording the parties.</p>{serialLocked ? <div className="capture-summary"><span>Frame serial<strong>{draft.frameNumber}</strong></span><span className="not-found-label">New bicycle record</span></div> : <label>Frame serial number<div className="serial-input"><QrCode size={16} /><input value={draft.frameNumber} onChange={(event) => update('frameNumber', event.target.value)} onBlur={() => { if (draft.frameNumber.trim()) setSerialLocked(true) }} placeholder="E.G. AB12345678" /></div></label>}<div className="two-fields"><label>Brand<input value={draft.bicycleBrand} onChange={(event) => update('bicycleBrand', event.target.value)} placeholder="e.g. Trek" /></label><label>Model<input value={draft.bicycleModel} onChange={(event) => update('bicycleModel', event.target.value)} placeholder="e.g. Marlin 7" /></label></div><div className="two-fields"><label>Color<input value={draft.bicycleColor} onChange={(event) => update('bicycleColor', event.target.value)} placeholder="e.g. black" /></label><label>Photo reference<input placeholder="Optional photo ID" /></label></div><label>Distinguishing features<textarea value={draft.distinguishingFeatures} onChange={(event) => update('distinguishingFeatures', event.target.value)} placeholder="Scratches, markings, accessories" /></label></div> }
function PartyStep({ draft, update }: { draft: TransactionDraft; update: <K extends keyof TransactionDraft>(key: K, value: TransactionDraft[K]) => void }) { return <div className="flow-body"><h2>Record both parties</h2><p>National ID is the primary identifier. Capture contact and local area details for each participant.</p><PartyFields label="Seller (outbound)" prefix="seller" draft={draft} update={update} /><PartyFields label="Buyer (inbound)" prefix="buyer" draft={draft} update={update} /><label>Reason for transfer or mismatch<textarea value={draft.reason} onChange={(event) => update('reason', event.target.value)} placeholder="Required when seller differs from current owner" /></label><div className="price-fields"><label>Bicycle price<input type="number" min="0" value={draft.bicyclePrice} onChange={(event) => update('bicyclePrice', event.target.value)} placeholder="0.00" /></label><label>Service fee<input type="number" min="0" value={draft.serviceFee} onChange={(event) => update('serviceFee', event.target.value)} /></label></div></div> }
function PartyFields({ label, prefix, draft, update }: { label: string; prefix: 'seller' | 'buyer'; draft: TransactionDraft; update: <K extends keyof TransactionDraft>(key: K, value: TransactionDraft[K]) => void }) {
  const [lookupState, setLookupState] = useState<'idle' | 'checking' | 'found' | 'missing'>('idle')
  const lookup = async () => {
    const nationalId = draft[`${prefix}NationalId`].trim()
    if (!nationalId) return
    setLookupState('checking')
    try {
      const result = await api.listPeople(nationalId)
      const person = result.data.find((p) => p.nationalId.toLowerCase() === nationalId.toLowerCase())
      if (!person) { setLookupState('missing'); return }
      update(`${prefix}Name`, person.name)
      update(`${prefix}NationalId`, person.nationalId)
      update(`${prefix}Phone`, person.phone ?? '')
      update(`${prefix}Cell`, person.cell ?? '')
      update(`${prefix}Sector`, person.sector ?? '')
      update(`${prefix}Village`, person.village ?? '')
      setLookupState('found')
    } catch {
      // offline — fall back to Dexie cache
      const cachedPerson = (await db.cachedPeople.toArray()).map((r) => r.data as PersonRecord).find((p) => p.nationalId?.toLowerCase() === nationalId.toLowerCase())
      if (!cachedPerson) { setLookupState('missing'); return }
      update(`${prefix}Name`, cachedPerson.name)
      update(`${prefix}NationalId`, cachedPerson.nationalId)
      update(`${prefix}Phone`, cachedPerson.phone)
      update(`${prefix}Cell`, cachedPerson.cell)
      update(`${prefix}Sector`, cachedPerson.sector)
      update(`${prefix}Village`, cachedPerson.village)
      setLookupState('found')
    }
  }
  const status = lookupState === 'found' ? <div className="person-link-status found"><Check size={13} /> Existing person linked from database</div> : lookupState === 'missing' ? <div className="person-link-status missing"><UserRound size={13} /> Person not found. Complete the fields to create a new person.</div> : null
  return <fieldset className="party-fieldset"><legend>{label}</legend><div className="person-id-lookup"><label>National ID (16 characters)<input value={draft[`${prefix}NationalId`]} maxLength={16} onChange={(event) => { update(`${prefix}NationalId`, event.target.value); setLookupState('idle') }} placeholder="Enter 16-character national ID" /></label><button className="secondary-button" disabled={lookupState === 'checking' || draft[`${prefix}NationalId`].length !== 16} onClick={() => void lookup()}>{lookupState === 'checking' ? 'Checking...' : 'Look up person'}</button></div>{status}<label>Name<input value={draft[`${prefix}Name`]} readOnly={lookupState === 'found'} onChange={(event) => update(`${prefix}Name`, event.target.value)} placeholder="Full legal name" /></label><div className="two-fields"><label>Phone<input value={draft[`${prefix}Phone`]} readOnly={lookupState === 'found'} onChange={(event) => update(`${prefix}Phone`, event.target.value)} placeholder="Primary phone" /></label><label>Cell<input value={draft[`${prefix}Cell`]} readOnly={lookupState === 'found'} onChange={(event) => update(`${prefix}Cell`, event.target.value)} placeholder="Cell number" /></label></div><div className="two-fields"><label>Sector<input value={draft[`${prefix}Sector`]} readOnly={lookupState === 'found'} onChange={(event) => update(`${prefix}Sector`, event.target.value)} placeholder="Sector" /></label><label>Village<input value={draft[`${prefix}Village`]} readOnly={lookupState === 'found'} onChange={(event) => update(`${prefix}Village`, event.target.value)} placeholder="Village" /></label></div></fieldset>
}
function ReviewStep({ draft, total, onPrint }: { draft: TransactionDraft; total: number; onPrint: () => void }) { return <div className="flow-body"><h2>Review transaction</h2><p>Check the record before saving. The PDF is formatted for printing and contains the transaction summary.</p><div className="review-summary"><span>Transaction type<strong>{draft.type === 'SALE' ? 'Ownership transfer / sale' : 'Ownership transfer'}</strong></span><span>Bicycle<strong>{draft.bicycleBrand || 'New'} {draft.bicycleModel || 'record'} · {draft.frameNumber || 'No serial'}</strong></span><span>Seller and buyer<strong>{draft.sellerName || 'Seller pending'} → {draft.buyerName || 'Buyer pending'}</strong></span><span>Amounts<strong>Bicycle {draft.bicyclePrice || '0.00'} + service {draft.serviceFee || '0.00'} = {total.toFixed(2)}</strong></span></div><button className="secondary-button print-button" onClick={onPrint}><FileText size={15} /> Preview / print transaction PDF</button><div className="audit-note"><ShieldCheck size={15} /> This action will be added to the audit log.</div></div> }

type RegistrationDraft = { frameNumber: string; brand: string; model: string; color: string; features: string; person: PersonRecord | null }
type RegistrationPhase = 'serial' | 'bicycle' | 'person-search' | 'person-new' | 'review'

function RegisterScreen({ saved, onSave, onCancel, onViewOwner }: { saved: boolean; onSave: () => void; onCancel: () => void; onViewOwner: (person: PersonRecord) => void }) {
  const [phase, setPhase] = useState<RegistrationPhase>('serial')
  const [draft, setDraft] = useState<RegistrationDraft>({ frameNumber: '', brand: '', model: '', color: '', features: '', person: null })
  const [serialOwner, setSerialOwner] = useState<PersonRecord | null>(null)
  const [serialConfirmed, setSerialConfirmed] = useState(false)
  const [serialChecked, setSerialChecked] = useState(false)
  const [personQuery, setPersonQuery] = useState('')
  const [personChecked, setPersonChecked] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [serialLocked, setSerialLocked] = useState(false)
  const [newPerson, setNewPerson] = useState({ name: '', nationalId: '', phone: '', cell: '', sector: '', village: '' })
  const updateBicycle = (key: keyof Omit<RegistrationDraft, 'person'>, value: string) => setDraft((current) => ({ ...current, [key]: value }))
  const updatePerson = (key: keyof typeof newPerson, value: string) => setNewPerson((current) => ({ ...current, [key]: value }))
  const verifySerial = async (): Promise<{ owner: PersonRecord | null }> => {
    const normalized = draft.frameNumber.trim()
    if (!normalized) { setSerialChecked(true); setSerialOwner(null); setSerialConfirmed(false); return { owner: null } }
    setSerialChecked(false)
    let owner: PersonRecord | null = null
    try {
      const result = await api.listBicycles(normalized)
      const match = result.data.find((b) => b.frameNumber.toLowerCase() === normalized.toLowerCase())
      owner = match?.currentOwner ? { id: match.currentOwner.id, name: match.currentOwner.name, nationalId: (match.currentOwner as api.Person).nationalId ?? '', phone: (match.currentOwner as api.Person).phone ?? '', cell: (match.currentOwner as api.Person).cell ?? '', sector: (match.currentOwner as api.Person).sector ?? '', village: (match.currentOwner as api.Person).village ?? '' } : null
    } catch {
      const cachedBicycle = (await db.cachedBicycles.toArray()).find((r) => ((r.data as { frameNumber?: string }).frameNumber ?? '').toLowerCase() === normalized.toLowerCase())
      const cachedOwnerId = cachedBicycle ? (cachedBicycle.data as { currentOwnerId?: string }).currentOwnerId : undefined
      const cachedOwner = cachedOwnerId ? (await db.cachedPeople.get(cachedOwnerId))?.data as PersonRecord | undefined : undefined
      owner = cachedOwner ?? null
    }
    setSerialOwner(owner); setSerialConfirmed(false); setSerialChecked(true)
    return { owner }
  }
  const findPerson = async () => {
    setPersonChecked(true)
    try {
      const result = await api.listPeople(personQuery.trim())
      const match = result.data[0] ?? null
      if (match) setDraft((current) => ({ ...current, person: { id: match.id, name: match.name, nationalId: match.nationalId, phone: match.phone ?? '', cell: match.cell ?? '', sector: match.sector ?? '', village: match.village ?? '' } }))
      else setDraft((current) => ({ ...current, person: null }))
    } catch {
      setDraft((current) => ({ ...current, person: null }))
    }
  }
  const saveRegistration = async () => {
    if (!draft.person) return
    setIsSaving(true)
    const clientOperationId = crypto.randomUUID()
    try {
      const [person, bicycle] = await Promise.all([
        api.upsertPersonByNationalId({ name: draft.person.name, nationalId: draft.person.nationalId, phone: draft.person.phone, cell: draft.person.cell, sector: draft.person.sector, village: draft.person.village }),
        api.upsertBicycleByFrameNumber({ frameNumber: draft.frameNumber, brand: draft.brand, model: draft.model, color: draft.color, distinguishingFeatures: draft.features }),
      ])
      await db.pendingRegistrations.put({ id: clientOperationId, payload: { bicycleId: bicycle.id, ownerId: person.id }, createdAt: Date.now() })
    } catch {
      // offline — store _raw natural keys, server resolves IDs on sync
      await db.pendingRegistrations.put({
        id: clientOperationId,
        payload: { _raw: { bicycle: { frameNumber: draft.frameNumber, brand: draft.brand, model: draft.model, color: draft.color, distinguishingFeatures: draft.features }, person: { name: draft.person.name, nationalId: draft.person.nationalId, phone: draft.person.phone, cell: draft.person.cell, sector: draft.person.sector, village: draft.person.village } } },
        createdAt: Date.now(),
      })
    }
    await import('./lib/sync').then(({ flushPendingOperations }) => flushPendingOperations()).catch(() => undefined)
    setIsSaving(false); onSave()
  }
  if (saved) return <Success title="Bicycle registered" copy="The bicycle and linked owner are saved locally and ready for sync." onDone={onCancel} />
  const steps = ['Serial', 'Bicycle', 'Person', 'Review', 'Done']
  const person = draft.person
  return <section className="flow-screen"><div className="stepper">{steps.map((label, index) => <span key={label} className={index <= (phase === 'serial' ? 0 : phase === 'bicycle' ? 1 : phase === 'person-search' || phase === 'person-new' ? 2 : 3) ? 'current' : ''}><i>{index + 1}</i><small>{label}</small></span>)}</div>
    {phase === 'serial' && <div className="flow-body"><h2>Verify bicycle serial</h2><p>Check the database before creating a registration. A bicycle serial can only be registered once.</p><label>Frame serial number<div className="serial-input"><QrCode size={16} /><input value={draft.frameNumber} onChange={(event) => { updateBicycle('frameNumber', event.target.value); setSerialChecked(false); setSerialOwner(null); setSerialConfirmed(false) }} placeholder="E.G. ABT-2024-00918" /><Smartphone size={16} /></div></label><button className="secondary-button" onClick={() => void verifySerial()}><Search size={15} /> Check bicycle database</button>{serialChecked && serialOwner && <div className="duplicate-warning"><ShieldAlert size={17} /><span><strong>Serial already registered</strong><small>This bicycle is linked to {serialOwner.name}. Resolve this issue before continuing.</small><button className="owner-details-link" onClick={() => onViewOwner(serialOwner)}>View owner details <ArrowRight size={12} /></button><div className="owner-details"><b>{serialOwner.name}</b><small>{serialOwner.nationalId} · {serialOwner.phone}</small><small>{serialOwner.sector} · {serialOwner.village}</small></div></span><div className="duplicate-actions">{serialConfirmed ? <Check className="confirmation-check" size={17} /> : <button className="confirm-warning" onClick={() => setSerialConfirmed(true)}>Issue resolved</button>}<button className="use-bicycle-btn" onClick={() => setPhase('person-search')}>Use this bicycle <ArrowRight size={12} /></button></div></div>}{serialChecked && !serialOwner && <div className="verification-result not-found"><Check size={15} /><span><strong>Serial available</strong><small>No bicycle record was found. Continue to capture the bicycle.</small></span></div>}</div>}
    {phase === 'bicycle' && <div className="flow-body"><h2>Record bicycle details</h2><p>Capture the bicycle before linking its current owner.</p>{serialLocked ? <div className="capture-summary"><span>Frame serial<strong>{draft.frameNumber}</strong></span><span className="not-found-label">Available to register</span></div> : <label>Frame serial number<div className="serial-input"><QrCode size={16} /><input value={draft.frameNumber} onChange={(event) => updateBicycle('frameNumber', event.target.value)} onBlur={() => { if (draft.frameNumber.trim()) setSerialLocked(true) }} placeholder="E.G. ABT-2024-00918" /></div></label>}<div className="two-fields"><label>Brand<input value={draft.brand} onChange={(event) => updateBicycle('brand', event.target.value)} placeholder="e.g. Trek" /></label><label>Model<input value={draft.model} onChange={(event) => updateBicycle('model', event.target.value)} placeholder="e.g. Marlin 7" /></label></div><div className="two-fields"><label>Color<input value={draft.color} onChange={(event) => updateBicycle('color', event.target.value)} placeholder="e.g. black" /></label><label>Photo reference<input placeholder="Optional photo ID" /></label></div><label>Distinguishing features<textarea value={draft.features} onChange={(event) => updateBicycle('features', event.target.value)} placeholder="Scratches, markings, accessories" /></label></div>}
    {phase === 'person-search' && <div className="flow-body"><h2>Find current owner</h2><p>Search by name or national ID. National ID is the primary person identifier.</p><label>Name or national ID<div className="search-field"><Search size={15} /><input value={personQuery} onChange={(event) => setPersonQuery(event.target.value)} placeholder="Search person in database" /></div></label><button className="secondary-button" onClick={findPerson}><Search size={15} /> Find person</button>{personChecked && person && <div className="person-found"><Check size={16} /><span><strong>{person.name}</strong><small>{person.nationalId} · {person.phone}</small><small>{person.sector} · {person.village}</small></span></div>}{personChecked && !person && <div className="person-not-found"><UserRound size={16} /><span><strong>Person not found</strong><small>No person matches this search. Add the owner to the database.</small></span><button onClick={() => setPhase('person-new')}>Add new person <ArrowRight size={14} /></button></div>}</div>}
    {phase === 'person-new' && <div className="flow-body"><h2>Add person to database</h2><p>Create the owner record first, then it will be linked to this bicycle registration.</p><label>Full name<input value={newPerson.name} onChange={(event) => updatePerson('name', event.target.value)} placeholder="Full legal name" /></label><label>National ID (16 characters)<input value={newPerson.nationalId} maxLength={16} onChange={(event) => updatePerson('nationalId', event.target.value)} placeholder="Enter 16-character national ID" /></label><div className="two-fields"><label>Phone<input value={newPerson.phone} onChange={(event) => updatePerson('phone', event.target.value)} placeholder="Primary phone" /></label><label>Cell<input value={newPerson.cell} onChange={(event) => updatePerson('cell', event.target.value)} placeholder="Cell number" /></label></div><div className="two-fields"><label>Sector<input value={newPerson.sector} onChange={(event) => updatePerson('sector', event.target.value)} placeholder="Sector" /></label><label>Village<input value={newPerson.village} onChange={(event) => updatePerson('village', event.target.value)} placeholder="Village" /></label></div></div>}
    {phase === 'review' && <div className="flow-body"><h2>Review registration</h2><p>Confirm the bicycle and its linked current owner before saving.</p><div className="review-summary"><span>Bicycle<strong>{draft.brand || 'New'} {draft.model || 'bicycle'} · {draft.frameNumber}</strong></span><span>Owner<strong>{person?.name}</strong></span><span>National ID<strong>{person?.nationalId}</strong></span><span>Location<strong>{person?.sector} · {person?.village}</strong></span></div><div className="audit-note"><ShieldCheck size={15} /> Registration and owner link will be audited.</div></div>}
    <div className="flow-actions"><button className="quiet-button" onClick={phase === 'serial' ? onCancel : () => setPhase(phase === 'person-new' ? 'person-search' : phase === 'review' ? 'person-search' : phase === 'person-search' ? 'bicycle' : 'serial')}>Back</button><button className="action-button" disabled={(phase === 'person-search' && !person) || (phase === 'person-new' && (!newPerson.name || newPerson.nationalId.length !== 16)) || (isSaving && phase !== 'serial')} onClick={() => void (async () => {
      if (phase === 'serial') {
        if (serialChecked && serialOwner && !serialConfirmed) return // duplicate not yet acknowledged
        setSerialLocked(!!draft.frameNumber.trim())
        setPhase(serialChecked && serialOwner ? 'person-search' : 'bicycle')
      } else if (phase === 'bicycle') setPhase('person-search')
      else if (phase === 'person-search') setPhase('review')
      else if (phase === 'person-new') { setDraft((current) => ({ ...current, person: { id: `person-${newPerson.nationalId}`, ...newPerson } })); setPhase('review') }
      else void saveRegistration()
    })()}>{isSaving ? 'Saving...' : phase === 'review' ? 'Save registration' : 'Continue'} <ArrowRight size={15} /></button></div>
  </section>
}
function Success({ title, copy, onDone }: { title: string; copy: string; onDone: () => void }) {
  const online = navigator.onLine
  return <div className="success-screen"><span><Check size={28} /></span><h2>{title}</h2><p>{online ? 'Recorded successfully.' : copy}</p><button className="action-button" onClick={onDone}>Return to dashboard <Home size={15} /></button></div>
}

function SearchScreen({ query, setQuery, onSelect }: { query: string; setQuery: (query: string) => void; onSelect: (record: BicycleRecord) => void }) {
  type DateFilter = 'last30' | 'specific' | 'range' | 'all'
  const [dateFilter, setDateFilter] = useState<DateFilter>('last30')
  const [specificDate, setSpecificDate] = useState('')
  const [rangeFrom, setRangeFrom] = useState('')
  const [rangeTo, setRangeTo] = useState('')
  const { from, to } = (() => {
    if (dateFilter === 'last30') { const d = new Date(); d.setDate(d.getDate() - 30); return { from: d.toISOString(), to: undefined } }
    if (dateFilter === 'specific' && specificDate) { const d = new Date(specificDate); const next = new Date(d); next.setDate(d.getDate() + 1); return { from: d.toISOString(), to: next.toISOString() } }
    if (dateFilter === 'range') return { from: rangeFrom ? new Date(rangeFrom).toISOString() : undefined, to: rangeTo ? new Date(rangeTo).toISOString() : undefined }
    return { from: undefined, to: undefined }
  })()
  const { data, isLoading, isFetchingNextPage, fetchNextPage, hasNextPage } = useInfiniteQuery({
    queryKey: ['bicycles', query, dateFilter, specificDate, rangeFrom, rangeTo],
    queryFn: ({ pageParam = 1 }) => api.listBicycles(query || undefined, pageParam as number, from, to),
    getNextPageParam: (lastPage, pages) => lastPage.data.length >= 5 ? pages.length + 1 : undefined,
    initialPageParam: 1,
  })
  const bicycles = data?.pages.flatMap((p) => p.data) ?? []
  const toRecord = (b: api.Bicycle): BicycleRecord => ({ id: b.id, frameNumber: b.frameNumber, name: `${b.brand ?? ''} ${b.model ?? ''}`.trim() || b.frameNumber, type: 'Bicycle', color: b.color ?? '—', owner: b.currentOwner?.name ?? '—', location: '—', status: b.status === 'ACTIVE' ? 'Verified' : 'Needs review', date: '' })
  return <section className="search-screen">
    <div className="search-field"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search Name, Frame, or Brand..." /></div>
    <div className="admin-filters">{(['last30', 'specific', 'range', 'all'] as DateFilter[]).map((f) => <button key={f} className={dateFilter === f ? 'selected' : ''} onClick={() => setDateFilter(f)}>{f === 'last30' ? 'Last 30 days' : f === 'specific' ? 'Specific date' : f === 'range' ? 'Date range' : 'All time'}</button>)}</div>
    {dateFilter === 'specific' && <div className="date-inputs"><input type="date" value={specificDate} onChange={(e) => setSpecificDate(e.target.value)} /></div>}
    {dateFilter === 'range' && <div className="date-inputs"><input type="date" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} /><input type="date" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} /></div>}
    <p className="result-count">Results: {bicycles.length} found</p>
    {isLoading && <p className="empty-state">Loading...</p>}
    {bicycles.map((b) => { const record = toRecord(b); return <button className="search-record" key={b.id} onClick={() => onSelect(record)}><span className="record-image"><Bike size={28} /></span><span><strong>{record.name}</strong><small>{record.type} · {record.color}</small><small>⌕ {record.frameNumber}</small><em className={record.status === 'Verified' ? 'verified' : 'flagged'}>{record.status}</em></span><ChevronRight size={16} /></button>})}
    {!isLoading && bicycles.length === 0 && <p className="empty-state">No records found.</p>}
    {hasNextPage && <button className="secondary-button load-button" disabled={isFetchingNextPage} onClick={() => void fetchNextPage()}><Cloud size={14} /> {isFetchingNextPage ? 'Loading...' : 'Load more'}</button>}
  </section>
}

function PersonExpandable({ person }: { person: api.PersonSummary & { nationalId?: string } }) {
  const [open, setOpen] = useState(false)
  return <div className="person-expandable">
    <button className="person-expand-btn" onClick={() => setOpen((v) => !v)}>{open ? 'View less' : 'View more'} <ChevronRight size={13} style={{ transform: open ? 'rotate(90deg)' : undefined }} /></button>
    {open && <dl className="person-expand-details">
      {person.nationalId && <><dt>National ID</dt><dd>{person.nationalId}</dd></>}
      {person.phone && <><dt>Phone</dt><dd>{person.phone}</dd></>}
      {person.cell && <><dt>Cell</dt><dd>{person.cell}</dd></>}
      {person.sector && <><dt>Sector</dt><dd>{person.sector}</dd></>}
      {person.village && <><dt>Village</dt><dd>{person.village}</dd></>}
    </dl>}
  </div>
}

function DetailsScreen({ record }: { record: BicycleRecord }) {
  const { data: bikeData, isLoading } = useQuery({ queryKey: ['bicycle', record.id], queryFn: () => api.getBicycle(record.id) })
  const { data: txData } = useQuery({ queryKey: ['transactions', record.frameNumber], queryFn: () => api.listTransactions({ q: record.frameNumber }), enabled: !!record.id })
  const { data: regData } = useQuery({ queryKey: ['registrations', record.id], queryFn: () => api.listRegistrations({ bicycleId: record.id }), enabled: !!record.id })
  const bike = bikeData?.data
  const lastTx = txData?.data?.[0]
  const registration = regData?.data?.[0]
  return <section className="details-screen">
    <div className="detail-heading"><span><small>Frame serial</small><strong>{record.frameNumber}</strong></span><em className={record.status === 'Verified' ? 'verified' : 'flagged'}>◉ {record.status}</em></div>
    {isLoading && <p className="empty-state">Loading...</p>}
    <div className="asset-card"><div className="asset-image"><Bike size={52} /><span>Bicycle asset</span></div><div><small>Brand / Model</small><strong>{bike?.brand ?? '—'} {bike?.model ?? ''}</strong></div><div><small>Frame color</small><strong>{bike?.color ?? record.color}</strong></div><div><small>Current owner</small><strong>{bike?.currentOwner?.name ?? record.owner}</strong></div></div>
    {lastTx && <><p className="detail-date"><CalendarDays size={13} /> {new Date(lastTx.transactionDate).toLocaleString()}</p><div className="parties-card"><h2><ArrowRight size={15} /> Last transaction · {lastTx.transactionId}</h2>
      <div><small>Seller (outbound)</small><strong>{lastTx.seller?.name ?? '—'}</strong>{lastTx.seller && <PersonExpandable person={lastTx.seller} />}</div>
      <div><small>Buyer (inbound)</small><strong>{lastTx.buyer?.name ?? '—'}</strong>{lastTx.buyer && <PersonExpandable person={lastTx.buyer} />}</div>
      <div><small>Recorded by</small><strong>{lastTx.recordingAgent.name}</strong></div></div></> }
    {!lastTx && registration && <><p className="detail-date"><CalendarDays size={13} /> Registered {new Date(registration.createdAt).toLocaleString()}</p><div className="parties-card"><h2><Bike size={15} /> Registration record</h2>
      <div><small>Owner</small><strong>{registration.owner.name}</strong><PersonExpandable person={registration.owner} /></div>
      <div><small>Recorded by</small><strong>{registration.recordingAgent.name}</strong></div></div></> }
    <div className="location-card"><MapPin size={17} /><span><small>Status</small><strong>{bike?.status ?? '—'}</strong></span></div>
    <button className="action-button export-button" onClick={() => {
      const w = window.open('', '_blank')
      if (!w) return
      w.document.write(`<!DOCTYPE html><html><head><title>Record – ${record.frameNumber}</title><style>body{font-family:monospace;padding:32px;color:#111}h1{font-size:18px;margin-bottom:4px}p{margin:4px 0;font-size:13px}.row{display:flex;gap:16px;margin:4px 0}.label{color:#666;font-size:11px;text-transform:uppercase;min-width:120px}hr{margin:16px 0;border:none;border-top:1px solid #ccc}@media print{body{padding:16px}}</style></head><body><h1>Certified Bicycle Record</h1><p style="color:#666;font-size:11px">Generated ${new Date().toLocaleString()}</p><hr/><div class="row"><span class="label">Frame Serial</span><strong>${record.frameNumber}</strong></div><div class="row"><span class="label">Bicycle</span><span>${record.name}</span></div><div class="row"><span class="label">Color</span><span>${record.color}</span></div><div class="row"><span class="label">Current Owner</span><span>${record.owner}</span></div><div class="row"><span class="label">Status</span><span>${record.status}</span></div>${bike ? `<div class="row"><span class="label">Brand / Model</span><span>${bike.brand ?? '—'} ${bike.model ?? ''}</span></div>` : ''}${lastTx ? `<hr/><h2 style="font-size:14px">Last Transaction · ${lastTx.transactionId}</h2><div class="row"><span class="label">Date</span><span>${new Date(lastTx.transactionDate).toLocaleString()}</span></div><div class="row"><span class="label">Type</span><span>${lastTx.type}</span></div><div class="row"><span class="label">Seller</span><span>${lastTx.seller?.name ?? '—'}</span></div><div class="row"><span class="label">Buyer</span><span>${lastTx.buyer?.name ?? '—'}</span></div><div class="row"><span class="label">Recorded by</span><span>${lastTx.recordingAgent.name}</span></div>` : ''}${registration ? `<hr/><h2 style="font-size:14px">Registration</h2><div class="row"><span class="label">Date</span><span>${new Date(registration.createdAt).toLocaleString()}</span></div><div class="row"><span class="label">Owner</span><span>${registration.owner.name}</span></div><div class="row"><span class="label">Recorded by</span><span>${registration.recordingAgent.name}</span></div>` : ''}<hr/><p style="font-size:10px;color:#999">AbatCO Bicycle Records — certified field record</p></body></html>`)
      w.document.close()
      w.focus()
      setTimeout(() => { w.print(); w.close() }, 300)
    }}><Send size={14} /> Export certified record (PDF)</button>
  </section>
}

function ActivityScreen({ onOpenDetails, onSelectTransaction }: { onOpenDetails: (id: string, frameNumber: string) => void; onSelectTransaction: (id: string) => void }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [filter, setFilter] = useState<'all' | 'registration' | 'transfer' | 'sale'>('all')
  const [offlineItems, setOfflineItems] = useState<{ key: string; date: number; label: string; sub1: string }[]>([])
  useEffect(() => {
    const on = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  useEffect(() => {
    if (isOnline) return
    Promise.all([db.pendingTransactions.orderBy('createdAt').reverse().toArray(), db.pendingRegistrations.orderBy('createdAt').reverse().toArray()]).then(([txs, regs]) => {
      setOfflineItems([
        ...txs.map((r) => { const p = r.payload as { type?: string; _raw?: { type?: string; bicycle?: { frameNumber?: string } } }; const type = p._raw?.type ?? p.type ?? 'TRANSACTION'; const frame = (p as { frameNumber?: string }).frameNumber ?? p._raw?.bicycle?.frameNumber ?? '—'; return { key: r.id, date: r.createdAt, label: `Pending ${type}: ${frame}`, sub1: 'Queued offline — awaiting sync' } }),
        ...regs.map((r) => { const p = r.payload as { _raw?: { bicycle?: { frameNumber?: string } }; bicycleId?: string }; const frame = p._raw?.bicycle?.frameNumber ?? p.bicycleId ?? '—'; return { key: r.id, date: r.createdAt, label: `Pending registration: ${frame}`, sub1: 'Queued offline — awaiting sync' } }),
      ].sort((a, b) => b.date - a.date))
    })
  }, [isOnline])
  const { data: txData, isLoading: txLoading, fetchNextPage: txNext, hasNextPage: txHasMore, isFetchingNextPage: txFetching } = useInfiniteQuery({ queryKey: ['transactions-activity'], queryFn: ({ pageParam = 1 }) => api.listTransactions({ page: pageParam as number }), getNextPageParam: (last, pages) => last.data.length >= 5 ? pages.length + 1 : undefined, initialPageParam: 1, enabled: isOnline })
  const { data: regData, isLoading: regLoading, fetchNextPage: regNext, hasNextPage: regHasMore, isFetchingNextPage: regFetching } = useInfiniteQuery({ queryKey: ['registrations-activity'], queryFn: ({ pageParam = 1 }) => api.listRegistrations({ page: pageParam as number }), getNextPageParam: (last, pages) => last.data.length >= 5 ? pages.length + 1 : undefined, initialPageParam: 1, enabled: isOnline })
  const loading = isOnline && (txLoading || regLoading)
  type ActivityItem = { key: string; date: string; label: string; sub1: string; sub2: string; kind: 'registration' | 'sale' | 'transfer'; onPress: () => void }
  const allItems: ActivityItem[] = [
    ...(txData?.pages.flatMap((p) => p.data) ?? []).map((t) => ({ key: t.id, date: t.transactionDate, kind: (t.type === 'SALE' ? 'sale' : 'transfer') as 'sale' | 'transfer', label: `${t.type === 'SALE' ? 'Sale' : 'Transfer'}: ${t.bicycle.brand ?? ''} ${t.bicycle.model ?? ''}`.trim(), sub1: `${t.seller?.name ?? '—'} → ${t.buyer?.name ?? '—'}`, sub2: `# ${t.transactionId} · ${new Date(t.transactionDate).toLocaleString()}`, onPress: () => onSelectTransaction(t.id) })),
    ...(regData?.pages.flatMap((p) => p.data) ?? []).map((r) => ({ key: r.id, date: r.createdAt, kind: 'registration' as const, label: `Registered: ${r.bicycle.brand ?? ''} ${r.bicycle.model ?? ''}`.trim(), sub1: `Owner: ${r.owner.name}`, sub2: `# ${r.bicycle.frameNumber} · ${new Date(r.createdAt).toLocaleString()}`, onPress: () => onOpenDetails(r.bicycle.id, r.bicycle.frameNumber) })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  const onlineItems = filter === 'all' ? allItems : allItems.filter((i) => i.kind === filter)
  return <section className="activity-screen">
    <div className="admin-filters" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
      {(['all', 'registration', 'sale', 'transfer'] as const).map((f) => <button key={f} className={filter === f ? 'selected' : ''} onClick={() => setFilter(f)}>{f === 'all' ? 'All' : f === 'registration' ? 'Registered' : f === 'sale' ? 'Sales' : 'Transfers'}</button>)}
    </div>
    <p className="date-divider">▣ Recent Activity</p>
    {!isOnline && <div className="offline-notice"><Database size={13} /> Offline — showing queued operations</div>}
    {loading && <p className="empty-state">Loading...</p>}
    {isOnline && onlineItems.map((item) => <button className="activity-card" key={item.key} onClick={item.onPress}><span className="activity-mark"><ArrowRight size={16} /></span><span><strong>{item.label}</strong><small>{item.sub1}</small><small>{item.sub2}</small></span><ChevronRight size={16} /></button>)}
    {isOnline && (txHasMore || regHasMore) && <button className="secondary-button load-button" disabled={txFetching || regFetching} onClick={() => { if (txHasMore) void txNext(); if (regHasMore) void regNext() }}><Cloud size={14} /> {txFetching || regFetching ? 'Loading...' : 'Load more'}</button>}
    {!isOnline && offlineItems.map((item) => <div className="activity-card" key={item.key}><span className="activity-mark"><Database size={16} /></span><span><strong>{item.label}</strong><small>{item.sub1}</small></span></div>)}
    {!loading && isOnline && onlineItems.length === 0 && <p className="empty-state">No {filter === 'all' ? '' : filter} activity found.</p>}
    {!isOnline && offlineItems.length === 0 && <p className="empty-state">No queued operations.</p>}
  </section>
}


function ProfileScreen({ user, role, fontSize, onChangeFontSize, onLogout }: { user: { id: string; name: string; role: Role } | null; role: Role; fontSize: 'sm' | 'md' | 'lg'; onChangeFontSize: (v: 'sm' | 'md' | 'lg') => void; onLogout: () => void }) {
  const initials = user ? user.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase() : 'MO'
  const isAdmin = role === 'ADMIN'
  const [section, setSection] = useState<'main' | 'password' | 'sync' | 'cache'>('main')
  const back = () => { setSection('main'); setPwDone(false); setPwError(null); setSyncResult(null); setClearDone(false) }
  // Change password
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwDone, setPwDone] = useState(false)
  const [pwBusy, setPwBusy] = useState(false)
  const submitPassword = async () => {
    if (pwForm.next !== pwForm.confirm) { setPwError('Passwords do not match'); return }
    if (pwForm.next.length < 12) { setPwError('New password must be at least 12 characters'); return }
    setPwBusy(true); setPwError(null)
    try { await api.changePassword(pwForm.current, pwForm.next); setPwDone(true); setPwForm({ current: '', next: '', confirm: '' }) }
    catch { setPwError('Current password is incorrect') }
    finally { setPwBusy(false) }
  }
  // Sync
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)
  const [pendingCount, setPendingCount] = useState<number | null>(null)
  useEffect(() => {
    if (section !== 'sync') return
    Promise.all([db.pendingTransactions.toArray(), db.pendingRegistrations.toArray(), db.syncMetadata.toArray()]).then(([txs, regs, meta]) => {
      const blocked = new Set(meta.map((m) => m.key.replace(/^(conflict|error):/, '')))
      setPendingCount([...txs, ...regs].filter((r) => !blocked.has(r.id)).length)
    })
  }, [section])
  const forceSync = async () => {
    setSyncing(true); setSyncResult(null)
    try {
      const { flushPendingOperations } = await import('./lib/sync')
      const s = await flushPendingOperations()
      setSyncResult(`Synced ${s.synced} · Conflicts ${s.conflicts} · Errors ${s.failed + s.validationErrors}`)
      setPendingCount(0)
    } catch { setSyncResult('Sync failed. Check connectivity.') }
    finally { setSyncing(false) }
  }
  // Clear cache
  const [clearing, setClearing] = useState(false)
  const [clearDone, setClearDone] = useState(false)
  const clearCache = async () => {
    setClearing(true)
    await Promise.all([db.cachedBicycles.clear(), db.cachedPeople.clear()])
    setClearing(false); setClearDone(true)
  }
  // Default transaction type
  const [defaultTxType, setDefaultTxType] = useState<'SALE' | 'TRANSFER'>(() => (localStorage.getItem('defaultTxType') as 'SALE' | 'TRANSFER') ?? 'SALE')
  const toggleDefaultTxType = (v: 'SALE' | 'TRANSFER') => { setDefaultTxType(v); localStorage.setItem('defaultTxType', v) }
  const toggleFontSize = (v: 'sm' | 'md' | 'lg') => onChangeFontSize(v)

  if (section === 'password') return <section className="admin-panel">
    <p className="screen-kicker">SETTINGS</p><h1>Change Password</h1>
    {pwDone ? <p style={{ color: '#4caf7d', margin: '12px 0' }}><Check size={14} /> Password changed successfully.</p> : <>
      <label>Current password<input type="password" value={pwForm.current} onChange={(e) => setPwForm((f) => ({ ...f, current: e.target.value }))} /></label>
      <label>New password (min 12)<input type="password" value={pwForm.next} onChange={(e) => setPwForm((f) => ({ ...f, next: e.target.value }))} /></label>
      <label>Confirm new password<input type="password" value={pwForm.confirm} onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))} /></label>
      {pwError && <p style={{ color: '#e05', fontSize: 13, margin: '4px 0' }}>{pwError}</p>}
      <button className="action-button" style={{ marginTop: 8 }} disabled={pwBusy || !pwForm.current || !pwForm.next || !pwForm.confirm} onClick={() => void submitPassword()}>{pwBusy ? 'Saving...' : 'Update password'}</button>
    </> }
    <button className="quiet-button" style={{ marginTop: 12 }} onClick={back}>Back to settings</button>
  </section>

  if (section === 'sync') return <section className="admin-panel">
    <p className="screen-kicker">SETTINGS</p><h1>Sync Status</h1>
    <p style={{ margin: '8px 0 4px', fontSize: 13 }}>Pending operations: <strong>{pendingCount ?? '…'}</strong></p>
    <p style={{ fontSize: 12, color: '#7f8d87', marginBottom: 12 }}>Operations queued offline that haven't synced yet.</p>
    {syncResult && <p style={{ fontSize: 13, margin: '4px 0 8px', color: '#4caf7d' }}>{syncResult}</p>}
    <button className="action-button" disabled={syncing || !navigator.onLine} onClick={() => void forceSync()}>{syncing ? 'Syncing...' : 'Sync now'}</button>
    {!navigator.onLine && <p style={{ fontSize: 12, color: '#e05', marginTop: 6 }}>You are offline.</p>}
    <SyncErrorList />
    <button className="quiet-button" style={{ marginTop: 12 }} onClick={back}>Back to settings</button>
  </section>

  if (section === 'cache') return <section className="admin-panel">
    <p className="screen-kicker">SETTINGS</p><h1>Clear Local Cache</h1>
    <p style={{ fontSize: 13, margin: '8px 0 4px' }}>Clears locally cached bicycle and people records.</p>
    <p style={{ fontSize: 12, color: '#7f8d87', marginBottom: 12 }}>Use this if you suspect stale data. Pending operations are not affected.</p>
    {clearDone ? <p style={{ color: '#4caf7d', fontSize: 13 }}><Check size={14} /> Cache cleared.</p> : <button className="action-button" disabled={clearing} onClick={() => void clearCache()}>{clearing ? 'Clearing...' : 'Clear cache'}</button>}
    <button className="quiet-button" style={{ marginTop: 12 }} onClick={back}>Back to settings</button>
  </section>

  return <section className="admin-panel">
    <p className="screen-kicker">{isAdmin ? 'ADMINISTRATOR' : 'FIELD AGENT'}</p>
    <h1>Profile & Settings</h1>
    <div className="owner-modal-identity" style={{ marginBottom: 16 }}><span className="profile-avatar">{initials}</span><span><strong>{user?.name ?? mockUser.name}</strong><small>{isAdmin ? 'Administrator' : 'Field Agent'} · {user?.role ?? mockUser.role}</small></span></div>
    <button className="settings-row" onClick={() => setSection('password')}><LockKeyhole size={17} /> Change password <ChevronRight size={15} /></button>
    <button className="settings-row" onClick={() => setSection('sync')}><Cloud size={17} /> Sync status <ChevronRight size={15} /></button>
    <button className="settings-row" onClick={() => setSection('cache')}><Database size={17} /> Clear local cache <ChevronRight size={15} /></button>
    <div className="settings-row" style={{ cursor: 'default' }}>
      <Type size={17} /> Text size
      <span style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
        {(['sm', 'md', 'lg'] as const).map((v) => <button key={v} onClick={() => toggleFontSize(v)} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: fontSize === v ? 'var(--accent, #4caf7d)' : 'transparent', border: '1px solid currentColor', cursor: 'pointer' }}>{v.toUpperCase()}</button>)}
      </span>
    </div>
    <div className="settings-row" style={{ cursor: 'default' }}>
      <FileText size={17} /> Default transaction type
      <span style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
        {(['SALE', 'TRANSFER'] as const).map((v) => <button key={v} onClick={() => toggleDefaultTxType(v)} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: defaultTxType === v ? 'var(--accent, #4caf7d)' : 'transparent', border: '1px solid currentColor', cursor: 'pointer' }}>{v}</button>)}
      </span>
    </div>
    <div className="settings-row" style={{ cursor: 'default', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Signal size={17} /> App info</span>
      <small style={{ paddingLeft: 23, color: '#7f8d87' }}>v{import.meta.env.VITE_APP_VERSION ?? '1.0.0'} · API: {import.meta.env.VITE_API_URL ?? 'localhost:4000'}</small>
    </div>
    <button className="logout-button" style={{ marginTop: 16 }} onClick={onLogout}>End session &amp; secure logs <LockKeyhole size={15} /></button>
  </section>
}

function SyncErrorList() {
  const [errors, setErrors] = useState<{ key: string; value: string }[]>([])
  const load = () => db.syncMetadata.filter((m) => m.key.startsWith('error:') || m.key.startsWith('conflict:')).toArray().then((rows) => setErrors(rows.map((r) => ({ key: r.key, value: r.value }))))
  useEffect(() => { void load() }, [])
  if (errors.length === 0) return null
  const dismiss = async (key: string) => {
    const id = key.replace(/^(error|conflict):/, '')
    await Promise.all([db.syncMetadata.delete(key), db.pendingTransactions.delete(id), db.pendingRegistrations.delete(id)])
    void load()
  }
  return <div style={{ marginTop: 16 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
      <p style={{ fontSize: 12, color: '#e05', margin: 0 }}>Failed operations ({errors.length}) — these will not retry automatically:</p>
      <button onClick={() => void Promise.all(errors.map(({ key }) => dismiss(key)))} style={{ fontSize: 11, color: '#7f8d87', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>Dismiss all ×</button>
    </div>
    {errors.map(({ key, value }) => <div key={key} style={{ fontSize: 12, background: 'rgba(238,0,85,0.08)', border: '1px solid rgba(238,0,85,0.25)', borderRadius: 6, padding: '8px 10px', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
      <span style={{ color: '#e05', flex: 1 }}>{value}</span>
      <button onClick={() => void dismiss(key)} style={{ fontSize: 11, color: '#7f8d87', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>Dismiss ×</button>
    </div>)}
  </div>
}

function PeopleScreen({ onSelectPerson }: { onSelectPerson: (person: api.Person) => void }) {
  return <PersonSearchScreen onSelectPerson={onSelectPerson} />
}

function PersonSearchScreen({ onSelectPerson }: { onSelectPerson: (person: api.Person) => void }) {
  const [q, setQ] = useState('')
  const { data, isLoading, isFetchingNextPage, fetchNextPage, hasNextPage } = useInfiniteQuery({
    queryKey: ['people', q],
    queryFn: ({ pageParam = 1 }) => api.listPeople(q || undefined, pageParam as number),
    getNextPageParam: (lastPage, pages) => lastPage.data.length >= 5 ? pages.length + 1 : undefined,
    initialPageParam: 1,
  })
  const people = data?.pages.flatMap((p) => p.data) ?? []
  return <section className="search-screen">
    <div className="search-field"><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or national ID..." /></div>
    {isLoading && <p className="empty-state">Loading...</p>}
    {people.map((p) => <button className="search-record" key={p.id} onClick={() => onSelectPerson(p)}>
      <span className="record-image"><UserRound size={28} /></span>
      <span><strong>{p.name}</strong><small>ID: {p.nationalId}</small><small>{p.sector ?? '—'} · {p.village ?? '—'}</small></span>
      <ChevronRight size={16} />
    </button>)}
    {!isLoading && people.length === 0 && <p className="empty-state">No people found.</p>}
    {hasNextPage && <button className="secondary-button load-button" disabled={isFetchingNextPage} onClick={() => void fetchNextPage()}><Cloud size={14} /> {isFetchingNextPage ? 'Loading...' : 'Load more'}</button>}
  </section>
}

function PersonActivityScreen({ person, onSelectTransaction, onOpenDetails }: { person: api.Person | null; onSelectTransaction: (id: string) => void; onOpenDetails: (id: string, frameNumber: string) => void }) {
  const { data: txData, isLoading: txLoading } = useQuery({ queryKey: ['person-transactions', person?.id], queryFn: () => api.listTransactions({ personId: person!.id }), enabled: !!person })
  const { data: regData, isLoading: regLoading } = useQuery({ queryKey: ['person-registrations', person?.id], queryFn: () => api.listRegistrations({ ownerId: person!.id }), enabled: !!person })
  const loading = txLoading || regLoading
  type ActivityItem = { key: string; date: string; label: string; sub1: string; sub2: string; onPress: () => void }
  const items: ActivityItem[] = [
    ...(txData?.data ?? []).map((t) => ({ key: t.id, date: t.transactionDate, label: `${t.type === 'SALE' ? 'Sale' : 'Transfer'}: ${t.bicycle.brand ?? ''} ${t.bicycle.model ?? ''}`.trim(), sub1: `${t.seller?.name ?? '—'} → ${t.buyer?.name ?? '—'}`, sub2: `# ${t.transactionId} · ${new Date(t.transactionDate).toLocaleString()}`, onPress: () => onSelectTransaction(t.id) })),
    ...(regData?.data ?? []).map((r) => ({ key: r.id, date: r.createdAt, label: `Registered: ${r.bicycle.brand ?? ''} ${r.bicycle.model ?? ''}`.trim(), sub1: `Owner: ${r.owner.name}`, sub2: `# ${r.bicycle.frameNumber} · ${new Date(r.createdAt).toLocaleString()}`, onPress: () => onOpenDetails(r.bicycle.id, r.bicycle.frameNumber) })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  return <section className="activity-screen">
    {person && <div className="registry-identity" style={{ marginBottom: 16 }}><span className="profile-avatar">{person.name.split(' ').map((p) => p[0]).join('').slice(0, 2)}</span><span><strong>{person.name}</strong><small>{person.nationalId}</small></span></div>}
    <p className="date-divider">▣ All Activity</p>
    {loading && <p className="empty-state">Loading...</p>}
    {items.map((item) => <button className="activity-card" key={item.key} onClick={item.onPress}><span className="activity-mark"><ArrowRight size={16} /></span><span><strong>{item.label}</strong><small>{item.sub1}</small><small>{item.sub2}</small></span><ChevronRight size={16} /></button>)}
    {!loading && items.length === 0 && <p className="empty-state">No activity found for this person.</p>}
  </section>
}
function BottomNav({ screen, onNavigate }: { screen: Screen; onNavigate: (screen: Screen) => void }) { return <nav className="bottom-nav">{navItems.map(({ screen: item, label, icon: Icon }) => <button className={screen === item ? 'active' : ''} key={item} onClick={() => onNavigate(item)}><Icon size={18} /><small>{label}</small></button>)}</nav> }
function AdminBottomNav({ screen, onNavigate }: { screen: Screen; onNavigate: (screen: Screen) => void }) { const items: { screen: Screen; label: string; icon: typeof Home }[] = [{ screen: 'admin-home', label: 'Home', icon: Home }, { screen: 'bicycle-inventory', label: 'Bicycles', icon: Bike }, { screen: 'registry-profile', label: 'People', icon: Users }, { screen: 'agent-management', label: 'Agents', icon: UserRound }]; return <nav className="bottom-nav admin-bottom-nav">{items.map(({ screen: item, label, icon: Icon }) => <button className={screen === item || (label === 'Bicycles' && ['admin-transactions', 'transaction-record', 'flagged-queue', 'ownership-chain'].includes(screen)) || (label === 'People' && screen === 'person-activity') || (label === 'Agents' && ['agent-onboarding', 'agent-terminal'].includes(screen)) ? 'active' : ''} key={label} onClick={() => onNavigate(item)}><Icon size={18} /><small>{label}</small></button>)}</nav> }
function OwnerDetailsModal({ person, onClose }: { person: PersonRecord; onClose: () => void }) { return <div className="owner-modal-backdrop" role="dialog" aria-modal="true" aria-label="Owner details"><section className="owner-modal"><header><span><UserRound size={17} /> Owner details</span><button onClick={onClose} aria-label="Close owner details"><X size={18} /></button></header><div className="owner-modal-identity"><span className="profile-avatar">{person.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span><span><strong>{person.name}</strong><small>Existing person record</small></span></div><dl><dt>National ID</dt><dd>{person.nationalId}</dd><dt>Phone</dt><dd>{person.phone}</dd><dt>Cell</dt><dd>{person.cell}</dd><dt>Sector</dt><dd>{person.sector}</dd><dt>Village</dt><dd>{person.village}</dd></dl><p className="owner-modal-note"><ShieldCheck size={14} /> This person can be linked without creating a duplicate record.</p><button className="action-button" onClick={onClose}>Return to verification</button></section></div> }
