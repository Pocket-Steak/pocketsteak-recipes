'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

const emptyRecipe = { title: '', ingredients: '', directions: '', notes: '' };

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Home() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authActionLoading, setAuthActionLoading] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [view, setView] = useState('vault');
  const [urlInput, setUrlInput] = useState('');
  const [butcherInput, setButcherInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [recipe, setRecipe] = useState(emptyRecipe);
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
  const [showRefHUD, setShowRefHUD] = useState(false);

  // Timer States
  const [stopwatch, setStopwatch] = useState(0);
  const [swActive, setSwActive] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [cdActive, setCdActive] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadSession = async () => {
      try {
        const { data } = await Promise.race([
          supabase.auth.getSession(),
          new Promise((resolve) => setTimeout(() => resolve({ data: { session: null } }), 2000))
        ]);

        if (!mounted) return;
        setUser(data.session?.user ?? null);
      } catch {
        if (!mounted) return;
        setUser(null);
      } finally {
        if (mounted) setAuthLoading(false);
      }
    };

    loadSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === 'PASSWORD_RECOVERY') setIsPasswordRecovery(true);
      if (!session?.user) {
        setVaultItems([]);
        setSelectedRecipe(null);
        setView('vault');
        setRecipe(emptyRecipe);
        setIsCookingMode(false);
        setIsEditing(false);
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

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
      alarm.play().catch(() => console.log("Sound blocked."));
    }
    return () => clearInterval(int);
  }, [cdActive, countdown]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const fetchVault = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      alert(`Unable to load recipes: ${error.message}`);
      return;
    }

    if (!error) setVaultItems(data);
  }, [user]);

  useEffect(() => { if (user && view === 'vault') fetchVault(); }, [user, view, fetchVault]);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    if (!authEmail || !authPassword) return;

    setAuthActionLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });

    setAuthActionLoading(false);

    if (error) {
      alert(error.message);
      return;
    }
  };

  const sendPasswordReset = async () => {
    if (!authEmail) {
      alert('Enter your email first.');
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(authEmail, {
      redirectTo: window.location.origin
    });

    if (error) {
      alert(error.message);
      return;
    }

    alert('Password reset email sent.');
  };

  const signOut = async () => {
    setIsPasswordRecovery(false);
    setNewPassword('');
    await supabase.auth.signOut();
  };

  const updatePassword = async (e) => {
    e.preventDefault();
    if (!newPassword) return;

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      alert(error.message);
      return;
    }

    setIsPasswordRecovery(false);
    setNewPassword('');
    alert('Password updated.');
  };

  const handleUrlScrape = async () => {
    if (!urlInput) return;
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('scrape-recipe', { body: { url: urlInput } });
      if (error) {
        if (error.context?.json) {
          const errorBody = await error.context.json();
          throw new Error(errorBody.error || error.message);
        }
        throw error;
      }
      if (data?.error) throw new Error(data.error);
      setRecipe({ 
        title: data.title || "New Intel", 
        ingredients: Array.isArray(data.ingredients) ? data.ingredients.join('\n') : data.ingredients, 
        directions: Array.isArray(data.directions) ? data.directions.join('\n') : data.directions,
        notes: ''
      });
      setView('review');
      setShowEditor(true);
    } catch (err) {
      console.error('Recipe import failed:', err);
      alert(`Unable to import recipe: ${err.message || 'Unknown scrape error'}`);
    } finally { setIsProcessing(false); setUrlInput(''); }
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
    if (!user) return;

    const { error } = await supabase.from('recipes').insert([{ 
      user_id: user.id,
      title: recipe.title, 
      ingredients: recipe.ingredients, 
      directions: recipe.directions,
      notes: recipe.notes,
      description: (recipe.ingredients || "").substring(0, 50) 
    }]);
    if (error) {
      alert(`Unable to save recipe: ${error.message}`);
      return;
    }
    if (!error) { setView('vault'); setShowEditor(false); setRecipe(emptyRecipe); fetchVault(); }
  };

  const updateRecipe = async () => {
    const { error } = await supabase.from('recipes').update({ 
      title: selectedRecipe.title, 
      ingredients: selectedRecipe.ingredients, 
      directions: selectedRecipe.directions,
      notes: selectedRecipe.notes || ''
    }).eq('id', selectedRecipe.id).eq('user_id', user.id);
    if (!error) { setIsEditing(false); fetchVault(); alert("Vault Updated."); }
  };

  const deleteRecipe = async () => {
    if (confirm("BURN THIS RECIPE?")) {
      const { error } = await supabase.from('recipes').delete().eq('id', selectedRecipe.id).eq('user_id', user.id);
      if (!error) { setSelectedRecipe(null); fetchVault(); }
    }
  };

  const copyCheckedItems = () => {
    const list = selectedRecipe.ingredients.split('\n')
      .filter((_, index) => checkedIngredients[index])
      .join('\n');
    if (list) {
      navigator.clipboard.writeText(list);
      alert("Checked items copied to clipboard.");
    }
  };

  const clearChecks = () => {
    setCheckedIngredients({});
    setCheckedDirections({});
  };

  const openScratchForm = () => {
    setRecipe(emptyRecipe);
    setSelectedRecipe(null);
    setView('scratch');
    setShowEditor(true);
    setShowButcherBlock(false);
    setIsCookingMode(false);
    setIsEditing(false);
    setShowRefHUD(false);
  };

  const openImportForm = () => {
    setRecipe(emptyRecipe);
    setUrlInput('');
    setSelectedRecipe(null);
    setView('premade');
    setShowEditor(false);
    setShowButcherBlock(false);
    setIsCookingMode(false);
    setIsEditing(false);
    setShowRefHUD(false);
  };

  const filteredVault = vaultItems.filter(item => item.title.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <main className="flex h-screen flex-col items-center justify-start bg-[#0D0D0D] text-white p-6 font-sans overflow-hidden">
      
      <div className="mb-4 text-center flex flex-col items-center flex-shrink-0">
        <div className="flex items-center gap-4">
          <img src="/assets/pocket_steak_logo.png" alt="Logo" className="h-16 w-auto" />
          <div className="flex flex-col items-center">
            <h1 className="text-3xl font-black tracking-tighter text-[#FF4500] italic uppercase leading-none">PocketSteak</h1>
            <p className="text-[#FF4500] uppercase tracking-[0.4em] text-[7px] font-black italic mt-0.5">Pitmaster Intelligence</p>
          </div>
        </div>
      </div>

      {authLoading ? (
        <div className="flex flex-1 items-center justify-center text-gray-800 uppercase font-black text-[10px] tracking-[0.4em] animate-pulse">
          Loading pit access
        </div>
      ) : !user ? (
        <div className="w-full max-w-md mt-10 rounded-2xl border-2 border-gray-800 bg-[#141414] p-8 shadow-[0_0_0_1px_rgba(255,69,0,0.12),0_24px_70px_rgba(0,0,0,0.65)]">
          <div className="mb-8 border-b border-gray-800 pb-5">
            <h2 className="text-2xl font-black text-[#FF4500] uppercase italic tracking-tighter leading-none">
              Sign In
            </h2>
            <p className="mt-2 text-[10px] font-black uppercase tracking-[0.25em] text-gray-600">
              Your private recipe box
            </p>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <input
              type="email"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              placeholder="EMAIL"
              className="w-full rounded-xl border border-gray-800 bg-[#0D0D0D] p-4 text-sm font-bold outline-none focus:border-[#FF4500]"
              autoComplete="email"
            />
            <input
              type="password"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              placeholder="PASSWORD"
              className="w-full rounded-xl border border-gray-800 bg-[#0D0D0D] p-4 text-sm font-bold outline-none focus:border-[#FF4500]"
              autoComplete="current-password"
            />
            <button type="submit" className="w-full rounded-xl bg-[#FF4500] p-4 font-black uppercase tracking-widest text-white transition-all hover:bg-[#E63E00]">
              {authActionLoading ? 'Working...' : 'Enter Recipe Box'}
            </button>
          </form>

          <div className="mt-6 flex justify-end text-[10px] font-black uppercase tracking-widest">
            <button onClick={sendPasswordReset} className="text-gray-500 hover:text-[#FF4500]">
              Reset Password
            </button>
          </div>
        </div>
      ) : isPasswordRecovery ? (
        <div className="w-full max-w-md mt-10 rounded-2xl border-2 border-gray-800 bg-[#141414] p-8 shadow-[0_0_0_1px_rgba(255,69,0,0.12),0_24px_70px_rgba(0,0,0,0.65)]">
          <div className="mb-8 border-b border-gray-800 pb-5">
            <h2 className="text-2xl font-black text-[#FF4500] uppercase italic tracking-tighter leading-none">
              Reset Password
            </h2>
            <p className="mt-2 text-[10px] font-black uppercase tracking-[0.25em] text-gray-600">
              Choose a new pit key
            </p>
          </div>

          <form onSubmit={updatePassword} className="space-y-4">
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="NEW PASSWORD"
              className="w-full rounded-xl border border-gray-800 bg-[#0D0D0D] p-4 text-sm font-bold outline-none focus:border-[#FF4500]"
              autoComplete="new-password"
            />
            <button type="submit" className="w-full rounded-xl bg-[#FF4500] p-4 font-black uppercase tracking-widest text-white transition-all hover:bg-[#E63E00]">
              Update Password
            </button>
          </form>
        </div>
      ) : (
      <div className="w-full max-w-6xl flex flex-col flex-1 overflow-hidden">
          
          <div className="flex justify-between items-center gap-4 mb-4 flex-shrink-0">
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={openScratchForm} className={`min-h-14 px-5 py-2 border rounded-full uppercase transition-all shadow-lg ${view === 'scratch' ? 'border-[#FF4500] bg-[#1A1A1A] text-white' : 'border-gray-800 bg-[#141414] text-gray-400 hover:border-[#FF4500] hover:text-white'}`}>
                <span className="block text-[9px] font-black tracking-[0.2em]">+ From Scratch</span>
                <span className="mt-1 block text-[7px] font-bold tracking-[0.16em] text-gray-600">Make your own recipe</span>
              </button>
              <button onClick={openImportForm} className={`min-h-14 px-5 py-2 border rounded-full uppercase transition-all shadow-lg ${view === 'premade' || view === 'review' ? 'border-[#FF4500] bg-[#1A1A1A] text-white' : 'border-gray-800 bg-[#141414] text-gray-400 hover:border-[#FF4500] hover:text-white'}`}>
                <span className="block text-[9px] font-black tracking-[0.2em]">+ Import Recipe</span>
              </button>
              <button onClick={() => setShowRefHUD(!showRefHUD)} className={`min-h-14 max-w-[260px] px-5 py-2 border rounded-full uppercase transition-all shadow-lg ${showRefHUD ? 'border-[#FF4500] bg-[#1A1A1A] text-white' : 'border-gray-800 bg-[#141414] text-gray-400 hover:border-[#FF4500] hover:text-white'}`}>
                <span className="block text-[9px] font-black tracking-[0.2em]">Reference</span>
                <span className="mt-1 block text-[7px] font-bold tracking-[0.16em] text-gray-600">Cooking temps and measurements</span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden max-w-[220px] truncate text-right text-[9px] font-black uppercase tracking-[0.2em] text-gray-600 md:block">
                {user.email}
              </div>
              <button onClick={signOut} className="rounded-full border border-gray-800 bg-[#141414] px-4 py-2 text-[9px] font-black uppercase tracking-[0.2em] text-gray-500 transition-all hover:border-[#FF4500] hover:text-white">
                Sign Out
              </button>
            </div>

            {isCookingMode && (
              <div className="flex items-stretch bg-black border-2 border-gray-800 rounded-xl overflow-hidden shadow-2xl h-14">
                <div className="px-6 border-r border-gray-800 bg-[#0A0A0A] flex flex-col items-center justify-center min-w-[120px]">
                  <span className="text-[7px] text-gray-500 font-black uppercase tracking-widest">Mission</span>
                  <span className="text-white font-mono text-xl font-bold">{formatTime(stopwatch)}</span>
                  <button onClick={() => setSwActive(!swActive)} className={`text-[8px] font-black ${swActive ? 'text-amber-500' : 'text-emerald-500'}`}>{swActive ? "PAUSE" : "START"}</button>
                </div>
                <div className="px-6 bg-[#0F0F0F] flex flex-col items-center justify-center min-w-[120px]">
                  <span className="text-[7px] text-gray-500 font-black uppercase tracking-widest">Countdown</span>
                  <span onClick={() => !cdActive && setCountdown(c => c + 60)} className={`font-mono text-xl font-bold cursor-pointer ${countdown > 0 ? 'text-[#FF4500]' : 'text-gray-700'}`}>{formatTime(countdown)}</span>
                  <button onClick={() => countdown > 0 && setCdActive(!cdActive)} className={`text-[8px] font-black ${cdActive ? 'text-amber-500' : 'text-emerald-500'}`}>{cdActive ? "STOP" : "GO"}</button>
                </div>
                <button onClick={() => {setStopwatch(0); setSwActive(false); setCountdown(0); setCdActive(false);}} className="px-4 bg-gray-900 text-gray-600 hover:text-red-500 font-black">✕</button>
              </div>
            )}
          </div>

          <div className="flex flex-col md:flex-row gap-6 flex-1 overflow-hidden">
              <div className="w-full md:w-1/4 flex flex-col gap-4 overflow-hidden">
                <input placeholder="Search files..." className="bg-[#141414] border-2 border-gray-800 p-3 rounded-lg outline-none focus:border-[#FF4500] text-sm shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)]" onChange={(e) => setSearchQuery(e.target.value)} />
                <div className="flex-1 min-h-0 rounded-2xl border-2 border-gray-700 bg-[#101010] p-3 shadow-[0_0_0_1px_rgba(255,69,0,0.12),0_18px_45px_rgba(0,0,0,0.55)] overflow-hidden">
                  <div className="h-full overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                    {filteredVault.map(item => (
                      <div key={item.id} onClick={() => { setSelectedRecipe(item); setView('vault'); setShowEditor(false); setShowButcherBlock(false); setIsCookingMode(false); setIsEditing(false); setShowRefHUD(false); }} className={`p-4 rounded-xl cursor-pointer border transition-all shadow-[inset_0_0_0_1px_rgba(255,255,255,0.025)] ${selectedRecipe?.id === item.id ? 'border-[#FF4500] bg-[#1A1A1A]' : 'border-gray-900 bg-[#141414] hover:border-gray-700 hover:bg-[#1A1A1A]'}`}>
                        <h3 className="font-bold text-sm truncate uppercase tracking-tight">{item.title}</h3>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex-1 bg-[#141414] rounded-2xl border-2 border-gray-700 flex flex-col overflow-hidden shadow-[0_0_0_1px_rgba(255,69,0,0.12),0_24px_70px_rgba(0,0,0,0.65)] relative">
                {showRefHUD && (
                  <div className="absolute top-2 right-6 z-50 bg-black/98 border border-[#FF4500]/50 p-6 rounded-2xl shadow-2xl backdrop-blur-md w-[400px]">
                    <div className="flex justify-between items-center mb-4 border-b border-gray-800 pb-2">
                      <span className="text-[#FF4500] font-black uppercase text-[10px] tracking-widest">Pitmaster Ref Intel</span>
                      <button onClick={() => setShowRefHUD(false)} className="text-gray-600 hover:text-white">✕</button>
                    </div>
                    <div className="grid grid-cols-2 gap-6 text-[10px] font-mono">
                      <div className="space-y-4">
                        <p className="text-[9px] text-gray-500 uppercase font-black border-b border-gray-900">Internal Temps</p>
                        <div className="flex justify-between"><span>Rare</span><span className="text-[#FF4500]">125°F</span></div>
                        <div className="flex justify-between"><span>Med-Rare</span><span className="text-[#FF4500]">135°F</span></div>
                        <div className="flex justify-between"><span>Medium</span><span className="text-[#FF4500]">145°F</span></div>
                        <div className="flex justify-between"><span>Chicken</span><span className="text-[#FF4500]">165°F</span></div>
                      </div>
                      <div className="space-y-4">
                        <p className="text-[9px] text-gray-500 uppercase font-black border-b border-gray-900">Conversions</p>
                        <div className="flex justify-between"><span>1 Cup</span><span>8 oz</span></div>
                        <div className="flex justify-between"><span>1/2 Cup</span><span>4 oz</span></div>
                        <div className="flex justify-between"><span>1 Tbsp</span><span>3 tsp</span></div>
                        <div className="flex justify-between"><span>Pint</span><span>16 oz</span></div>
                      </div>
                    </div>
                  </div>
                )}

                {view === 'premade' && !showEditor ? (
                  <div className="h-full overflow-y-auto custom-scrollbar p-8">
                    <div className="max-w-xl mx-auto p-10 border-2 border-gray-800 rounded-2xl bg-[#101010] text-center shadow-[inset_0_0_0_1px_rgba(255,255,255,0.025),0_18px_45px_rgba(0,0,0,0.45)]">
                      <h2 className="text-xl font-black text-[#FF4500] uppercase italic tracking-tighter mb-6">Import Recipe</h2>
                      <input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="PASTE URL HERE" className="w-full bg-[#0D0D0D] border border-gray-800 rounded-xl p-4 outline-none focus:border-[#FF4500] text-center font-bold mb-4" />
                      <button onClick={handleUrlScrape} className={`w-full p-4 bg-[#FF4500] text-white font-black rounded-xl ${isProcessing ? 'animate-pulse' : ''}`}>{isProcessing ? 'PREPPING...' : 'PREPARE RECIPE'}</button>
                    </div>
                  </div>
                ) : (view === 'scratch' || view === 'review') ? (
                  <div className="h-full overflow-y-auto custom-scrollbar p-8">
                    <div className="max-w-2xl mx-auto p-8 border-2 border-gray-800 rounded-2xl bg-[#101010] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.025),0_18px_45px_rgba(0,0,0,0.45)] space-y-6">
                      <div className="flex justify-between items-center border-b border-gray-800 pb-4">
                        <h2 className="text-xs font-black text-gray-600 uppercase tracking-widest">{view === 'review' ? 'Review Imported Recipe' : 'Recipe Intake Form'}</h2>
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
                        <textarea value={recipe.ingredients} onChange={(e) => setRecipe({...recipe, ingredients: e.target.value})} placeholder="INGREDIENTS" className="w-full h-48 bg-[#0D0D0D] border border-gray-800 rounded-xl p-4 text-xs outline-none focus:border-[#FF4500]" />
                        <textarea value={recipe.directions} onChange={(e) => setRecipe({...recipe, directions: e.target.value})} placeholder="DIRECTIONS" className="w-full h-48 bg-[#0D0D0D] border border-gray-800 rounded-xl p-4 text-xs outline-none focus:border-[#FF4500]" />
                      </div>
                      <textarea value={recipe.notes} onChange={(e) => setRecipe({...recipe, notes: e.target.value})} placeholder="NOTES" className="w-full h-32 bg-[#0D0D0D] border border-gray-800 rounded-xl p-4 text-xs outline-none focus:border-[#FF4500]" />
                      <button onClick={saveRecipe} className="w-full p-4 bg-[#FF4500] text-white rounded-xl font-black uppercase tracking-widest transition-all shadow-lg hover:bg-[#E63E00]">SAVE TO COOKBOOK</button>
                    </div>
                  </div>
                ) : selectedRecipe ? (
                  <>
                    <div className="p-6 border-b border-gray-800 flex justify-between items-center gap-4 bg-[#1A1A1A] flex-shrink-0">
                      {isEditing ? (
                        <input
                          aria-label="Recipe title"
                          value={selectedRecipe.title || ''}
                          onChange={(e) => setSelectedRecipe({...selectedRecipe, title: e.target.value})}
                          className="min-w-0 flex-1 bg-[#0D0D0D] border border-gray-800 rounded-xl px-4 py-3 text-2xl font-black text-[#FF4500] uppercase italic tracking-tighter leading-none outline-none focus:border-[#FF4500]"
                        />
                      ) : (
                        <h2 className="min-w-0 flex-1 text-2xl font-black text-[#FF4500] uppercase italic tracking-tighter leading-none">{selectedRecipe.title}</h2>
                      )}
                      <div className="flex flex-shrink-0 gap-2">
                        {!isEditing && (
                          <button onClick={() => setIsCookingMode(!isCookingMode)} className={`px-6 py-1.5 rounded-full font-black text-[9px] border ${isCookingMode ? 'bg-[#FF4500] border-[#FF4500] text-white' : 'border-gray-700 text-gray-500 hover:text-white'}`}>{isCookingMode ? 'Exit' : 'Cook'}</button>
                        )}
                        {!isCookingMode && (
                          <button onClick={() => setIsEditing(!isEditing)} className="px-4 py-1.5 rounded-full font-black text-[9px] border border-gray-700 text-gray-500 hover:text-white">{isEditing ? 'Cancel' : 'Edit'}</button>
                        )}
                        {!isCookingMode && !isEditing && (
                          <button onClick={deleteRecipe} className="px-4 py-1.5 rounded-full font-black text-[9px] border border-red-900/50 text-red-900 hover:bg-red-900 hover:text-white">Burn</button>
                        )}
                      </div>
                    </div>

                    <div className="flex-1 min-h-0 overflow-hidden p-6 relative">
                      {isEditing ? (
                        <div className="absolute inset-6 flex flex-col gap-4">
                          <div className="grid grid-cols-2 gap-4 flex-1 min-h-0 overflow-hidden">
                            <textarea value={selectedRecipe.ingredients} onChange={(e) => setSelectedRecipe({...selectedRecipe, ingredients: e.target.value})} className="bg-[#0D0D0D] border border-gray-800 rounded-xl p-4 text-xs outline-none focus:border-[#FF4500] overflow-y-auto" />
                            <textarea value={selectedRecipe.directions} onChange={(e) => setSelectedRecipe({...selectedRecipe, directions: e.target.value})} className="bg-[#0D0D0D] border border-gray-800 rounded-xl p-4 text-xs outline-none focus:border-[#FF4500] overflow-y-auto" />
                          </div>
                          <textarea value={selectedRecipe.notes || ''} onChange={(e) => setSelectedRecipe({...selectedRecipe, notes: e.target.value})} placeholder="NOTES" className="w-full h-32 flex-shrink-0 bg-[#0D0D0D] border border-gray-800 rounded-xl p-4 text-xs outline-none focus:border-[#FF4500] overflow-y-auto" />
                          <button onClick={updateRecipe} className="w-full p-4 bg-[#FF4500] text-white font-black uppercase tracking-widest rounded-xl hover:bg-[#E63E00] transition-all">Update Cookbook</button>
                        </div>
                      ) : isCookingMode ? (
                        <div className="absolute inset-6 overflow-y-auto custom-scrollbar space-y-12 pb-20">
                          <section>
                            <h4 className="text-[#FF4500] font-black uppercase text-xs mb-4">Prep Checklist</h4>
                            <div className="space-y-3">
                              {selectedRecipe.ingredients.split('\n').map((ing, i) => (
                                <div key={i} onClick={() => setCheckedIngredients({...checkedIngredients, [i]: !checkedIngredients[i]})} className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer border transition-all ${checkedIngredients[i] ? 'bg-black opacity-10 border-transparent' : 'bg-[#1A1A1A] border-gray-800'}`}>
                                  <div className={`w-6 h-6 rounded border-2 flex items-center justify-center ${checkedIngredients[i] ? 'bg-emerald-500 border-emerald-500' : 'border-gray-600'}`}>{checkedIngredients[i] && '✓'}</div>
                                  <span className="text-lg">{ing}</span>
                                </div>
                              ))}
                            </div>
                          </section>
                          <section>
                            <h4 className="text-[#FF4500] font-black uppercase text-xs mb-4">The Process</h4>
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
                        <div className="h-full flex flex-col gap-6 overflow-hidden">
                          <div className="grid grid-cols-2 gap-6 flex-1 min-h-0 overflow-hidden">
                            <div className="flex flex-col min-h-0 rounded-xl border-2 border-gray-800 bg-[#0D0D0D] p-5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.025),0_12px_30px_rgba(0,0,0,0.28)] overflow-hidden">
                              <div className="flex justify-between items-center mb-5 flex-shrink-0">
                                  <h4 className="text-gray-600 font-black uppercase text-[10px] tracking-widest">Ingredients</h4>
                                  <div className="flex gap-2 text-[10px] font-black uppercase">
                                      <button onClick={copyCheckedItems} className="text-[#FF4500] hover:underline">Copy</button>
                                      <span className="text-gray-800">/</span>
                                      <button onClick={clearChecks} className="text-gray-500 hover:text-white">Clear</button>
                                  </div>
                              </div>
                              <div className="flex-1 min-h-0 overflow-y-auto space-y-3 custom-scrollbar pr-2">
                                {selectedRecipe.ingredients.split('\n').map((ing, i) => (
                                  <div key={i} className="flex items-start gap-3 cursor-pointer group" onClick={() => setCheckedIngredients({...checkedIngredients, [i]: !checkedIngredients[i]})}>
                                      <div className={`mt-0.5 w-4 h-4 flex-shrink-0 border rounded transition-all flex items-center justify-center ${checkedIngredients[i] ? 'bg-[#FF4500] border-[#FF4500]' : 'border-gray-700 group-hover:border-gray-500'}`}>
                                          {checkedIngredients[i] && <span className="text-[8px] font-bold text-white">✓</span>}
                                      </div>
                                      <span className={`text-sm leading-tight transition-all ${checkedIngredients[i] ? 'text-gray-700 line-through italic' : 'text-gray-300'}`}>{ing}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="flex flex-col min-h-0 rounded-xl border-2 border-gray-800 bg-[#0D0D0D] p-5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.025),0_12px_30px_rgba(0,0,0,0.28)] overflow-hidden">
                              <h4 className="text-gray-600 font-black uppercase text-[10px] tracking-widest mb-5 flex-shrink-0">Directions</h4>
                              <div className="flex-1 min-h-0 overflow-y-auto space-y-4 custom-scrollbar pr-2 text-sm text-gray-400">
                                {selectedRecipe.directions.split('\n').filter(d => d.trim()).map((step, i) => (
                                  <div key={i} className="flex gap-3"><span className="text-[#FF4500] font-black italic">{i + 1}</span>{step}</div>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="h-36 flex-shrink-0 rounded-xl border-2 border-gray-800 bg-[#0D0D0D] p-5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.025),0_12px_30px_rgba(0,0,0,0.28)] overflow-hidden">
                            <h4 className="text-gray-600 font-black uppercase text-[10px] tracking-widest mb-4">Notes</h4>
                            <div className="h-[calc(100%-1.75rem)] overflow-y-auto custom-scrollbar pr-2 text-sm leading-relaxed text-gray-400 whitespace-pre-wrap">
                              {selectedRecipe.notes?.trim() || 'No field notes yet.'}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-800 uppercase font-black text-[10px] tracking-[0.4em] animate-pulse">Select intel from sidebar</div>
                )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
