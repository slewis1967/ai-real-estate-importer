// src/app/page.tsx

import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import AuthForm from '@/components/AuthForm'
import Uploader from '@/components/Uploader'
import LogoutButton from '@/components/LogoutButton'

// This ensures the page is always rendered dynamically on the server,
// reflecting the latest authentication state.
export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const supabase = createServerComponentClient({ cookies })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  // If there is no active session, show the login form
  if (!session) {
    return <AuthForm />
  }

  // If there is a session, show the main application UI
  return (
    <div className="flex min-h-screen flex-col items-center p-4 bg-gray-50">
        <header className="w-full max-w-xl flex justify-between items-center my-8">
            <p>Signed in as <span className="font-semibold">{session.user.email}</span></p>
            <LogoutButton />
        </header>
        <Uploader />
    </div>
  )
}
