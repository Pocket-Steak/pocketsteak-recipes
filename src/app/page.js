'use client';

import { useState, useEffect, useRef } from 'react';
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
  const [showTempHUD, setShowTempHUD] = useState(false);

  // --- DUAL TIMER LOGIC ---
  const [stopwatch, setStopwatch] = useState(0);
  const [swActive, setSwActive] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [cdActive, setCdActive] = useState(false);

  useEffect(() => {
    let int;
    if (swActive) int = setInterval(() => setStopwatch(s => s + 1), 1000);
    return () => clearInterval(int);
  }, [swActive]);

  useEffect(() => {
    let int;
    if (cdActive && countdown > 0) {
      int = setInterval(() => setCountdown(c => c - 1), 1000);
    } else if (countdown === 0 && cdActive) {
      setCdActive(false);
      const alarm = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
      alarm.play().catch(() => console.log("Sound blocked by Safari."));
    }
    return () => clearInterval(int);
  }, [cdActive, countdown]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const fetchVault = async () => {
    const { data, error } = await supabase.from('recipes').select('*').order('created_at', { ascending: false });
    if (!error) setVaultItems(data);
  };

  useEffect(() => { if (view === 'vault') fetchVault(); }, [view]);

  const handleUrlScrape = async () => {
    if (!urlInput) return;
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('scrape-recipe', { body: { url: urlInput } });
      if (error) throw new Error(error.message);
      setRecipe({ 
        title: data.title || "New Intel", 
        ingredients: Array.isArray(data.ingredients) ? data.ingredients.join('\n') : data.ingredients, 
        directions: Array.isArray(data.directions) ? data.directions.join('\n') : data.directions 
      });
      setShowEditor(true);
    } catch (err) { alert("Snag in the pit."); } finally { setIsProcessing(false); setUrlInput(''); }
  };

  const processButcherBlock = () => {
    const target = isEditing ? selectedRecipe : recipe;
    const newIngredients = target.ingredients ? target.ingredients + '\n' + butcherInput : butcherInput;
    if (isEditing) setSelectedRecipe({...selectedRecipe, ingredients: newIngredients});
    else setRecipe({...recipe, ingredients: newIngredients});
    setButcherInput('');
    setShowButcherBlock(false);
  };

  const saveRecipe = async () => {
    const { error } = await supabase.from('recipes').insert([{ 
      title: recipe.title, 
      ingredients: recipe.ingredients, 
      directions: recipe.directions,
      description: recipe.ingredients.substring(0, 50) 
    }]);
    if (!error) { setView('home'); setShowEditor(false); fetchVault(); }
  };

  const updateRecipe = async () => {
    const { error } = await supabase.from('recipes').update({ 
      title: selectedRecipe.title, 
      ingredients: selectedRecipe.ingredients, 
      directions: selectedRecipe.directions 
    }).eq('id', selectedRecipe.id);
    if (!error) { setIsEditing(false); fetchVault(); alert("Vault Updated."); }
  };

  const deleteRecipe = async () => {
    if (confirm("BURN THIS RECIPE?")) {
      const { error } = await supabase.from('recipes').delete().eq('id', selectedRecipe.id);
      if (!error) { setSelectedRecipe(null); fetchVault(); }
    }
  };

  return (
    <main className="flex h-screen flex-col items-center justify-start bg-[#0D0D0D] text-white p-6 font-sans overflow-hidden">
      
      {/* BRANDING */}
      <div className="mb-6 text-center flex flex-col items-center flex-shrink-0">
        <div className="flex items-center gap-4">
          <img src="/assets/pocket_steak_logo.png" alt="Logo" className="h-12 w-auto" />
          <h1 className="text-4xl font-black tracking-tighter text-[#FF4500] italic uppercase leading-none">PocketSteak</h1>
        </div>
        <p className="text-gray-600 uppercase tracking-[0.4em] text-[8px] font-black italic mt-1">Pitmaster Intelligence</p>
      </div>

      {view === 'home' && (
        <div className="w-full max-w-2xl flex flex-col gap-4 mt-10">
          <button onClick={() => setView('vault')} className="w-full p-8 bg-[#1A1A1A] border border-gray-800 rounded-2xl flex flex-col items-center gap-2 hover:border-[#FF4500] transition-all group shadow-xl">
            <span className="text-[#FF4500] font-black text-3xl italic tracking-tighter uppercase group-hover:scale-105 transition-transform">Recipe Box</span>
            <span className="text-gray-500 text-xs uppercase font-bold tracking-widest">Access your secured recipes</span>
          </button>
          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => { setView('scratch'); setShowEditor(true); }} className="p-8 bg-[#1A1A1A] border border-gray-800 rounded-2xl flex flex-col text-left gap-3 hover:border-emerald-500 transition-all">
              <span className="text-white font-bold text-lg leading-none">From Scratch</span>
              <p className="text-gray-500 text-[11px] leading-tight">Type or paste ingredients and write your own directions.</p>
            </button>
            <button onClick={() => { setView('premade'); setShowEditor(false); }} className="p-8 bg-[#1A1A1A] border border-gray-800 rounded-2xl flex flex-col text-left gap-3 hover:border-[#FF4500] transition-all">
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
          {/* TACTICAL PILL BACK BUTTON */}
          <button onClick={() => { setView('home'); setSelectedRecipe(null); setIsCookingMode(false); setIsEditing(false); }} className="group mb-4 flex items-center gap-3 px-6 py-3 border border-gray-800 rounded-full bg-[#141414] hover:border-[#FF4500] transition-all w-fit shadow-lg">
            <span className="text-gray-500 group-hover:text-[#FF4500] text-sm font-bold">←</span>
            <span className="text-gray-400 group-hover:text-white font-black uppercase text-[10px] tracking-[0.2em]">Command Center</span>
          </button>

          {view === 'vault' ? (
            <div className="flex flex-col md:flex-row gap-6 flex-1 overflow-hidden">
              <div className="w-full md:w-1/4 flex flex-col gap-4 overflow-hidden">
                <input placeholder="Search files..." className="bg-[#141414] border border-gray-800 p-3 rounded-lg outline-none focus:border-[#FF4500] text-sm" onChange={(e) => setSearchQuery(e.target.value)} />
                <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {vaultItems.filter(i => i.title.toLowerCase().includes(searchQuery.toLowerCase())).map(item => (
                    <div key={item.id} onClick={() => { setSelectedRecipe(item); setIsCookingMode(false); setIsEditing(false); }} className={`p-4 rounded-xl cursor-pointer border transition-all ${selectedRecipe?.id === item.id ? 'border-[#FF4500] bg-[#1A1A1A]' : 'border-transparent bg-[#141414] hover:bg-[#1A1A1A]'}`}>
                      <h3 className="font-bold text-sm truncate uppercase tracking-tight">{item.title}</h3>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex-1 bg-[#141414] rounded-2xl border border-gray-800 flex flex-col overflow-hidden shadow-2xl relative">
                {selectedRecipe && (
                  <>
                    <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-[#1A1A1A] flex-shrink-0">
                      <h2 className="text-xl font-black text-[#FF4500] uppercase italic truncate max-w-[25%]">{selectedRecipe.title}</h2>
                      
                      {/* GIANT IPAD-READY TIMER CONSOLE */}
                      <div className="flex items-center gap-6">
                        {isCookingMode && (
                          <div className="flex items-stretch bg-black border-2 border-gray-800 rounded-xl overflow-hidden shadow-2xl scale-110">
                            <div className="px-6 py-2 border-r border-gray-800 bg-[#0A0A0A] flex flex-col items-center justify-center min-w-[100px]">
                              <span className="text-[8px] text-gray-500 font-black uppercase tracking-widest mb-1">Mission</span>
                              <span className="text-white font-mono text-xl font-bold">{formatTime(stopwatch)}</span>
                              <button onClick={() => setSwActive(!swActive)} className={`mt-1 text-[10px] font-black ${swActive ? 'text-amber-500' : 'text-emerald-500'}`}>{swActive ? "PAUSE" : "START"}</button>
                            </div>
                            <div className="px-6 py-2 bg-[#0F0F0F] flex flex-col items-center justify-center min-w-[100px]">
                              <span className="text-[8px] text-gray-500 font-black uppercase tracking-widest mb-1">Target</span>
                              <span onClick={() => !cdActive && setCountdown(c => c + 60)} className={`font-mono text-xl font-bold cursor-pointer ${countdown > 0 ? 'text-[#FF4500]' : 'text-gray-700'}`}>{formatTime(countdown)}</span>
                              <button onClick={() => countdown > 0 && setCdActive(!cdActive)} className={`mt-1 text-[10px] font-black ${cdActive ? 'text-amber-500' : 'text-emerald-500'}`}>{cdActive ? "STOP" : "GO"}</button>
                            </div>
                            <button onClick={() => {setStopwatch(0); setSwActive(false); setCountdown(0); setCdActive(false);}} className="px-4 bg-gray-900 text-gray-600 hover:text-red-500 font-black">✕</button>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <button onClick={() => setShowTempHUD(!showTempHUD)} className="px-4 py-2 rounded-full font-black text-[10px] border border-gray-700 text-gray-500 hover:text-[#FF4500]">Temps</button>
                          {!isEditing && (
                            <button onClick={() => setIsCookingMode(!isCookingMode)} className={`px-6 py-2 rounded-full font-black text-[10px] border ${isCookingMode ? 'bg-[#FF4500] border-[#FF4500] text-white' : 'border-gray-700 text-gray-500 hover:text-white'}`}>{isCookingMode ? 'Exit' : 'Cook'}</button>
                          )}
                          {!isCookingMode && (
                            <button onClick={() => setIsEditing(!isEditing)} className="px-4 py-2 rounded-full font-black text-[10px] border border-gray-700 text-gray-500 hover:text-white">{isEditing ? 'Cancel' : 'Edit'}</button>
                          )}
                          {!isCookingMode && !isEditing && (
                            <button onClick={deleteRecipe} className="px-4 py-2 rounded-full font-black text-[10px] border border-red-900/50 text-red-900 hover:bg-red-900 hover:text-white">Burn</button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 overflow-hidden p-6 relative">
                      {isEditing ? (
                        <div className="absolute inset-6 flex flex-col gap-4">
                          <input value={selectedRecipe.title} onChange={(e) => setSelectedRecipe({...selectedRecipe, title: e.target.value})} className="bg-transparent border-b border-gray-800 p-2 text-2xl font-bold outline-none focus:border-[#FF4500]" />
                          <div className="grid grid-cols-2 gap-4 flex-1 overflow-hidden">
                            <textarea value={selectedRecipe.ingredients} onChange={(e) => setSelectedRecipe({...selectedRecipe, ingredients: e.target.value})} className="bg-[#0D0D0D] border border-gray-800 rounded-xl p-4 text-xs outline-none focus:border-[#FF4500] overflow-y-auto" />
                            <textarea value={selectedRecipe.directions} onChange={(e) => setSelectedRecipe({...selectedRecipe, directions: e.target.value})} className="bg-[#0D0D0D] border border-gray-800 rounded-xl p-4 text-xs outline-none focus:border-[#FF4500] overflow-y-auto" />
                          </div>
                          <button onClick={updateRecipe} className="w-full p-4 bg-emerald-700 text-white font-black uppercase tracking-widest rounded-xl">Update File</button>
                        </div>
                      ) : isCookingMode ? (
                        <div className="absolute inset-6 overflow-y-auto custom-scrollbar space-y-12">
                          <section>
                            <h4 className="text-[#FF4500] font-black uppercase text-xs mb-4">Prep Checklist</h4>
                            <div className="space-y-3">
                              {selectedRecipe.ingredients.split('\n').map((ing, i) => (
                                <div key={i} onClick={() => setCheckedIngredients({...checkedIngredients, [i]: !checkedIngredients[i]})} className={`flex items-center gap-6 p-6 rounded-2xl border transition-all ${checkedIngredients[i] ? 'bg-black opacity-10 border-transparent' : 'bg-[#1A1A1A] border-gray-800'}`}>
                                  <div className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center ${checkedIngredients[i] ? 'bg-emerald-500 border-emerald-500' : 'border-gray-600'}`}>{checkedIngredients[i] && '✓'}</div>
                                  <span className="text-2xl font-medium">{ing}</span>
                                </div>
                              ))}
                            </div>
                          </section>
                          <section>
                            <h4 className="text-[#FF4500] font-black uppercase text-xs mb-4">The Process</h4>
                            <div className="space-y-6 pb-20">
                              {selectedRecipe.directions.split('\n').filter(d => d.trim()).map((step, i) => (
                                <div key={i} onClick={() => setCheckedDirections({...checkedDirections, [i]: !checkedDirections[i]})} className={`p-8 rounded-2xl border-l-8 transition-all ${checkedDirections[i] ? 'bg-black opacity-10 border-gray-900' : 'bg-[#1A1A1A] border-[#FF4500]'}`}>
                                  <p className="text-2xl leading-relaxed">{step}</p>
                                </div>
                              ))}
                            </div>
                          </section>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 h-full gap-8 overflow-hidden">
                          <div className="flex flex-col h-full border-r border-gray-800 pr-6 overflow-hidden">
                            <h4 className="text-gray-600 font-black uppercase text-[10px] mb-6">Ingredients</h4>
                            <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar">
                              {selectedRecipe.ingredients.split('\n').map((ing, i) => (
                                <div key={i} className="flex items-start gap-3 text-sm text-gray-300"><span>•</span>{ing}</div>
                              ))}
                            </div>
                          </div>
                          <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar text-sm text-gray-400">
                            <h4 className="text-gray-600 font-black uppercase text-[10px] mb-6">Directions</h4>
                            {selectedRecipe.directions.split('\n').filter(d => d.trim()).map((step, i) => (
                              <div key={i} className="flex gap-3"><span className="text-[#FF4500] font-black italic">{i + 1}</span>{step}</div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            /* FROM SCRATCH / PREMADE FORMS */
            <div className="max-w-xl mx-auto w-full flex-1 overflow-y-auto custom-scrollbar pb-10">
              {view === 'premade' && !showEditor && (
                <div className="p-10 border border-gray-800 rounded-3xl bg-[#141414] text-center mt-10 shadow-2xl">
                  <h2 className="text-xl font-black text-[#FF4500] uppercase italic tracking-tighter mb-6">Chef's Special</h2>
                  <input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="PASTE URL HERE" className="w-full bg-[#0D0D0D] border border-gray-800 rounded-xl p-4 outline-none focus:border-[#FF4500] text-center font-bold mb-4" />
                  <button onClick={handleUrlScrape} className={`w-full p-4 bg-[#FF4500] text-white font-black rounded-xl ${isProcessing ? 'animate-pulse' : ''}`}>{isProcessing ? 'PREPPING...' : 'PREPARE RECIPE'}</button>
                </div>
              )}

              {(view === 'scratch' || (view === 'premade' && showEditor)) && (
                <div className="p-8 border border-gray-800 rounded-3xl bg-[#141414] shadow-2xl space-y-6">
                  <div className="flex justify-between items-center border-b border-gray-800 pb-4">
                    <h2 className="text-xs font-black text-gray-600 uppercase tracking-widest">Recipe Intake Form</h2>
                    <button onClick={() => setShowButcherBlock(!showButcherBlock)} className="text-[9px] bg-gray-800 px-3 py-1 rounded-full text-gray-400 hover:text-white transition-all uppercase font-black tracking-widest">
                      {showButcherBlock ? "- Hide Butcher" : "+ Butcher Block"}
                    </button>
                  </div>

                  {showButcherBlock && (
                    <div className="p-4 bg-[#0D0D0D] border border-gray-800 rounded-xl space-y-4">
                      <textarea value={butcherInput} onChange={(e) => setButcherInput(e.target.value)} className="w-full h-32 bg-transparent outline-none text-xs text-gray-500" placeholder="Dump raw text here..." />
                      <button onClick={processButcherBlock} className="w-full p-2 bg-white text-black font-black text-[9px] rounded uppercase">Butcher & Transfer</button>
                    </div>
                  )}

                  <input value={recipe.title} onChange={(e) => setRecipe({...recipe, title: e.target.value})} placeholder="RECIPE NAME" className="w-full bg-transparent border-b border-gray-800 text-3xl font-black p-2 outline-none focus:border-[#FF4500] uppercase italic" />
                  <div className="grid grid-cols-2 gap-4">
                    <textarea value={recipe.ingredients} onChange={(e) => setRecipe({...recipe, ingredients: e.target.value})} placeholder="INGREDIENTS (One per line)" className="w-full h-48 bg-[#0D0D0D] border border-gray-800 rounded-xl p-4 text-xs outline-none focus:border-[#FF4500]" />
                    <textarea value={recipe.directions} onChange={(e) => setRecipe({...recipe, directions: e.target.value})} placeholder="DIRECTIONS" className="w-full h-48 bg-[#0D0D0D] border border-gray-800 rounded-xl p-4 text-xs outline-none focus:border-[#FF4500]" />
                  </div>
                  <button onClick={saveRecipe} className="w-full p-4 bg-emerald-700/80 hover:bg-emerald-600 text-white rounded-xl font-black uppercase tracking-widest transition-all">Secure to Vault</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </main>
  );
}