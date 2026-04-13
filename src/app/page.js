'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Home() {
  const [view, setView] = useState('home');
  const [rawInput, setRawInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Recipe State
  const [recipe, setRecipe] = useState({ title: '', ingredients: '', directions: '' });
  const [showEditor, setShowEditor] = useState(false);

  // The "Matrix" Typewriter Logic
  const streamText = (field, text) => {
    let i = 0;
    const interval = setInterval(() => {
      setRecipe(prev => ({ ...prev, [field]: text.slice(0, i) }));
      i++;
      if (i > text.length) clearInterval(interval);
    }, 15); // Adjust speed here
  };

  const handleButcherBlock = () => {
    setIsProcessing(true);
    
    // Simulate data extraction logic
    setTimeout(() => {
      setIsProcessing(false);
      setRawInput('');
      setShowEditor(true);
      
      // Kick off the Matrix streaming
      streamText('title', "World's Best Garlic Butter Ribeye");
      setTimeout(() => streamText('ingredients', "1. 16oz Ribeye\n2. 4 cloves Garlic\n3. Fresh Rosemary\n4. Unsalted Butter"), 500);
      setTimeout(() => streamText('directions', "1. Salt steak heavily.\n2. Sear 3 mins per side.\n3. Baste with garlic butter."), 1500);
    }, 1500);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-start bg-[#121212] text-white p-4 font-sans">
      
      {/* Logo Header */}
      <div className="my-12 text-center">
        <h1 className="text-6xl font-black tracking-tighter text-[#FF4500]">POCKETSTEAK</h1>
        <p className="text-gray-500 mt-2 uppercase tracking-widest text-xs font-bold">Pitmaster Intelligence</p>
      </div>

      {view === 'home' && (
        <div className="flex flex-col gap-4 w-full max-w-md mt-10">
          <button onClick={() => { setView('scratch'); setShowEditor(true); }} className="p-6 bg-[#1E1E1E] border-2 border-gray-800 rounded-xl font-bold text-xl hover:border-[#FF4500] transition-all">
            FROM SCRATCH
          </button>
          <button onClick={() => setView('premade')} className="p-6 bg-[#1E1E1E] border-2 border-gray-800 rounded-xl font-bold text-xl hover:border-[#FF4500] transition-all">
            PREMADE
          </button>
          <button onClick={() => setView('vault')} className="p-6 bg-[#FF4500] rounded-xl font-bold text-xl mt-4 shadow-lg shadow-orange-900/20 active:scale-95 transition-all">
            THE VAULT
          </button>
        </div>
      )}

      {view !== 'home' && (
        <div className="w-full max-w-3xl">
          <button onClick={() => { setView('home'); setShowEditor(false); setRecipe({title:'', ingredients:'', directions:''}); }} className="text-gray-500 hover:text-white transition-colors mb-8 font-bold">
            ← BACK TO HUB
          </button>

          {/* Status Bar */}
          {showEditor && (
            <div className="bg-[#FF4500] text-black p-2 mb-4 rounded font-bold text-center animate-pulse text-sm">
              THE PIT IS ACTIVE: PLEASE SEASON YOUR RECIPE DATA
            </div>
          )}
          
          <div className="p-8 border border-gray-800 rounded-2xl bg-[#1A1A1A] shadow-2xl space-y-8">
             {view === 'premade' && !showEditor && (
               <div className="flex flex-col gap-6">
                 <div>
                   <h2 className="text-2xl font-bold text-[#FF4500]">BUTCHER BLOCK</h2>
                   <p className="text-gray-400 text-sm mt-1">Dump raw text here to prep it.</p>
                 </div>
                 <textarea 
                   value={rawInput}
                   onChange={(e) => setRawInput(e.target.value)}
                   className="w-full h-40 bg-[#121212] border border-gray-700 rounded-lg p-4 outline-none"
                   placeholder="Paste here..."
                 />
                 <button onClick={handleButcherBlock} disabled={!rawInput || isProcessing} className="p-4 rounded-lg font-bold bg-[#FF4500]">
                   {isProcessing ? 'PROCESSING...' : 'PROCESS INTO THE PIT'}
                 </button>
               </div>
             )}

             {showEditor && (
               <div className="space-y-6">
                 <div>
                   <label className="text-xs uppercase font-bold text-gray-500">Recipe Title</label>
                   <input 
                     value={recipe.title}
                     onChange={(e) => setRecipe({...recipe, title: e.target.value})}
                     className="w-full bg-transparent border-b border-gray-700 py-2 text-2xl font-bold outline-none focus:border-[#FF4500]"
                   />
                 </div>

                 <div>
                    <label className="text-xs uppercase font-bold text-gray-500">Ingredients</label>
                    <textarea 
                      value={recipe.ingredients}
                      onChange={(e) => setRecipe({...recipe, ingredients: e.target.value})}
                      className="w-full bg-[#121212] border border-gray-700 rounded-lg p-4 mt-2 h-48 outline-none focus:border-[#FF4500]"
                    />
                 </div>

                 <div>
                    <label className="text-xs uppercase font-bold text-gray-500">Directions</label>
                    <textarea 
                      value={recipe.directions}
                      onChange={(e) => setRecipe({...recipe, directions: e.target.value})}
                      className="w-full bg-[#121212] border border-gray-700 rounded-lg p-4 mt-2 h-48 outline-none focus:border-[#FF4500]"
                    />
                 </div>

                 <button className="w-full p-4 bg-emerald-600 rounded-lg font-bold hover:bg-emerald-500 transition-colors">
                   SAVE TO VAULT
                 </button>
               </div>
             )}
          </div>
        </div>
      )}
    </main>
  );
}