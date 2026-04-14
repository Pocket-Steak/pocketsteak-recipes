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

  // RESET LOGIC: Clears checkboxes when switching views
  const toggleCookingMode = () => {
    setIsCookingMode(!isCookingMode);
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
      alert("The Pit hit a snag.");
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
    } else {
      alert("Check some ingredients first!");
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
          <button onClick={() => { setView('home'); setShowEditor(false); setSelectedRecipe(null); setIsCookingMode(false); }} className="text-gray-400 hover:text-white mb-6 font-bold uppercase text-xs tracking-widest">← BACK TO HUB</button>

          {view === 'vault' ? (
            <div className="flex flex-col md:flex-row gap-6 h-[75vh]">
              {/* Sidebar */}
              <div className="w-full md:w-1/4 flex flex-col gap-4">
                <input placeholder="Search vault..." className="bg-[#1A1A1A] border border-gray-800 p-3 rounded-lg outline-none focus:border-[#FF4500]" onChange={(e) => setSearchQuery(e.target.value)} />
                <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {filteredVault.map(item => (
                    <div key={item.id} onClick={() => { setSelectedRecipe(item); setCheckedIngredients({}); setCheckedDirections({}); setIsCookingMode(false); }} className={`p-4 rounded-xl cursor-pointer border-2 transition-all ${selectedRecipe?.id === item.id ? 'border-[#FF4500] bg-[#252525]' : 'border-transparent bg-[#1A1A1A] hover:bg-[#252525]'}`}>
                      <h3 className="font-bold truncate">{item.title}</h3>
                    </div>
                  ))}
                </div>
              </div>

              {/* Main Recipe Area */}
              <div className="flex-1 bg-[#1A1A1A] rounded-2xl border border-gray-800 flex flex-col overflow-hidden shadow-2xl relative">
                {selectedRecipe ? (
                  <>
                    <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-[#1e1e1e]">
                      <h2 className="text-3xl font-black text-[#FF4500] uppercase italic tracking-tighter">{selectedRecipe.title}</h2>
                      <button onClick={toggleCookingMode} className={`px-4 py-2 rounded font-bold text-xs uppercase transition-all ${isCookingMode ? 'bg-[#FF4500] text-white shadow-lg shadow-[#FF4500]/20' : 'bg-gray-800 text-gray-400'}`}>
                        {isCookingMode ? 'Exit Cooking Mode' : 'Cooking Mode'}
                      </button>
                    </div>

                    <div className="flex-1 overflow-hidden p-6">
                      {isCookingMode ? (
                        /* COOKING MODE: STACKED & DIMMABLE */
                        <div className="h-full overflow-y-auto space-y-12 pr-4 custom-scrollbar">
                          <section>
                            <h4 className="text-[#FF4500] font-black uppercase text-sm tracking-[0.2em] mb-4">Phase 1: Prep Ingredients</h4>
                            <div className="space-y-2">
                              {selectedRecipe.ingredients.split('\n').map((ing, i) => (
                                <div key={i} onClick={() => setCheckedIngredients({...checkedIngredients, [i]: !checkedIngredients[i]})} className={`flex items-center gap-4 p-4 rounded-lg cursor-pointer border transition-all ${checkedIngredients[i] ? 'bg-black/40 border-transparent opacity-20 scale-[0.98]' : 'bg-[#252525] border-gray-800 hover:border-gray-600'}`}>
                                  <div className={`w-6 h-6 rounded flex items-center justify-center border-2 transition-colors ${checkedIngredients[i] ? 'bg-emerald-500 border-emerald-500' : 'border-gray-600'}`}>
                                    {checkedIngredients[i] && <span className="text-white text-xs font-bold">✓</span>}
                                  </div>
                                  <span className="text-lg font-medium">{ing}</span>
                                </div>
                              ))}
                            </div>
                          </section>
                          <section>
                            <h4 className="text-[#FF4500] font-black uppercase text-sm tracking-[0.2em] mb-4">Phase 2: Execution</h4>
                            <div className="space-y-4">
                              {selectedRecipe.directions.split('\n').filter(d => d.trim()).map((step, i) => (
                                <div key={i} onClick={() => setCheckedDirections({...checkedDirections, [i]: !checkedDirections[i]})} className={`p-6 rounded-xl border-l-8 transition-all cursor-pointer ${checkedDirections[i] ? 'bg-black/40 border-gray-800 opacity-10 scale-[0.97]' : 'bg-[#252525] border-[#FF4500] hover:bg-[#2a2a2a]'}`}>
                                  <p className="text-lg leading-relaxed">{step}</p>
                                </div>
                              ))}
                            </div>
                          </section>
                        </div>
                      ) : (
                        /* CARD VIEW: SPLIT SCREEN */
                        <div className="grid grid-cols-2 h-full gap-8">
                          {/* Ingredients */}
                          <div className="flex flex-col h-full border-r border-gray-800 pr-4">
                            <div className="flex justify-between items-center mb-4">
                              <h4 className="text-gray-500 font-bold uppercase text-[10px] tracking-widest">Ingredients</h4>
                              <button onClick={copyCheckedItems} className="text-[#FF4500] text-[10px] font-black uppercase border border-[#FF4500]/30 px-2 py-1 rounded hover:bg-[#FF4500]/10 transition-all">
                                Copy Checked
                              </button>
                            </div>
                            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                              {selectedRecipe.ingredients.split('\n').map((ing, i) => (
                                <div key={i} className="flex items-start gap-3 group cursor-pointer" onClick={() => setCheckedIngredients({...checkedIngredients, [i]: !checkedIngredients[i]})}>
                                  <div className={`mt-0.5 w-5 h-5 flex-shrink-0 border-2 rounded transition-all flex items-center justify-center ${checkedIngredients[i] ? 'bg-[#FF4500] border-[#FF4500]' : 'border-gray-700 group-hover:border-[#FF4500]/50'}`}>
                                    {checkedIngredients[i] && <span className="text-[10px] font-bold">✓</span>}
                                  </div>
                                  <span className={`text-sm leading-tight transition-all ${checkedIngredients[i] ? 'text-gray-600 italic' : 'text-gray-300'}`}>{ing}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Directions */}
                          <div className="flex flex-col h-full pl-4">
                            <h4 className="text-gray-500 font-bold uppercase text-[10px] tracking-widest mb-4">Directions</h4>
                            <div className="flex-1 overflow-y-auto space-y-4 pr-2 text-gray-300 custom-scrollbar">
                              {selectedRecipe.directions.split('\n').filter(d => d.trim()).map((step, i) => (
                                <div key={i} className="flex gap-4">
                                  <span className="text-[#FF4500] font-black text-xs mt-1">{i + 1}.</span>
                                  <p className="text-sm leading-relaxed">{step}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-gray-700 font-bold space-y-2">
                    <p className="text-5xl">🔥</p>
                    <p className="uppercase tracking-[0.3em] text-xs">Awaiting Orders</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* EDITOR VIEW */
            <div className="max-w-3xl mx-auto space-y-6">
              {view === 'premade' && !showEditor && (
                <div className="p-8 border border-gray-800 rounded-2xl bg-[#1A1A1A] space-y-6">
                  <h2 className="text-2xl font-bold text-[#FF4500]">PASTE RECIPE URL</h2>
                  <input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="https://..." className="w-full bg-[#121212] border border-gray-700 rounded p-4 outline-none focus:border-[#FF4500]" />
                  <button onClick={handleUrlScrape} className={`w-full p-4 bg-[#FF4500] font-bold rounded ${isProcessing ? 'animate-pulse' : ''}`}>
                    {isProcessing ? 'SCANNING...' : 'FETCH & STREAM'}
                  </button>
                </div>
              )}

              {(view === 'scratch' || (view === 'premade' && showEditor)) && (
                <div className="p-8 border border-gray-800 rounded-2xl bg-[#1A1A1A] space-y-8 shadow-2xl">
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-500 uppercase tracking-widest leading-none">The Pit Editor</h2>
                    <button onClick={() => setShowButcherBlock(!showButcherBlock)} className="text-[10px] bg-gray-800 px-3 py-1 rounded-full text-gray-400 hover:text-white transition-all uppercase font-bold">
                      {showButcherBlock ? "Close Butcher Block" : "+ Butcher Block"}
                    </button>
                  </div>

                  {showButcherBlock && (
                    <div className="p-4 bg-[#121212] border border-[#FF4500]/50 rounded-lg space-y-4">
                      <textarea value={butcherInput} onChange={(e) => setButcherInput(e.target.value)} className="w-full h-32 bg-transparent outline-none text-sm text-gray-300" placeholder="Paste raw ingredients here..." />
                      <button onClick={processButcherBlock} className="w-full p-2 bg-white text-black font-bold text-[10px] rounded uppercase tracking-tighter">Transfer to Ingredients</button>
                    </div>
                  )}

                  <div className="space-y-6">
                    <input value={recipe.title} onChange={(e) => setRecipe({...recipe, title: e.target.value})} placeholder="Recipe Title" className="w-full bg-transparent border-b border-gray-700 text-3xl font-bold p-2 outline-none focus:border-[#FF4500]" />
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="text-[10px] text-gray-600 font-bold uppercase ml-2">Ingredients</label>
                        <textarea value={recipe.ingredients} onChange={(e) => setRecipe({...recipe, ingredients: e.target.value})} className="w-full h-64 bg-[#121212] border border-gray-700 rounded p-4 mt-1 outline-none focus:border-[#FF4500] text-sm leading-relaxed" />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-600 font-bold uppercase ml-2">Directions</label>
                        <textarea value={recipe.directions} onChange={(e) => setRecipe({...recipe, directions: e.target.value})} className="w-full h-64 bg-[#121212] border border-gray-700 rounded p-4 mt-1 outline-none focus:border-[#FF4500] text-sm leading-relaxed" />
                      </div>
                    </div>
                    <button onClick={saveRecipe} className="w-full p-4 bg-emerald-600 rounded font-bold uppercase tracking-widest hover:bg-emerald-500 transition-all">Save to Vault</button>
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