// ========================================================
// P-ELECTION CREATE CANDIDATE USER (service role)
// --------------------------------------------------------
// Used by the admin dashboard (Musharax page) to create or reset the
// login account of a candidate. Only a verified superuser may call it.
//
// Deploy:  supabase functions deploy create-candidate-user
// Set env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
//   (Service role values are NEVER used in the frontend.)
//
// Actions:
//   { action: 'create', email, password }  create a confirmed account
//   { action: 'reset',  email, password }  update a candidate's password
//   { action: 'delete', user_id }          clean-up helper (best effort)
// ========================================================

// Edge Runtime type declarations: defines the `Deno` global for the editor.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    return json({ error: 'method_not_allowed' }, 405)
  }

  const anon = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
  )
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // 1. Who is calling? (the JWT from the admin's session)
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
  const {
    data: { user },
  } = await anon.auth.getUser(token)
  if (!user) {
    return json({ error: 'unauthorized' }, 401)
  }

  // 2. Only a real superuser may manage candidate accounts.
  const { data: profile } = await admin
    .from('profiles')
    .select('is_superuser')
    .eq('id', user.id)
    .maybeSingle()
  if (!profile?.is_superuser) {
    return json({ error: 'forbidden' }, 403)
  }

  try {
    const body = await req.json()
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')

    if (password.length < 6) {
      return json({ error: 'weak_password' }, 400)
    }

    switch (body.action) {
      case 'create': {
        const { data, error } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true, // confirmed immediately - no confirmation email needed
        })
        if (error) {
          if (/already registered/i.test(error.message)) {
            return json({ error: 'email_taken' }, 409)
          }
          return json({ error: 'create_failed', error_message: error.message }, 400)
        }
        return json({ user_id: data!.user?.id ?? null })
      }

      case 'reset': {
        const { data: userWithEmail } = await admin.auth.admin.getUserByEmail(email)
        const target = userWithEmail?.user
        if (!target?.id) {
          return json({ error: 'user_not_found' }, 404)
        }
        const { error } = await admin.auth.admin.updateUserById(target.id, {
          password,
          email_confirm: true,
        })
        if (error) {
          return json({ error: 'reset_failed', error_message: error.message }, 400)
        }
        return json({ user_id: target.id })
      }

      case 'delete': {
        const uid = String(body.user_id || '')
        if (!uid) {
          return json({ error: 'missing_user_id' }, 400)
        }
        const { error } = await admin.auth.admin.deleteUser(uid)
        if (error) {
          return json({ error: 'delete_failed', error_message: error.message }, 400)
        }
        return json({ deleted: true })
      }

      default:
        return json({ error: 'bad_action' }, 400)
    }
  } catch (_e) {
    return json({ error: 'server_error' }, 500)
  }
})