'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Home() {
  const [view, setView] = useState('home');
  const [rawInput, setRawInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // This is the logic for the Butcher Block "Process" button
  const handleButcherBlock = () => {
    setIsProcessing(true);
    // Simulate the "Matrix" processing delay
    setTimeout(() => {
      setIsProcessing(false);
      setRawInput(''); // Clear the block as we discussed!
      alert("Butcher Block processed! (Matrix streaming logic goes here next)");
    }, 2000);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#121212] text-white p-4 font-sans">
      
      {/* Logo Header */}
      <div className="mb-12 text-center">
        <h1 className="text-6xl font-black tracking-tighter text-[#FF4500]">
          POCKETSTEAK
        </h1>
        <p className="text-gray-500 mt-2 uppercase tracking-widest text-xs font-bold">Pitmaster Intelligence</p>
      </div>

      {view === 'home' && (
        <div className="flex flex-col gap-4 w-full max-w-md">
          <button onClick={() => setView('scratch')} className="p-6 bg-[#1E1E1E] border-2 border-gray-800 rounded-xl font-bold text-xl hover:border-[#FF4500] transition-all active:scale-95">
            FROM SCRATCH
          </button>
          <button onClick={() => setView('premade')} className="p-6 bg-[#1E1E1E] border-2 border-gray-800 rounded-xl font-bold text-xl hover:border-[#FF4500] transition-all active:scale-95">
            PREMADE
          </button>
          <button onClick={() => setView('vault')} className="p-6 bg-[#FF4500] rounded-xl font-bold text-xl mt-4 shadow-lg shadow-orange-900/20 active:scale-95 transition-all">
            THE VAULT
          </button>
        </div>
      )}

      {view !== 'home' && (
        <div className="w-full max-w-2xl">
          <button onClick={() => setView('home')} className="text-gray-500 hover:text-white transition-colors mb-8 font-bold">
            ← BACK TO HUB
          </button>
          
          <div className="p-8 border border-gray-800 rounded-2xl bg-[#1A1A1A] shadow-2xl">
             {view === 'premade' && (
               <div className="flex flex-col gap-6">
                 <div>
                   <h2 className="text-2xl font-bold text-[#FF4500]">BUTCHER BLOCK</h2>
                   <p className="text-gray-400 text-sm mt-1">Dump your raw recipe text or URL here for processing.</p>
                 </div>
                 
                 <textarea 
                   value={rawInput}
                   onChange={(e) => setRawInput(e.target.value)}
                   placeholder="Paste ingredients or link..."
                   className="w-full h-40 bg-[#121212] border border-gray-700 rounded-lg p-4 text-gray-300 focus:border-[#FF4500] outline-none transition-colors"
                 />

                 <button 
                   onClick={handleButcherBlock}
                   disabled={!rawInput || isProcessing}
                   className={`p-4 rounded-lg font-bold transition-all ${isProcessing ? 'bg-gray-700 animate-pulse' : 'bg-[#FF4500] hover:bg-[#e63e00]'}`}
                 >
                   {isProcessing ? 'PROCESSING DATA...' : 'PROCESS INTO THE PIT'}
                 </button>
               </div>
             )}

             {view === 'scratch' && <h2 className="text-2xl font-bold">THE PIT: MANUAL ENTRY</h2>}
             {view === 'vault' && <h2 className="text-2xl font-bold">YOUR VAULT</h2>}
          </div>
        </div>
      )}
    </main>
  );
}