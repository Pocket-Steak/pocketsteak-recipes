'use client'; // This allows us to use buttons and state

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Home() {
  const [view, setView] = useState('home');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#121212] text-white p-4">
      
      {/* Logo Header */}
      <div className="mb-12 text-center">
        <h1 className="text-6xl font-black tracking-tighter text-[#FF4500]">
          POCKETSTEAK
        </h1>
        <p className="text-gray-500 mt-2 uppercase tracking-widest text-xs">Pitmaster Intelligence</p>
      </div>

      {view === 'home' && (
        <div className="flex flex-col gap-4 w-full max-w-md">
          {/* Main Action Buttons */}
          <button 
            onClick={() => setView('scratch')}
            className="p-6 bg-[#1E1E1E] border-2 border-gray-800 rounded-xl font-bold text-xl hover:border-[#FF4500] transition-all active:scale-95"
          >
            FROM SCRATCH
          </button>

          <button 
            onClick={() => setView('premade')}
            className="p-6 bg-[#1E1E1E] border-2 border-gray-800 rounded-xl font-bold text-xl hover:border-[#FF4500] transition-all active:scale-95"
          >
            PREMADE
          </button>

          {/* The Vault Button */}
          <button 
            onClick={() => setView('vault')}
            className="p-6 bg-[#FF4500] rounded-xl font-bold text-xl mt-4 shadow-lg shadow-orange-900/20 active:scale-95 transition-all"
          >
            THE VAULT
          </button>
        </div>
      )}

      {/* Back Button for sub-pages */}
      {view !== 'home' && (
        <div className="w-full max-w-2xl">
          <button 
            onClick={() => setView('home')}
            className="text-gray-500 hover:text-white transition-colors mb-8"
          >
            ← BACK TO HUB
          </button>
          
          <div className="p-8 border border-gray-800 rounded-2xl bg-[#1A1A1A]">
             {view === 'premade' && <h2 className="text-2xl font-bold">PREMADE INTAKE</h2>}
             {view === 'scratch' && <h2 className="text-2xl font-bold">THE PIT: NEW RECIPE</h2>}
             {view === 'vault' && <h2 className="text-2xl font-bold">YOUR VAULT</h2>}
             <p className="text-gray-400 mt-4 italic">Butcher Block coming soon...</p>
          </div>
        </div>
      )}
    </main>
  );
}