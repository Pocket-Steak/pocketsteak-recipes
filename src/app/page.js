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

  // Stopwatch Effect
  useEffect(() => {
    let int;
    if (swActive) {
      int = setInterval(() => setStopwatch(s => s + 1), 1000);
    }
    return () => clearInterval(int);
  }, [swActive]);

  // Countdown Effect + Sound Trigger
  useEffect(() => {
    let int;
    if (cdActive && countdown > 0) {
      int = setInterval(() => setCountdown(c => c - 1), 1000);
    } else if (countdown === 0 && cdActive) {
      setCdActive(false);
      playAlarm();
    }
    return () => clearInterval(int);
  }, [cdActive, countdown]);

  const playAlarm = () => {
    const alarm = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
    alarm.play().catch(e => console.log("Audio blocked. Interact with the page first."));
  };

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
      setRecipe({ title: data.title || "New Recipe", ingredients: Array.isArray(data.ingredients) ? data.ingredients.join('\n') : data.ingredients, directions: Array.isArray(data.directions) ? data.directions.join('\n') : data.directions });
      setShowEditor(true);
    } catch (err) { alert("Snag in the pit."); } finally { setIsProcessing(false); setUrlInput(''); }
  };

  const saveRecipe = async () => {
    const { error } = await supabase.from('recipes').insert([{ ...recipe, description: recipe.ingredients.substring(0, 50) }]);
    if (!error) { setView('home'); fetchVault(); }
  };

  const updateRecipe = async () => {
    const { error } = await supabase.from('recipes').update({ title: selectedRecipe.title, ingredients: selectedRecipe.ingredients, directions: selectedRecipe.directions }).eq('id', selectedRecipe.id);
    if (!error) { setIsEditing(false); fetchVault(); }
  };

  const deleteRecipe = async () => {
    if (confirm("BURN THIS RECIPE?")) {
      const { error } = await supabase.from('recipes').delete().eq('id', selectedRecipe.id);
      if (!error) { setSelectedRecipe(null); fetchVault(); }
    }
  };

  return (
    <main className="flex h-screen flex-col items-center justify-start bg-[#0D0D0D] text-white p-6 font-sans overflow-hidden">
      
      {/* HEADER */}
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
              <p className="text-gray-500 text-[11px]">Manual Intake</p>
            </button>
            <button onClick={() => { setView('premade'); setShowEditor(false); }} className="p-8 bg-[#1A1A1A] border border-gray-800 rounded-2xl flex flex-col text-left gap-3 hover:border-[#FF4500] transition-all">
              <span className="text-white font-bold text-lg leading-none">Chef's Special</span>
              <p className="text-gray-500 text-[11px]">Web Import</p>
            </button>
          </div>
        </div>
      )}

      {view !== 'home' && (
        <div className="w-full max-w-6xl flex flex-col flex-1 overflow-hidden">
          <button 
            onClick={() => { setView('home'); setSelectedRecipe(null); setIsCookingMode(false); }} 
            className="group mb-4 flex items-center gap-3 px-4 py-2 border border-gray-800 rounded-full bg-[#141414] hover:border-[#FF4500] transition-all w-fit flex-shrink-0"
          >
            <span className="text-gray-500 group-hover:text-[#FF4500] text-xs">←</span>
            <span className="text-gray-400 group-hover:text-white font-black uppercase text-[9px] tracking-[0.25em]">Back to Hub</span>
          </button>

          {view === 'vault' ? (
            <div className="flex flex-col md:flex-row gap-6 flex-1 overflow-hidden">
              <div className="w-full md:w-1/4 flex flex-col gap-4 overflow-hidden">
                <input placeholder="Search intel..." className="bg-[#141414] border border-gray-800 p-3 rounded-lg outline-none focus:border-[#FF4500] text-sm" onChange={(e) => setSearchQuery(e.target.value)} />
                <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {vaultItems.filter(i => i.title.toLowerCase().includes(searchQuery.toLowerCase())).map(item => (
                    <div key={item.id} onClick={() => { setSelectedRecipe(item); setIsCookingMode(false); }} className={`p-4 rounded-xl cursor-pointer border transition-all ${selectedRecipe?.id === item.id ? 'border-[#FF4500] bg-[#1A1A1A]' : 'border-transparent bg-[#141414] hover:bg-[#1A1A1A]'}`}>
                      <h3 className="font-bold text-sm truncate uppercase tracking-tight">{item.title}</h3>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex-1 bg-[#141414] rounded-2xl border border-gray-800 flex flex-col overflow-hidden shadow-2xl relative">
                {showTempHUD && (
                  <div className="absolute top-20 right-6 z-50 bg-black/95 border border-[#FF4500]/50 p-6 rounded-2xl shadow-2xl backdrop-blur-md w-64">
                    <div className="flex justify-between items-center mb-4 border-b border-gray-800 pb-2">
                      <span className="text-[#FF4500] font-black uppercase text-[10px] tracking-widest">Target Intel</span>
                      <button onClick={() => setShowTempHUD(false)}>✕</button>
                    </div>
                    <div className="space-y-4 text-[10px] font-mono">
                      <div><p className="text-gray-500 mb-1">Beef/Lamb</p><p>Rare: 125 | Med-R: 135 | Med: 145</p></div>
                      <div><p className="text-gray-500 mb-1">Poultry/Pork</p><p>Bird: 165 | Pork Loin: 145</p></div>
                    </div>
                  </div>
                )}

                {selectedRecipe ? (
                  <>
                    <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-[#1A1A1A] flex-shrink-0">
                      <h2 className="text-xl font-black text-[#FF4500] uppercase italic truncate leading-none max-w-[30%]">{selectedRecipe.title}</h2>
                      <div className="flex items-center gap-3">
                        {isCookingMode && (
                          <div className="flex items-center bg-black border border-gray-700 rounded-md overflow-hidden shadow-inner">
                            <div className="px-3 py-1 border-r border-gray-800 text-center">
                              <p className="text-[7px] text-gray-600 font-bold uppercase">Mission</p>
                              <p className="text-white font-mono text-xs">{formatTime(stopwatch)}</p>
                              <button onClick={() => setSwActive(!swActive)} className="text-[8px] font-black text-[#FF4500]">{swActive ? "PAUSE" : "GO"}</button>
                            </div>
                            <div className="px-3 py-1 text-center bg-[#0D0D0D]">
                              <p className="text-[7px] text-gray-600 font-bold uppercase">Countdown</p>
                              <p className={`font-mono text-xs ${countdown === 0 ? 'text-gray-500' : 'text-[#FF4500]'}`} onClick={() => !cdActive && setCountdown(c => c + 60)}>
                                {formatTime(countdown)}
                              </p>
                              <button onClick={() => { if(countdown > 0) setCdActive(!cdActive); }} className="text-[8px] font-black text-emerald-500">{cdActive ? "STOP" : "GO"}</button>
                            </div>
                            <button onClick={() => {setStopwatch(0); setSwActive(false); setCountdown(0); setCdActive(false);}} className="px-2 py-1 bg-gray-900 text-gray-600 hover:text-red-500 text-xs transition-colors font-bold">✕</button>
                          </div>
                        )}
                        <button onClick={() => setShowTempHUD(!showTempHUD)} className="px-3 py-1.5 rounded-full font-black text-[9px] border border-gray-700 text-gray-500 hover:text-[#FF4500]">Temps</button>
                        <button onClick={() => setIsCookingMode(!isCookingMode)} className={`px-4 py-1.5 rounded-full font-black text-[9px] border ${isCookingMode ? 'bg-[#FF4500] border-[#FF4500] text-white' : 'border-gray-700 text-gray-500'}`}>{isCookingMode ? 'Exit' : 'Cook'}</button>
                      </div>
                    </div>

                    <div className="flex-1 overflow-hidden p-6 relative">
                      {isCookingMode ? (
                        <div className="absolute inset-6 overflow-y-auto pr-4 custom-scrollbar space-y-12">
                          <section>
                            <h4 className="text-[#FF4500] font-black uppercase text-xs tracking-widest mb-4">Prep Checklist</h4>
                            <div className="space-y-2">
                              {selectedRecipe.ingredients.split('\n').map((ing, i) => (
                                <div key={i} onClick={() => setCheckedIngredients({...checkedIngredients, [i]: !checkedIngredients[i]})} className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer border transition-all ${checkedIngredients[i] ? 'bg-black opacity-10 border-transparent' : 'bg-[#1A1A1A] border-gray-800'}`}>
                                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${checkedIngredients[i] ? 'bg-emerald-500 border-emerald-500' : 'border-gray-600'}`}>{checkedIngredients[i] && '✓'}</div>
                                  <span className="text-lg">{ing}</span>
                                </div>
                              ))}
                            </div>
                          </section>
                          <section>
                            <h4 className="text-[#FF4500] font-black uppercase text-xs tracking-widest mb-4">The Process</h4>
                            <div className="space-y-4 pb-20">
                              {selectedRecipe.directions.split('\n').filter(d => d.trim()).map((step, i) => (
                                <div key={i} onClick={() => setCheckedDirections({...checkedDirections, [i]: !checkedDirections[i]})} className={`p-6 rounded-2xl border-l-4 transition-all cursor-pointer ${checkedDirections[i] ? 'bg-black opacity-10 border-gray-900' : 'bg-[#1A1A1A] border-[#FF4500]'}`}>
                                  <p className="text-lg leading-relaxed">{step}</p>
                                </div>
                              ))}
                            </div>
                          </section>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 h-full gap-8 overflow-hidden">
                          <div className="flex flex-col h-full border-r border-gray-800 pr-6 overflow-hidden">
                            <h4 className="text-gray-600 font-black uppercase text-[10px] tracking-widest mb-6">Ingredients</h4>
                            <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar">
                              {selectedRecipe.ingredients.split('\n').map((ing, i) => (
                                <div key={i} className="flex items-start gap-3 text-sm text-gray-300"><span>•</span>{ing}</div>
                              ))}
                            </div>
                          </div>
                          <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar text-sm text-gray-400">
                            <h4 className="text-gray-600 font-black uppercase text-[10px] tracking-widest mb-6">Directions</h4>
                            {selectedRecipe.directions.split('\n').filter(d => d.trim()).map((step, i) => (
                              <div key={i} className="flex gap-3"><span className="text-[#FF4500] font-black italic">{i + 1}</span>{step}</div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-800 uppercase font-black text-[10px] tracking-[0.5em] animate-pulse">Select intel from sidebar</div>
                )}
              </div>
            </div>
          ) : (
            <div className="max-w-xl mx-auto w-full flex-1 overflow-y-auto mt-10">
               <div className="p-10 border border-gray-800 rounded-3xl bg-[#141414] text-center shadow-2xl">
                  <h2 className="text-xl font-black text-[#FF4500] uppercase italic tracking-tighter mb-6">Chef's Special</h2>
                  <input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="PASTE URL HERE" className="w-full bg-[#0D0D0D] border border-gray-800 rounded-xl p-4 outline-none focus:border-[#FF4500] text-center font-bold mb-4" />
                  <button onClick={handleUrlScrape} className={`w-full p-4 bg-[#FF4500] text-white font-black rounded-xl hover:scale-[1.02] transition-all ${isProcessing ? 'animate-pulse' : ''}`}>{isProcessing ? 'PREPPING...' : 'PREPARE RECIPE'}</button>
                </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}