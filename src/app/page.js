'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Home() {
  const [view, setView] = useState('home');
  const [urlInput, setUrlInput] = useState(''); // Specifically for links
  const [butcherInput, setButcherInput] = useState(''); // Specifically for bulk text
  const [isProcessing, setIsProcessing] = useState(false);
  const [recipe, setRecipe] = useState({ title: '', ingredients: '', directions: '' });
  const [showEditor, setShowEditor] = useState(false);
  const [showButcherBlock, setShowButcherBlock] = useState(false);
  
  // Vault Logic
  const [vaultItems, setVaultItems] = useState([]);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [checkedIngredients, setCheckedIngredients] = useState({});

  const streamText = (field, text) => {
    let i = 0;
    const interval = setInterval(() => {
      setRecipe(prev => ({ ...prev, [field]: text.slice(0, i) }));
      i++;
      if (i > text.length) clearInterval(interval);
    }, 10);
  };

  // PREMADE: URL Scraper Logic
  const handleUrlScrape = () => {
    setIsProcessing(true);
    // This is where we'll eventually call a Scraper API
    setTimeout(() => {
      setIsProcessing(false);
      setShowEditor(true);
      streamText('title', "Scraped Steak Recipe");
      streamText('ingredients', "1. Steak from Web\n2. Salt from Web\n3. Butter from Web");
      streamText('directions', "1. Follow the web instructions.\n2. Sear and eat.");
      setUrlInput('');
    }, 1500);
  };

  // SCRATCH: Butcher Block logic
  const processButcherBlock = () => {
    setRecipe({
      ...recipe,
      ingredients: butcherInput // In the future, we can add logic to clean this up
    });
    setButcherInput('');
    setShowButcherBlock(false);
  };

  const saveRecipe = async () => {
    const { error } = await supabase.from('recipes').insert([{ 
      title: recipe.title, 
      ingredients: recipe.ingredients, 
      directions: recipe.directions,
      description: recipe.ingredients.substring(0, 60) + "..."
    }]);
    if (!error) {
      setView('home');
      setRecipe({ title: '', ingredients: '', directions: '' });
      setShowEditor(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-start bg-[#121212] text-white p-4 font-sans">
      
      <div className="my-12 text-center">
        <h1 className="text-6xl font-black tracking-tighter text-[#FF4500]">POCKETSTEAK</h1>
        <p className="text-gray-500 mt-2 uppercase tracking-widest text-xs font-bold">Pitmaster Intelligence</p>
      </div>

      {view === 'home' && (
        <div className="flex flex-col gap-4 w-full max-w-md mt-10">
          <button onClick={() => { setView('scratch'); setShowEditor(true); }} className="p-6 bg-[#1E1E1E] border-2 border-gray-800 rounded-xl font-bold text-xl hover:border-[#FF4500] transition-all">FROM SCRATCH</button>
          <button onClick={() => setView('premade')} className="p-6 bg-[#1E1E1E] border-2 border-gray-800 rounded-xl font-bold text-xl hover:border-[#FF4500] transition-all">PREMADE</button>
          <button onClick={() => setView('vault')} className="p-6 bg-[#FF4500] rounded-xl font-bold text-xl mt-4 active:scale-95 transition-all">THE VAULT</button>
        </div>
      )}

      {view !== 'home' && (
        <div className="w-full max-w-5xl">
          <button onClick={() => { setView('home'); setShowEditor(false); setSelectedRecipe(null); }} className="text-gray-400 hover:text-white mb-6 font-bold uppercase text-xs tracking-widest">← BACK TO HUB</button>

          {view === 'premade' && !showEditor && (
            <div className="max-w-2xl mx-auto p-8 border border-gray-800 rounded-2xl bg-[#1A1A1A] space-y-6">
              <h2 className="text-2xl font-bold text-[#FF4500]">PASTE RECIPE URL</h2>
              <input 
                value={urlInput} 
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://cool-steak-recipes.com/ribeye" 
                className="w-full bg-[#121212] border border-gray-700 rounded p-4 outline-none focus:border-[#FF4500]"
              />
              <button onClick={handleUrlScrape} className="w-full p-4 bg-[#FF4500] font-bold rounded">FETCH & STREAM</button>
            </div>
          )}

          {(view === 'scratch' || (view === 'premade' && showEditor)) && (
            <div className="max-w-3xl mx-auto p-8 border border-gray-800 rounded-2xl bg-[#1A1A1A] space-y-8">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-500 uppercase tracking-widest">The Pit</h2>
                <button 
                  onClick={() => setShowButcherBlock(!showButcherBlock)}
                  className="text-xs bg-gray-800 px-3 py-1 rounded hover:bg-gray-700 transition-all"
                >
                  {showButcherBlock ? "Close Butcher Block" : "+ Open Butcher Block (Bulk Paste)"}
                </button>
              </div>

              {showButcherBlock && (
                <div className="p-4 bg-[#121212] border border-[#FF4500] rounded-lg space-y-4">
                  <p className="text-xs text-gray-400">Dump raw text here to auto-fill the ingredients list.</p>
                  <textarea 
                    value={butcherInput}
                    onChange={(e) => setButcherInput(e.target.value)}
                    className="w-full h-32 bg-transparent outline-none text-sm"
                    placeholder="2 lbs beef, 1 tbsp salt, 4 cloves garlic..."
                  />
                  <button onClick={processButcherBlock} className="w-full p-2 bg-white text-black font-bold text-xs rounded">PROCESS INTO LIST</button>
                </div>
              )}

              <div className="space-y-6">
                <input value={recipe.title} onChange={(e) => setRecipe({...recipe, title: e.target.value})} placeholder="Recipe Title" className="w-full bg-transparent border-b border-gray-700 text-3xl font-bold p-2 outline-none focus:border-[#FF4500]" />
                <textarea value={recipe.ingredients} onChange={(e) => setRecipe({...recipe, ingredients: e.target.value})} placeholder="Ingredients (one per line)" className="w-full h-40 bg-[#121212] border border-gray-700 rounded p-4 outline-none focus:border-[#FF4500]" />
                <textarea value={recipe.directions} onChange={(e) => setRecipe({...recipe, directions: e.target.value})} placeholder="Directions" className="w-full h-40 bg-[#121212] border border-gray-700 rounded p-4 outline-none focus:border-[#FF4500]" />
                <button onClick={saveRecipe} className="w-full p-4 bg-emerald-600 rounded font-bold uppercase tracking-widest">Save to Vault</button>
              </div>
            </div>
          )}

          {view === 'vault' && (
            <div className="text-center p-10 text-gray-500 font-bold uppercase tracking-widest border border-dashed border-gray-800 rounded-2xl">
              Vault UI logic is active. Select a recipe from the sidebar.
            </div>
          )}
        </div>
      )}
    </main>
  );
}