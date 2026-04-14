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
  const [isEditing, setIsEditing] = useState(false);

  const toggleCookingMode = () => {
    setIsCookingMode(!isCookingMode);
    setIsEditing(false); 
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
    if (isEditing) {
      setSelectedRecipe({ ...selectedRecipe, ingredients: butcherInput });
    } else {
      setRecipe({ ...recipe, ingredients: butcherInput });
    }
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

  const updateRecipe = async () => {
    const { error } = await supabase
      .from('recipes')
      .update({ 
        title: selectedRecipe.title, 
        ingredients: selectedRecipe.ingredients, 
        directions: selectedRecipe.directions 
      })
      .eq('id', selectedRecipe.id);
    
    if (!error) {
      setIsEditing(false);
      fetchVault();
      alert("Recipe updated in Vault.");
    }
  };

  const deleteRecipe = async () => {
    if (confirm("Are you sure you want to BURN this recipe? It cannot be recovered.")) {
      const { error } = await supabase
        .from('recipes')
        .delete()
        .eq('id', selectedRecipe.id);
      
      if (!error) {
        setSelectedRecipe(null);
        fetchVault();
      }
    }
  };

  const filteredVault = vaultItems.filter(item => item.title.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <main className="flex h-screen flex-col items-center justify-start bg-[#0D0D0D] text-white p-6 font-sans overflow-hidden">
      
      {/* BRANDING HEADER */}
      <div className="mb-6 text-center flex flex-col items-center flex-shrink-0">
        <div className="flex items-center gap-4">
          <img src="/assets/pocket_steak_logo.png" alt="Logo" className="h-12 w-auto" />
          <h1 className="text-4xl font-black tracking-tighter text-[#FF4500] italic uppercase leading-none">PocketSteak</h1>
        </div>
        <p className="text-gray-600 uppercase tracking-[0.4em] text-[8px] font-black italic mt-1">Pitmaster Intelligence</p>
      </div>

      {view === 'home' && (
        <div className="w-full max-w-2xl flex flex-col gap-4 mt-10">
          <button onClick={() => setView('vault')} className="w-full p-8 bg-[#1A1A1A] border border-gray-800 rounded-2xl flex flex-col items-center gap-2 hover:border-[#FF4500] hover:bg-[#222222] transition-all group shadow-xl">
            <span className="text-[#FF4500] font-black text-3xl italic tracking-tighter uppercase group-hover:scale-105 transition-transform">Recipe Box</span>
            <span className="text-gray-500 text-xs uppercase font-bold tracking-widest">Access your secured recipes</span>
          </button>
          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => { setView('scratch'); setShowEditor(true); }} className="p-8 bg-[#1A1A1A] border border-gray-800 rounded-2xl flex flex-col text-left gap-3 hover:border-emerald-500/50 transition-all">
              <span className="text-white font-bold text-lg leading-none">From Scratch</span>
              <p className="text-gray-500 text-[11px] leading-tight">Type or paste ingredients and write your own directions.</p>
            </button>
            <button onClick={() => { setView('premade'); setShowEditor(false); }} className="p-8 bg-[#1A1A1A] border border-gray-800 rounded-2xl flex flex-col text-left gap-3 hover:border-[#FF4500]/50 transition-all">
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
        <div className="w-full max-w-6xl flex flex-col flex-1 overflow-hidden">
          <button onClick={() => { setView('home'); setShowEditor(false); setSelectedRecipe(null); setIsCookingMode(false); setIsEditing(false); }} className="text-gray-500 hover:text-white mb-4 font-bold uppercase text-[10px] tracking-[0.2em] transition-colors flex-shrink-0">← Back to Command Center</button>

          {view === 'vault' ? (
            <div className="flex flex-col md:flex-row gap-6 flex-1 overflow-hidden">
              {/* Sidebar */}
              <div className="w-full md:w-1/4 flex flex-col gap-4 overflow-hidden">
                <input placeholder="Search files..." className="bg-[#141414] border border-gray-800 p-3 rounded-lg outline-none focus:border-[#FF4500] text-sm flex-shrink-0" onChange={(e) => setSearchQuery(e.target.value)} />
                <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {filteredVault.map(item => (
                    <div key={item.id} onClick={() => { setSelectedRecipe(item); clearChecks(); setIsCookingMode(false); setIsEditing(false); }} className={`p-4 rounded-xl cursor-pointer border transition-all ${selectedRecipe?.id === item.id ? 'border-[#FF4500] bg-[#1A1A1A]' : 'border-transparent bg-[#141414] hover:bg-[#1A1A1A]'}`}>
                      <h3 className="font-bold text-sm truncate uppercase tracking-tight">{item.title}</h3>
                    </div>
                  ))}
                </div>
              </div>

              {/* Main Card */}
              <div className="flex-1 bg-[#141414] rounded-2xl border border-gray-800 flex flex-col overflow-hidden shadow-2xl">
                {selectedRecipe ? (
                  <>
                    <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-[#1A1A1A] flex-shrink-0">
                      <h2 className="text-xl font-black text-[#FF4500] uppercase italic tracking-tighter leading-none max-w-[50%]">{selectedRecipe.title}</h2>
                      <div className="flex gap-2">
                        {!isEditing && (
                          <button onClick={toggleCookingMode} className={`px-4 py-2 rounded-full font-black text-[9px] uppercase transition-all border ${isCookingMode ? 'bg-[#FF4500] border-[#FF4500] text-white' : 'bg-transparent border-gray-700 text-gray-500 hover:text-white'}`}>
                            {isCookingMode ? 'Exit Cooking Mode' : 'Enter Cooking Mode'}
                          </button>
                        )}
                        {!isCookingMode && (
                          <button onClick={() => setIsEditing(!isEditing)} className="px-4 py-2 rounded-full font-black text-[9px] uppercase border border-gray-700 text-gray-500 hover:border-white hover:text-white transition-all">
                            {isEditing ? 'Cancel Edit' : 'Edit Recipe'}
                          </button>
                        )}
                        {!isCookingMode && !isEditing && (
                          <button onClick={deleteRecipe} className="px-4 py-2 rounded-full font-black text-[9px] uppercase border border-red-900/50 text-red-900 hover:bg-red-900 hover:text-white transition-all">
                            Burn
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex-1 overflow-hidden p-6 relative">
                      {isEditing ? (
                        <div className="absolute inset-6 flex flex-col gap-4 overflow-hidden">
                          <input value={selectedRecipe.title} onChange={(e) => setSelectedRecipe({...selectedRecipe, title: e.target.value})} className="bg-transparent border-b border-gray-800 p-2 text-xl font-bold outline-none focus:border-[#FF4500] flex-shrink-0" />
                          <div className="grid grid-cols-2 gap-4 flex-1 overflow-hidden">
                            <div className="flex flex-col gap-2 overflow-hidden">
                              <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest flex-shrink-0">Ingredients</label>
                              <textarea value={selectedRecipe.ingredients} onChange={(e) => setSelectedRecipe({...selectedRecipe, ingredients: e.target.value})} className="flex-1 bg-[#0D0D0D] border border-gray-800 rounded-xl p-4 text-xs outline-none focus:border-[#FF4500] resize-none overflow-y-auto" />
                            </div>
                            <div className="flex flex-col gap-2 overflow-hidden">
                              <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest flex-shrink-0">Directions</label>
                              <textarea value={selectedRecipe.directions} onChange={(e) => setSelectedRecipe({...selectedRecipe, directions: e.target.value})} className="flex-1 bg-[#0D0D0D] border border-gray-800 rounded-xl p-4 text-xs outline-none focus:border-[#FF4500] resize-none overflow-y-auto" />
                            </div>
                          </div>
                          <button onClick={updateRecipe} className="w-full p-4 bg-emerald-700 text-white font-black uppercase tracking-widest rounded-xl hover:bg-emerald-600 transition-all flex-shrink-0">Update Secured File</button>
                        </div>
                      ) : isCookingMode ? (
                        <div className="absolute inset-6 overflow-y-auto pr-4 custom-scrollbar space-y-12">
                          <section>
                            <h4 className="text-[#FF4500] font-black uppercase text-xs tracking-widest mb-4">Prep Checklist</h4>
                            <div className="space-y-2">
                              {selectedRecipe.ingredients.split('\n').map((ing, i) => (
                                <div key={i} onClick={() => setCheckedIngredients({...checkedIngredients, [i]: !checkedIngredients[i]})} className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer border transition-all ${checkedIngredients[i] ? 'bg-black opacity-10 border-transparent scale-[0.98]' : 'bg-[#1A1A1A] border-gray-800'}`}>
                                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${checkedIngredients[i] ? 'bg-emerald-500 border-emerald-500' : 'border-gray-600'}`}>
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
                                <div key={i} onClick={() => setCheckedDirections({...checkedDirections, [i]: !checkedDirections[i]})} className={`p-6 rounded-2xl border-l-4 transition-all cursor-pointer ${checkedDirections[i] ? 'bg-black opacity-10 border-gray-900 scale-[0.98]' : 'bg-[#1A1A1A] border-[#FF4500]'}`}>
                                  <p className="text-lg leading-relaxed">{step}</p>
                                </div>
                              ))}
                            </div>
                          </section>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 h-full gap-8 overflow-hidden">
                          {/* Left Column */}
                          <div className="flex flex-col h-full border-r border-gray-800 pr-6 overflow-hidden">
                            <div className="flex justify-between items-center mb-6 flex-shrink-0">
                              <h4 className="text-gray-600 font-black uppercase text-[10px] tracking-widest">Ingredients</h4>
                              <div className="flex gap-2">
                                <button onClick={copyCheckedItems} className="text-[#FF4500] text-[10px] font-black uppercase hover:underline">Copy</button>
                                <span className="text-gray-800">/</span>
                                <button onClick={clearChecks} className="text-gray-500 text-[10px] font-black uppercase hover:text-white">Clear</button>
                              </div>
                            </div>
                            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar pb-10">
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
                          {/* Right Column */}
                          <div className="flex flex-col h-full pl-2 overflow-hidden">
                            <h4 className="text-gray-600 font-black uppercase text-[10px] tracking-widest mb-6 flex-shrink-0">Directions</h4>
                            <div className="flex-1 overflow-y-auto space-y-4 pr-2 text-gray-400 text-sm custom-scrollbar pb-10">
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
                    <div className="w-12 h-12 border-2 border-gray-800 rounded-full flex items-center justify-center animate-pulse text-lg">!</div>
                    <p className="uppercase tracking-[0.4em] text-[10px] font-black">Select Intel From Sidebar</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* SCRAPER / SCRATCH VIEW */
            <div className="max-w-xl mx-auto w-full overflow-y-auto custom-scrollbar flex-1 pb-10">
              {view === 'premade' && !showEditor && (
                <div className="p-10 border border-gray-800 rounded-3xl bg-[#141414] space-y-6 text-center shadow-2xl mt-10">
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
                    <div className="flex flex-col gap-4">
                      <div>
                        <label className="text-[9px] text-gray-700 font-black uppercase tracking-widest ml-1">Ingredients</label>
                        <textarea value={recipe.ingredients} onChange={(e) => setRecipe({...recipe, ingredients: e.target.value})} className="w-full h-48 bg-[#0D0D0D] border border-gray-800 rounded-xl p-4 mt-1 outline-none focus:border-[#FF4500] text-xs leading-relaxed" />
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-700 font-black uppercase tracking-widest ml-1">Directions</label>
                        <textarea value={recipe.directions} onChange={(e) => setRecipe({...recipe, directions: e.target.value})} className="w-full h-48 bg-[#0D0D0D] border border-gray-800 rounded-xl p-4 mt-1 outline-none focus:border-[#FF4500] text-xs leading-relaxed" />
                      </div>
                    </div>
                    <button onClick={saveRecipe} className="w-full p-4 bg-emerald-700/80 hover:bg-emerald-600 text-white rounded-xl font-black uppercase tracking-widest transition-all shadow-lg">Secure to Vault</button>
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