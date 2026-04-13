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
  const [recipe, setRecipe] = useState({ title: '', ingredients: '', directions: '' });
  const [showEditor, setShowEditor] = useState(false);
  const [errorField, setErrorField] = useState(null);

  // Vault States
  const [vaultItems, setVaultItems] = useState([]);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [checkedIngredients, setCheckedIngredients] = useState({});

  const fetchVault = async () => {
    const { data, error } = await supabase.from('recipes').select('*').order('created_at', { ascending: false });
    if (!error) setVaultItems(data);
  };

  useEffect(() => {
    if (view === 'vault') fetchVault();
  }, [view]);

  // Handle Copy to Sheets
  const copyToSheets = () => {
    const list = selectedRecipe.ingredients.split('\n')
      .filter((_, index) => checkedIngredients[index])
      .join('\n');
    
    if (!list) {
      alert("Select some ingredients first!");
      return;
    }

    navigator.clipboard.writeText(list);
    alert("Copied to clipboard! Ready to paste into Sheets.");
  };

  const saveRecipe = async () => {
    if (!recipe.title) {
      setErrorField('title');
      setTimeout(() => setErrorField(null), 500);
      return;
    }
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
        <div className="w-full max-w-5xl">
          <button onClick={() => { setView('home'); setSelectedRecipe(null); setShowEditor(false); }} className="text-gray-400 hover:text-white mb-6 font-bold uppercase text-xs tracking-widest">← BACK TO HUB</button>

          {view === 'vault' ? (
            <div className="flex flex-col md:flex-row gap-6 h-[70vh]">
              <div className="w-full md:w-1/3 flex flex-col gap-4">
                <input placeholder="Search vault..." className="bg-[#1A1A1A] border border-gray-800 p-3 rounded-lg outline-none focus:border-[#FF4500]" onChange={(e) => setSearchQuery(e.target.value)} />
                <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                  {filteredVault.map(item => (
                    <div key={item.id} onClick={() => { setSelectedRecipe(item); setCheckedIngredients({}); }} className={`p-4 rounded-xl cursor-pointer border-2 transition-all ${selectedRecipe?.id === item.id ? 'border-[#FF4500] bg-[#252525]' : 'border-transparent bg-[#1A1A1A] hover:bg-[#252525]'}`}>
                      <h3 className="font-bold">{item.title}</h3>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex-1 bg-[#1A1A1A] rounded-2xl border border-gray-800 p-8 overflow-y-auto relative">
                {selectedRecipe ? (
                  <div className="space-y-6">
                    <div className="flex justify-between items-start">
                      <h2 className="text-4xl font-black text-[#FF4500] uppercase italic tracking-tighter">{selectedRecipe.title}</h2>
                      <button onClick={copyToSheets} className="bg-emerald-600 px-4 py-2 rounded font-bold text-xs uppercase hover:bg-emerald-500 transition-all">Copy to Sheets</button>
                    </div>
                    <div>
                      <h4 className="text-gray-500 font-bold uppercase text-xs mb-4">Select Ingredients to Copy</h4>
                      <div className="space-y-2">
                        {selectedRecipe.ingredients.split('\n').map((ing, i) => (
                          <div key={i} className="flex items-center gap-3 p-2 hover:bg-white/5 rounded group">
                            <input 
                              type="checkbox" 
                              checked={!!checkedIngredients[i]} 
                              onChange={(e) => setCheckedIngredients({...checkedIngredients, [i]: e.target.checked})}
                              className="w-5 h-5 accent-[#FF4500] cursor-pointer"
                            />
                            <span className={checkedIngredients[i] ? 'text-white' : 'text-gray-500'}>{ing}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-gray-500 font-bold uppercase text-xs mb-2">Directions</h4>
                      <p className="whitespace-pre-wrap text-gray-300">{selectedRecipe.directions}</p>
                    </div>
                  </div>
                ) : <div className="h-full flex items-center justify-center text-gray-700 font-bold">SELECT A RECIPE</div>}
              </div>
            </div>
          ) : (
            <div className="p-8 border border-gray-800 rounded-2xl bg-[#1A1A1A]">
              {/* RESTORED EDITOR LOGIC */}
              {view === 'premade' && !showEditor && (
                <div className="flex flex-col gap-4">
                  <h2 className="text-xl font-bold">BUTCHER BLOCK</h2>
                  <textarea value={rawInput} onChange={(e) => setRawInput(e.target.value)} placeholder="Paste messy text..." className="w-full h-40 bg-[#121212] border border-gray-700 rounded p-4 outline-none focus:border-[#FF4500]" />
                  <button onClick={() => { setShowEditor(true); setRecipe({title: 'Auto-extracted Title', ingredients: rawInput, directions: 'Auto-extracted Directions'}); }} className="p-4 bg-[#FF4500] font-bold rounded">PROCESS</button>
                </div>
              )}

              {showEditor && (
                <div className="space-y-6">
                  <input value={recipe.title} onChange={(e) => setRecipe({...recipe, title: e.target.value})} placeholder="Recipe Title" className={`w-full bg-transparent border-b ${errorField === 'title' ? 'border-red-500 animate-bounce' : 'border-gray-700'} text-3xl font-bold p-2 outline-none`} />
                  <textarea value={recipe.ingredients} onChange={(e) => setRecipe({...recipe, ingredients: e.target.value})} placeholder="Ingredients (one per line)" className="w-full h-40 bg-[#121212] border border-gray-700 rounded p-4 outline-none" />
                  <textarea value={recipe.directions} onChange={(e) => setRecipe({...recipe, directions: e.target.value})} placeholder="Directions" className="w-full h-40 bg-[#121212] border border-gray-700 rounded p-4 outline-none" />
                  <button onClick={saveRecipe} className="w-full p-4 bg-emerald-600 rounded font-bold uppercase tracking-widest">Save to Vault</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </main>
  );
}