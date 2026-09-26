// ========================================================
// P-ELECTION SECURE VOTING GATEWAY (OPTIONAL RATE LIMIT LAYER)
// --------------------------------------------------------
// Deploy:  supabase functions deploy cast-vote
// Set:     FUNCTION_SECRET env in Supabase dashboard.
// Client:  set VITE_CAST_VOTE_URL to the function URL. If unset, the app
//          calls the cast_vote RPC directly (also secure - just without
//          the extra IP rate limiting).
//
// Security notes:
//   - This function ONLY relays to the cast_vote() RPC, which does the
//     real server-side validation as a SECURITY DEFINER (trusted).
//   - Functions run in the same auth context as callers, so we cannot
//     use the service role here; we call the RPC with the ANON key, which
//     is fine because cast_vote() is exactly the anon-allowed path.
//   - The limiter below is an in-memory per-isolate limiter: good enough
//     to stop casual abuse, NOT a hard guarantee across cold starts.
//     For stronger limits, back it with a KV store (e.g. Deno KV /
//     Upstash Redis) keyed on IP + voting code.
// ========================================================

// Edge Runtime type declarations: defines the `Deno` global for the editor.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase: SupabaseClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_ANON_KEY')!,
)

// Per-IP simple sliding window (in-memory, per isolate instance).
const WINDOW_MS = 60_000
const MAX_ATTEMPTS = 10
const hits = new Map<string, number[]>()

function rateLimited(ip: string): boolean {
  const now = Date.now()
  const recent = (hits.get(ip) || []).filter(t => now - t < WINDOW_MS)
  if (recent.length >= MAX_ATTEMPTS) {
    hits.set(ip, recent)
    return true
  }
  recent.push(now)
  hits.set(ip, recent)
  return false
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }
  if (req.method !== 'POST') {
    return json({ ok: false, code: 'METHOD_NOT_ALLOWED' }, 405)
  }

  const ip = (req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim()
  if (rateLimited(ip)) {
    return json({ ok: false, code: 'RATE_LIMITED' }, 429)
  }

  try {
    const body = await req.json()
    const { data: status, error } = await supabase.rpc('cast_vote', {
      p_voting_code: String(body.p_voting_code || ''),
      p_candidate_id: Number(body.p_candidate_id),
      p_department_id: Number(body.p_department_id),
      p_gender: String(body.p_gender || ''),
    })

    if (error) {
      return json({ ok: false, code: 'VOTE_FAILED' }, 400)
    }
    return json({ ok: status === 'ok', code: status })
  } catch (_e) {
    return json({ ok: false, code: 'VOTE_FAILED' }, 400)
  }
})