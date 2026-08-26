export type Role = 'AGENT' | 'ADMIN'
export type RecordStatus = 'Verified' | 'Needs review' | 'Pending sync'

export type BicycleRecord = {
  id: string
  frameNumber: string
  name: string
  type: string
  color: string
  owner: string
  location: string
  status: RecordStatus
  date: string
}

export const mockUser = { name: 'Maya Okafor', initials: 'MO', role: 'AGENT' as Role, location: 'East District' }

export const mockBicycles: BicycleRecord[] = [
  { id: 'B-1042', frameNumber: 'ABT-2024-00918', name: 'Trek Marlin 7', type: 'Mountain bike', color: 'Forest green', owner: 'Daniel Mensah', location: 'East District', status: 'Verified', date: 'Today, 09:42' },
  { id: 'B-1041', frameNumber: 'ABT-2024-00911', name: 'Giant Escape 3', type: 'Hybrid bike', color: 'Steel grey', owner: 'Amina Bello', location: 'East District', status: 'Needs review', date: 'Yesterday, 16:18' },
  { id: 'B-1038', frameNumber: 'ABT-2024-00876', name: 'Specialized Sirrus', type: 'Road bike', color: 'Rust red', owner: 'Kwame Boateng', location: 'North District', status: 'Pending sync', date: 'Yesterday, 11:06' },
]

export const mockActivity = [
  ['09:42', 'Registration recorded', 'Trek Marlin 7 · ABT-2024-00918'],
  ['08:55', 'Ownership transfer flagged', 'Giant Escape 3 · seller mismatch'],
  ['Yesterday', 'Sale recorded', 'Specialized Sirrus · ABT-2024-00876'],
]

export type AdminTransaction = {
  id: string
  type: 'SALE' | 'TRANSFER' | 'REGISTRATION'
  bicycle: string
  frameNumber: string
  parties: string
  agent: string
  date: string
  status: 'Verified' | 'Flagged' | 'Pending sync'
}

export const mockAdminTransactions: AdminTransaction[] = [
  { id: 'TX-98422-BK', type: 'SALE', bicycle: 'Specialized Sirrus X 4.0', frameNumber: 'M2S-928', parties: 'Marcus Thorne → Sarah Jenkins', agent: 'AGENT_8821', date: 'Nov 24 · 14:32', status: 'Flagged' },
  { id: 'TX-98421-BK', type: 'TRANSFER', bicycle: 'Cannondale Topstone 1', frameNumber: 'CND-7784', parties: 'Daniel Cole → Amina Bello', agent: 'AGENT_1104', date: 'Nov 24 · 11:16', status: 'Verified' },
  { id: 'TX-98420-BK', type: 'REGISTRATION', bicycle: 'Trek Marlin 7 Gen 2', frameNumber: 'TRK-9928', parties: 'Elena Rodriguez', agent: 'AGENT_8821', date: 'Nov 24 · 09:42', status: 'Verified' },
  { id: 'TX-98419-BK', type: 'SALE', bicycle: 'Giant Escape 3', frameNumber: 'GNT-3810', parties: 'Kwame Boateng → Peter Smith', agent: 'AGENT_4430', date: 'Nov 23 · 16:18', status: 'Pending sync' },
]