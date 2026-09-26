import { supabase } from '../supabaseClient'

// URL of deployed Supabase Edge Functions, e.g. https://<ref>.functions.supabase.co
const FUNCTIONS_BASE = (import.meta.env.VITE_SUPABASE_FUNCTIONS_BASE || '').replace(/\/+$/, '')

const EDGE_URL = FUNCTIONS_BASE ? `${FUNCTIONS_BASE}/create-candidate-user` : ''

function errorMessage(code) {
  const map = {
    unauthorized: 'Aqoonsigaagu waa khalad. Mar kale gal.',
    forbidden: 'Wax kumaadna badin karto - kaliya superuser.',
    weak_password: 'Password-ku waa inuu ka koobnaadaa 6 xaraf.',
    email_taken: 'Email-ka hore ayaa loo isticmaalay. Dooro email kale.',
    user_not_found: 'Akaunka margiisa lama helin.',
    create_failed: 'Akaunka lama abouri karin.',
    reset_failed: 'Password-ka lama bedelin karin.',
    delete_failed: 'Akaunka lama tirtiri karin.',
    method_not_allowed: 'Hab khaldan.',
    server_error: 'Khalad server ah.',
  }
  return map[code] || 'Khalad ayaa dhacay, isku day markale.'
}

function edgeNotConfiguredError() {
  return new Error(
    'Edge Function-ka waa la xidhay. Deploy samee: supabase functions deploy create-candidate-user, markaasna samee VITE_SUPABASE_FUNCTIONS_BASE.'
  )
}

async function viaEdge(payload) {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const res = await fetch(EDGE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token || ''}`,
    },
    body: JSON.stringify(payload),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json.error) {
    throw new Error(errorMessage(json.error))
  }
  return json
}

// Create a candidate's auth account. IMPORTANT: this runs while the ADMIN is
// logged in, so we must NEVER call supabase.auth.signUp() here - it would
// silently log the admin into the new candidate's account and break RLS.
// Account creation goes through the service-role Edge Function only.
export async function createCandidateAccount({ email, password }) {
  if (!EDGE_URL) {
    throw edgeNotConfiguredError()
  }
  return viaEdge({ action: 'create', email, password })
}

export async function resetCandidatePassword({ email, password }) {
  if (!EDGE_URL) {
    throw edgeNotConfiguredError()
  }
  return viaEdge({ action: 'reset', email, password })
}

export async function deleteCandidateAccount(userId) {
  if (!EDGE_URL) return
  try {
    return await viaEdge({ action: 'delete', user_id: userId })
  } catch {
    // best effort - never block a candidate deletion on account cleanup
  }
}