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
  const [checkedDirections, setCheckedDirections] = useState({});
  const [isCookingMode, setIsCookingMode] = useState(false);

  // RESET LOGIC
  const toggleCookingMode = () => {
    setIsCookingMode(!isCookingMode);
    setCheckedIngredients({});
    setCheckedDirections({});
  };

  const clearChecks = () => {
    setCheckedIngredients({});
    setCheckedDirections({});
  };

  const streamText = (field, text) => {
    if (!text) return;
    let i = 0;
    const interval = setInterval(() => {
      setRecipe(prev => ({ ...prev, [field]: text.slice(0, i) }));
      i++;
      if (i > text.length) clearInterval(interval);
    }, 5); 
  };

  const fetchVault = async () => {
    const { data, error } = await supabase.from('recipes').select('*').order('created_at', { ascending: false });
    if (!error) setVaultItems(data);
  };

  useEffect(() => {
    if (view === 'vault') fetchVault();
  }, [view]);

  const handleUrlScrape = async () => {
    if (!urlInput) return;
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('scrape-recipe', {
        body: { url: urlInput },
      });
      if (error) throw new Error(error.message || "Failed to scrape");

      setRecipe({ title: '', ingredients: '', directions: '' });
      setShowEditor(true);

      const rawTitle = data.title || data.Title || "New Recipe Found";
      const rawIngredients = data.ingredients || data.Ingredients || "";
      const rawDirections = data.directions || data.Directions || "";

      const cleanIngredients = Array.isArray(rawIngredients) ? rawIngredients.join('\n') : rawIngredients;
      const cleanDirections = Array.isArray(rawDirections) ? rawDirections.join('\n') : rawDirections;

      streamText('title', rawTitle);
      setTimeout(() => streamText('ingredients', cleanIngredients || "No ingredients found."), 500);
      setTimeout(() => streamText('directions', cleanDirections || "No directions found."), 1200);
    } catch (err) {
      console.error("Scrape failed:", err);
      alert("Snag in the pit.");
    } finally {
      setIsProcessing(false);
      setUrlInput('');
    }
  };

  const processButcherBlock = () => {
    setRecipe({ ...recipe, ingredients: butcherInput });
    setButcherInput('');
    setShowButcherBlock(false);
  };

  const copyCheckedItems = () => {
    const list = selectedRecipe.ingredients.split('\n')
      .filter((_, index) => checkedIngredients[index])
      .join('\n');
    if (list) {
      navigator.clipboard.writeText(list);
      alert("Copied checked items!");
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
    <main className="flex min-h-screen flex-col items-center justify-start bg-[#0D0D0D] text-white p-6 font-sans">
      
      {/* BRANDING HEADER */}
      <div className="my-10 text-center flex flex-col items-center">
        <img src="/assets/pocket_steak_logo.png" alt="PocketSteak Logo" className="h-24 w-auto mb-2" />
        <p className="text-gray-600 uppercase tracking-[0.4em] text-[10px] font-black italic">Pitmaster Intelligence</p>
      </div>

      {view === 'home' && (
        <div className="w-full max-w-2xl flex flex-col gap-4">
          {/* TOP PRIMARY BUTTON */}
          <button 
            onClick={() => setView('vault')} 
            className="w-full p-8 bg-[#1A1A1A] border border-gray-800 rounded-2xl flex flex-col items-center gap-2 hover:border-[#FF4500] hover:bg-[#222222] transition-all group shadow-xl"
          >
            <span className="text-[#FF4500] font-black text-3xl italic tracking-tighter uppercase group-hover:scale-105 transition-transform">Recipe Box</span>
            <span className="text-gray-500 text-xs uppercase font-bold tracking-widest">Access your secured recipes</span>
          </button>

          {/* BOTTOM GRID */}
          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={() => { setView('scratch'); setShowEditor(true); }} 
              className="p-8 bg-[#1A1A1A] border border-gray-800 rounded-2xl flex flex-col text-left gap-3 hover:border-emerald-500/50 transition-all"
            >
              <span className="text-white font-bold text-lg leading-none">From Scratch</span>
              <p className="text-gray-500 text-[11px] leading-tight">Type or paste ingredients and write your own directions.</p>
            </button>

            <button 
              onClick={() => { setView('premade'); setShowEditor(false); }} 
              className="p-8 bg-[#1A1A1A] border border-gray-800 rounded-2xl flex flex-col text-left gap-3 hover:border-[#FF4500]/50 transition-all"
            >
              <div className="flex flex-col">
                <span className="text-white font-bold text-lg leading-none">Chef's Special</span>
                <span className="text-[#FF4500] text-[9px] font-black uppercase tracking-tighter">Import from Web</span>
              </div>
              <p className="text-gray-500 text-[11px] leading-tight">Paste a recipe link and let the chef prepare it for you.</p>
            </button>
          </div>
        </div>
      )}

      {view !== 'home' && (
        <div className="w-full max-w-6xl">
          <button onClick={() => { setView('home'); setShowEditor(false); setSelectedRecipe(null); setIsCookingMode(false); }} className="text-gray-500 hover:text-white mb-6 font-bold uppercase text-[10px] tracking-[0.2em] transition-colors">← Back to Command Center</button>

          {view === 'vault' ? (
            <div className="flex flex-col md:flex-row gap-6 h-[72vh]">
              {/* Sidebar */}
              <div className="w-full md:w-1/4 flex flex-col gap-4">
                <input placeholder="Search files..." className="bg-[#141414] border border-gray-800 p-3 rounded-lg outline-none focus:border-[#FF4500] text-sm" onChange={(e) => setSearchQuery(e.target.value)} />
                <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {filteredVault.map(item => (
                    <div key={item.id} onClick={() => { setSelectedRecipe(item); clearChecks(); setIsCookingMode(false); }} className={`p-4 rounded-xl cursor-pointer border transition-all ${selectedRecipe?.id === item.id ? 'border-[#FF4500] bg-[#1A1A1A]' : 'border-transparent bg-[#141414] hover:bg-[#1A1A1A]'}`}>
                      <h3 className="font-bold text-sm truncate uppercase tracking-tight">{item.title}</h3>
                    </div>
                  ))}
                </div>
              </div>

              {/* Card Area */}
              <div className="flex-1 bg-[#141414] rounded-2xl border border-gray-800 flex flex-col overflow-hidden shadow-2xl">
                {selectedRecipe ? (
                  <>
                    <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-[#1A1A1A]">
                      <h2 className="text-2xl font-black text-[#FF4500] uppercase italic tracking-tighter">{selectedRecipe.title}</h2>
                      <button onClick={toggleCookingMode} className={`px-4 py-2 rounded-full font-black text-[10px] uppercase transition-all border ${isCookingMode ? 'bg-[#FF4500] border-[#FF4500] text-white' : 'bg-transparent border-gray-700 text-gray-500 hover:text-white'}`}>
                        {isCookingMode ? 'Exit Cooking Mode' : 'Enter Cooking Mode'}
                      </button>
                    </div>

                    <div className="flex-1 overflow-hidden p-6">
                      {isCookingMode ? (
                        <div className="h-full overflow-y-auto space-y-12 pr-4 custom-scrollbar">
                          <section>
                            <h4 className="text-[#FF4500] font-black uppercase text-xs tracking-widest mb-4">Prep Checklist</h4>
                            <div className="space-y-2">
                              {selectedRecipe.ingredients.split('\n').map((ing, i) => (
                                <div key={i} onClick={() => setCheckedIngredients({...checkedIngredients, [i]: !checkedIngredients[i]})} className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer border transition-all ${checkedIngredients[i] ? 'bg-black opacity-10 border-transparent' : 'bg-[#1A1A1A] border-gray-800'}`}>
                                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${checkedIngredients[i] ? 'bg-emerald-500 border-emerald-500' : 'border-gray-600'}`}>
                                    {checkedIngredients[i] && '✓'}
                                  </div>
                                  <span className="text-lg">{ing}</span>
                                </div>
                              ))}
                            </div>
                          </section>
                          <section>
                            <h4 className="text-[#FF4500] font-black uppercase text-xs tracking-widest mb-4">The Process</h4>
                            <div className="space-y-4">
                              {selectedRecipe.directions.split('\n').filter(d => d.trim()).map((step, i) => (
                                <div key={i} onClick={() => setCheckedDirections({...checkedDirections, [i]: !checkedDirections[i]})} className={`p-6 rounded-2xl border-l-4 transition-all cursor-pointer ${checkedDirections[i] ? 'bg-black opacity-10 border-gray-900' : 'bg-[#1A1A1A] border-[#FF4500]'}`}>
                                  <p className="text-lg leading-relaxed">{step}</p>
                                </div>
                              ))}
                            </div>
                          </section>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 h-full gap-8">
                          <div className="flex flex-col h-full border-r border-gray-800 pr-6">
                            <div className="flex justify-between items-center mb-6">
                              <h4 className="text-gray-600 font-black uppercase text-[10px] tracking-widest">Ingredients</h4>
                              <div className="flex gap-2">
                                <button onClick={copyCheckedItems} className="text-[#FF4500] text-[10px] font-black uppercase hover:underline">Copy</button>
                                <span className="text-gray-800">/</span>
                                <button onClick={clearChecks} className="text-gray-500 text-[10px] font-black uppercase hover:text-white">Clear</button>
                              </div>
                            </div>
                            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                              {selectedRecipe.ingredients.split('\n').map((ing, i) => (
                                <div key={i} className="flex items-start gap-3 cursor-pointer group" onClick={() => setCheckedIngredients({...checkedIngredients, [i]: !checkedIngredients[i]})}>
                                  <div className={`mt-0.5 w-4 h-4 flex-shrink-0 border rounded transition-all flex items-center justify-center ${checkedIngredients[i] ? 'bg-[#FF4500] border-[#FF4500]' : 'border-gray-700 group-hover:border-gray-500'}`}>
                                    {checkedIngredients[i] && <span className="text-[8px] font-bold">✓</span>}
                                  </div>
                                  <span className={`text-sm leading-tight transition-all ${checkedIngredients[i] ? 'text-gray-700 line-through' : 'text-gray-300'}`}>{ing}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="flex flex-col h-full pl-2">
                            <h4 className="text-gray-600 font-black uppercase text-[10px] tracking-widest mb-6">Directions</h4>
                            <div className="flex-1 overflow-y-auto space-y-4 pr-2 text-gray-400 text-sm custom-scrollbar">
                              {selectedRecipe.directions.split('\n').filter(d => d.trim()).map((step, i) => (
                                <div key={i} className="flex gap-3">
                                  <span className="text-[#FF4500] font-black italic">{i + 1}</span>
                                  <p className="leading-relaxed">{step}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-gray-800 space-y-4">
                    <div className="w-12 h-12 border-2 border-gray-800 rounded-full flex items-center justify-center animate-pulse">!</div>
                    <p className="uppercase tracking-[0.4em] text-[10px] font-black">Select Intel From Sidebar</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="max-w-xl mx-auto space-y-6">
              {view === 'premade' && !showEditor && (
                <div className="p-10 border border-gray-800 rounded-3xl bg-[#141414] space-y-6 text-center shadow-2xl">
                  <h2 className="text-xl font-black text-[#FF4500] uppercase italic tracking-tighter">Chef's Special</h2>
                  <input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="PASTE URL HERE" className="w-full bg-[#0D0D0D] border border-gray-800 rounded-xl p-4 outline-none focus:border-[#FF4500] text-center font-bold" />
                  <button onClick={handleUrlScrape} className={`w-full p-4 bg-[#FF4500] text-white font-black rounded-xl hover:scale-[1.02] transition-all ${isProcessing ? 'animate-pulse' : ''}`}>
                    {isProcessing ? 'PLEASE WAIT, YOUR ORDER IS BEING PREPPED...' : 'PREPARE RECIPE'}
                  </button>
                </div>
              )}

              {(view === 'scratch' || (view === 'premade' && showEditor)) && (
                <div className="p-8 border border-gray-800 rounded-3xl bg-[#141414] space-y-6 shadow-2xl">
                  <div className="flex justify-between items-center border-b border-gray-800 pb-4">
                    <h2 className="text-xs font-black text-gray-600 uppercase tracking-widest">Recipe Intake Form</h2>
                    <button onClick={() => setShowButcherBlock(!showButcherBlock)} className="text-[9px] bg-gray-800 px-3 py-1 rounded-full text-gray-400 hover:text-white transition-all uppercase font-black tracking-widest">
                      {showButcherBlock ? "- Hide Butcher" : "+ Butcher Block"}
                    </button>
                  </div>

                  {showButcherBlock && (
                    <div className="p-4 bg-[#0D0D0D] border border-gray-800 rounded-xl space-y-4">
                      <textarea value={butcherInput} onChange={(e) => setButcherInput(e.target.value)} className="w-full h-32 bg-transparent outline-none text-xs text-gray-500" placeholder="Dump raw ingredients text here..." />
                      <button onClick={processButcherBlock} className="w-full p-2 bg-white text-black font-black text-[9px] rounded uppercase tracking-widest">Butcher & Transfer</button>
                    </div>
                  )}

                  <div className="space-y-6">
                    <input value={recipe.title} onChange={(e) => setRecipe({...recipe, title: e.target.value})} placeholder="RECIPE NAME" className="w-full bg-transparent border-b border-gray-800 text-3xl font-black p-2 outline-none focus:border-[#FF4500] uppercase tracking-tighter italic" />
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[9px] text-gray-700 font-black uppercase tracking-widest ml-1">Ingredients</label>
                        <textarea value={recipe.ingredients} onChange={(e) => setRecipe({...recipe, ingredients: e.target.value})} className="w-full h-64 bg-[#0D0D0D] border border-gray-800 rounded-xl p-4 mt-1 outline-none focus:border-[#FF4500] text-xs leading-relaxed" />
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-700 font-black uppercase tracking-widest ml-1">Directions</label>
                        <textarea value={recipe.directions} onChange={(e) => setRecipe({...recipe, directions: e.target.value})} className="w-full h-64 bg-[#0D0D0D] border border-gray-800 rounded-xl p-4 mt-1 outline-none focus:border-[#FF4500] text-xs leading-relaxed" />
                      </div>
                    </div>
                    <button onClick={saveRecipe} className="w-full p-4 bg-emerald-700/80 hover:bg-emerald-600 text-white rounded-xl font-black uppercase tracking-widest transition-all">Secure to Vault</button>
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