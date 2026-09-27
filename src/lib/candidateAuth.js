import { createClient } from '@supabase/supabase-js'
import { supabase } from '../supabaseClient'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

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

// Create a non-persisted client for fallback auth operations so the active Admin session is not affected.
function getTempClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
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

async function fallbackCreateAccount({ email, password }) {
  const tempClient = getTempClient()
  const { data, error } = await tempClient.auth.signUp({ email, password })
  if (error) {
    if (error.message?.toLowerCase().includes('already registered')) {
      throw new Error(errorMessage('email_taken'))
    }
    throw new Error(error.message || errorMessage('create_failed'))
  }
  if (!data?.user?.id) {
    throw new Error(errorMessage('create_failed'))
  }
  return { user_id: data.user.id }
}

// Create a candidate's auth account.
// Uses Edge Function if configured & deployed; falls back to non-persisted client-side signUp
// so candidates can be added seamlessly without requiring Edge Function deployment in local/dev setup.
export async function createCandidateAccount({ email, password }) {
  if (EDGE_URL) {
    try {
      return await viaEdge({ action: 'create', email, password })
    } catch (err) {
      if (
        err.message === errorMessage('email_taken') ||
        err.message === errorMessage('weak_password')
      ) {
        throw err
      }
      console.warn('Edge Function unavailable, falling back to client signup:', err.message)
    }
  }
  return fallbackCreateAccount({ email, password })
}

export async function resetCandidatePassword({ email, password }) {
  if (EDGE_URL) {
    try {
      return await viaEdge({ action: 'reset', email, password })
    } catch (err) {
      if (
        err.message === errorMessage('weak_password') ||
        err.message === errorMessage('user_not_found')
      ) {
        throw err
      }
      console.warn('Edge Function unavailable for reset:', err.message)
    }
  }
  const tempClient = getTempClient()
  const { error } = await tempClient.auth.resetPasswordForEmail(email)
  if (error) {
    throw new Error(errorMessage('reset_failed'))
  }
  return { success: true }
}

export async function deleteCandidateAccount(userId) {
  if (!EDGE_URL) return
  try {
    return await viaEdge({ action: 'delete', user_id: userId })
  } catch {
    // best effort - never block candidate deletion on account cleanup
  }
}