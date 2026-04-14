'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Home() {
  const [view, setView] = useState('home');
  const [urlInput, setUrlInput] = useState('');
  const [butcherInput, setButcherInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [recipe, setRecipe] = useState({ title: '', ingredients: '', directions: '' });
  const [showEditor, setShowEditor] = useState(false);
  const [showButcherBlock, setShowButcherBlock] = useState(false);
  
  // Vault States
  const [vaultItems, setVaultItems] = useState([]);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [checkedIngredients, setCheckedIngredients] = useState({});

  const streamText = (field, text) => {
    if (!text) return;
    let i = 0;
    const interval = setInterval(() => {
      setRecipe(prev => ({ ...prev, [field]: text.slice(0, i) }));
      i++;
      if (i > text.length) clearInterval(interval);
    }, 5); // Slightly faster streaming for real data
  };

  const fetchVault = async () => {
    const { data, error } = await supabase.from('recipes').select('*').order('created_at', { ascending: false });
    if (!error) setVaultItems(data);
  };

  useEffect(() => {
    if (view === 'vault') fetchVault();
  }, [view]);

  // --- LIVE SCRAPER UPDATE ---
  const handleUrlScrape = async () => {
    if (!urlInput) return;
    setIsProcessing(true);

    try {
      // Calls your newly deployed Edge Function
      const { data, error } = await supabase.functions.invoke('scrape-recipe', {
        body: { url: urlInput },
      });

      if (error) throw new Error(error.message || "Failed to scrape");

      // Reset the current recipe view
      setRecipe({ title: '', ingredients: '', directions: '' });
      setShowEditor(true);

      // Start the Matrix Stream with the data returned from the website
      streamText('title', data.title || "Sourced Recipe");
      
      // Delay ingredients and directions slightly for a better visual "flow"
      setTimeout(() => {
        streamText('ingredients', data.ingredients);
      }, 500);
      
      setTimeout(() => {
        streamText('directions', data.directions);
      }, 1200);

    } catch (err) {
      console.error("Scrape failed:", err);
      alert("The Pit couldn't grab this one automatically. Try the Butcher Block!");
    } finally {
      setIsProcessing(false);
      setUrlInput('');
    }
  };
  // ---------------------------

  const processButcherBlock = () => {
    setRecipe({ ...recipe, ingredients: butcherInput });
    setButcherInput('');
    setShowButcherBlock(false);
  };

  const copyToSheets = () => {
    const list = selectedRecipe.ingredients.split('\n')
      .filter((_, index) => checkedIngredients[index])
      .join('\n');
    if (list) {
      navigator.clipboard.writeText(list);
      alert("Copied checked items to clipboard!");
    }
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
      fetchVault();
    }
  };

  const filteredVault = vaultItems.filter(item => item.title.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <main className="flex min-h-screen flex-col items-center justify-start bg-[#121212] text-white p-4 font-sans">
      
      <div className="my-12 text-center">
        <h1 className="text-6xl font-black tracking-tighter text-[#FF4500]">POCKETSTEAK</h1>
        <p className="text-gray-500 mt-2 uppercase tracking-widest text-xs font-bold">Pitmaster Intelligence</p>
      </div>

      {view === 'home' && (
        <div className="flex flex-col gap-4 w-full max-w-md mt-10">
          <button onClick={() => { setView('scratch'); setShowEditor(true); }} className="p-6 bg-[#1E1E1E] border-2 border-gray-800 rounded-xl font-bold text-xl hover:border-[#FF4500] transition-all">FROM SCRATCH</button>
          <button onClick={() => { setView('premade'); setShowEditor(false); }} className="p-6 bg-[#1E1E1E] border-2 border-gray-800 rounded-xl font-bold text-xl hover:border-[#FF4500] transition-all">PREMADE</button>
          <button onClick={() => setView('vault')} className="p-6 bg-[#FF4500] rounded-xl font-bold text-xl mt-4 active:scale-95 transition-all">THE VAULT</button>
        </div>
      )}

      {view !== 'home' && (
        <div className="w-full max-w-6xl">
          <button onClick={() => { setView('home'); setShowEditor(false); setSelectedRecipe(null); }} className="text-gray-400 hover:text-white mb-6 font-bold uppercase text-xs tracking-widest">← BACK TO HUB</button>

          {view === 'vault' ? (
            <div className="flex flex-col md:flex-row gap-6 h-[75vh]">
              {/* VAULT SIDEBAR */}
              <div className="w-full md:w-1/3 flex flex-col gap-4">
                <input placeholder="Search vault..." className="bg-[#1A1A1A] border border-gray-800 p-3 rounded-lg outline-none focus:border-[#FF4500]" onChange={(e) => setSearchQuery(e.target.value)} />
                <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
                  {filteredVault.map(item => (
                    <div key={item.id} onClick={() => { setSelectedRecipe(item); setCheckedIngredients({}); }} className={`p-4 rounded-xl cursor-pointer border-2 transition-all ${selectedRecipe?.id === item.id ? 'border-[#FF4500] bg-[#252525]' : 'border-transparent bg-[#1A1A1A] hover:bg-[#252525]'}`}>
                      <h3 className="font-bold">{item.title}</h3>
                    </div>
                  ))}
                </div>
              </div>

              {/* VAULT VIEWER */}
              <div className="flex-1 bg-[#1A1A1A] rounded-2xl border border-gray-800 p-8 overflow-y-auto relative shadow-2xl">
                {selectedRecipe ? (
                  <div className="space-y-6">
                    <div className="flex justify-between items-start">
                      <h2 className="text-4xl font-black text-[#FF4500] uppercase italic tracking-tighter leading-none">{selectedRecipe.title}</h2>
                      <button onClick={copyToSheets} className="bg-emerald-600 px-4 py-2 rounded font-bold text-xs uppercase hover:bg-emerald-500 transition-all">Copy to Sheets</button>
                    </div>
                    <div className="space-y-3">
                      <h4 className="text-gray-500 font-bold uppercase text-xs border-b border-gray-800 pb-2">Ingredients Checklist</h4>
                      {selectedRecipe.ingredients.split('\n').map((ing, i) => (
                        <div key={i} className="flex items-center gap-3 p-1">
                          <input type="checkbox" checked={!!checkedIngredients[i]} onChange={(e) => setCheckedIngredients({...checkedIngredients, [i]: e.target.checked})} className="w-5 h-5 accent-[#FF4500]" />
                          <span className={checkedIngredients[i] ? 'text-white' : 'text-gray-500'}>{ing}</span>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-3 pt-4">
                      <h4 className="text-gray-500 font-bold uppercase text-xs border-b border-gray-800 pb-2">Directions</h4>
                      <p className="whitespace-pre-wrap text-gray-300 leading-relaxed">{selectedRecipe.directions}</p>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-gray-700 font-bold space-y-2">
                    <p className="text-3xl">🗄️</p>
                    <p className="uppercase tracking-widest text-sm">Select a recipe from the list</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* EDITOR (SCRATCH & PREMADE) */
            <div className="max-w-3xl mx-auto space-y-6">
              {view === 'premade' && !showEditor && (
                <div className="p-8 border border-gray-800 rounded-2xl bg-[#1A1A1A] space-y-6">
                  <h2 className="text-2xl font-bold text-[#FF4500]">PASTE RECIPE URL</h2>
                  <input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="https://..." className="w-full bg-[#121212] border border-gray-700 rounded p-4 outline-none focus:border-[#FF4500]" />
                  <button onClick={handleUrlScrape} className={`w-full p-4 bg-[#FF4500] font-bold rounded ${isProcessing ? 'animate-pulse' : ''}`}>
                    {isProcessing ? 'SCRAPING...' : 'FETCH & STREAM'}
                  </button>
                </div>
              )}

              {(view === 'scratch' || (view === 'premade' && showEditor)) && (
                <div className="p-8 border border-gray-800 rounded-2xl bg-[#1A1A1A] space-y-8 shadow-2xl">
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-500 uppercase tracking-widest leading-none">The Pit</h2>
                    <button onClick={() => setShowButcherBlock(!showButcherBlock)} className="text-[10px] bg-gray-800 px-3 py-1 rounded-full text-gray-400 hover:text-white transition-all uppercase font-bold">
                      {showButcherBlock ? "Close Butcher Block" : "+ Butcher Block (Bulk Paste)"}
                    </button>
                  </div>

                  {showButcherBlock && (
                    <div className="p-4 bg-[#121212] border border-[#FF4500]/50 rounded-lg space-y-4 animate-in fade-in zoom-in duration-200">
                      <textarea value={butcherInput} onChange={(e) => setButcherInput(e.target.value)} className="w-full h-32 bg-transparent outline-none text-sm text-gray-300" placeholder="Paste raw ingredients here..." />
                      <button onClick={processButcherBlock} className="w-full p-2 bg-white text-black font-bold text-[10px] rounded uppercase tracking-tighter">Transfer to Ingredients List</button>
                    </div>
                  )}

                  <div className="space-y-6">
                    <input value={recipe.title} onChange={(e) => setRecipe({...recipe, title: e.target.value})} placeholder="Recipe Title" className="w-full bg-transparent border-b border-gray-700 text-3xl font-bold p-2 outline-none focus:border-[#FF4500]" />
                    <div>
                      <label className="text-[10px] text-gray-600 font-bold uppercase ml-2">Ingredients</label>
                      <textarea value={recipe.ingredients} onChange={(e) => setRecipe({...recipe, ingredients: e.target.value})} className="w-full h-40 bg-[#121212] border border-gray-700 rounded p-4 mt-1 outline-none focus:border-[#FF4500]" />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-600 font-bold uppercase ml-2">Directions</label>
                      <textarea value={recipe.directions} onChange={(e) => setRecipe({...recipe, directions: e.target.value})} className="w-full h-40 bg-[#121212] border border-gray-700 rounded p-4 mt-1 outline-none focus:border-[#FF4500]" />
                    </div>
                    <button onClick={saveRecipe} className="w-full p-4 bg-emerald-600 rounded font-bold uppercase tracking-widest shadow-lg shadow-emerald-900/10">Save to Vault</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </main>
  );
}