import { createClient } from '@supabase/supabase-js'

export default async function Home() {
  // These variables are automatically provided by Vercel's Supabase Integration
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const { data: recipes, error } = await supabase.from('recipes').select('*')

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black text-white p-24">
      <h1 className="text-5xl font-extrabold tracking-tight mb-4">PocketSteak</h1>
      <div className="p-8 border border-gray-800 rounded-2xl bg-zinc-900/50 backdrop-blur-sm">
        {error ? (
          <div className="text-center">
            <p className="text-red-400 font-medium">❌ Connection Error</p>
            <p className="text-sm text-gray-500 mt-2">{error.message}</p>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-emerald-400 font-medium text-xl">✅ Database Online</p>
            <p className="text-gray-400 mt-2">Ready for recipes!</p>
          </div>
        )}
      </div>
    </main>
  )
}