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

  // Fetch Vault Data
  const fetchVault = async () => {
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) console.error(error);
    else setVaultItems(data);
  };

  // Trigger fetch when entering Vault view
  useEffect(() => {
    if (view === 'vault') fetchVault();
  }, [view]);

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
    }
  };

  // Filter vault items based on search
  const filteredVault = vaultItems.filter(item => 
    item.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <main className="flex min-h-screen flex-col items-center justify-start bg-[#121212] text-white p-4 font-sans">
      
      {/* Header - Only show if not in deep Vault view to save space */}
      {(!selectedRecipe || view !== 'vault') && (
        <div className="my-12 text-center">
          <h1 className="text-6xl font-black tracking-tighter text-[#FF4500]">POCKETSTEAK</h1>
          <p className="text-gray-500 mt-2 uppercase tracking-widest text-xs font-bold text-center">Pitmaster Intelligence</p>
        </div>
      )}

      {view === 'home' && (
        <div className="flex flex-col gap-4 w-full max-w-md mt-10">
          <button onClick={() => { setView('scratch'); setShowEditor(true); }} className="p-6 bg-[#1E1E1E] border-2 border-gray-800 rounded-xl font-bold text-xl hover:border-[#FF4500] transition-all">FROM SCRATCH</button>
          <button onClick={() => setView('premade')} className="p-6 bg-[#1E1E1E] border-2 border-gray-800 rounded-xl font-bold text-xl hover:border-[#FF4500] transition-all">PREMADE</button>
          <button onClick={() => setView('vault')} className="p-6 bg-[#FF4500] rounded-xl font-bold text-xl mt-4 active:scale-95 transition-all">THE VAULT</button>
        </div>
      )}

      {view !== 'home' && (
        <div className="w-full max-w-5xl">
          <button onClick={() => { setView('home'); setSelectedRecipe(null); }} className="text-gray-400 hover:text-white mb-6 font-bold uppercase text-xs tracking-widest">← BACK TO HUB</button>

          {view === 'vault' ? (
            <div className="flex flex-col md:flex-row gap-6 h-[70vh]">
              {/* Sidebar */}
              <div className="w-full md:w-1/3 flex flex-col gap-4">
                <input 
                  placeholder="Search your vault..." 
                  className="bg-[#1A1A1A] border border-gray-800 p-3 rounded-lg outline-none focus:border-[#FF4500]"
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {filteredVault.map(item => (
                    <div 
                      key={item.id} 
                      onClick={() => setSelectedRecipe(item)}
                      className={`p-4 rounded-xl cursor-pointer border-2 transition-all ${selectedRecipe?.id === item.id ? 'border-[#FF4500] bg-[#252525]' : 'border-transparent bg-[#1A1A1A] hover:bg-[#252525]'}`}
                    >
                      <h3 className="font-bold text-lg">{item.title}</h3>
                      <p className="text-xs text-gray-500 truncate">{item.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recipe Viewer */}
              <div className="flex-1 bg-[#1A1A1A] rounded-2xl border border-gray-800 p-8 overflow-y-auto shadow-2xl">
                {selectedRecipe ? (
                  <div className="space-y-6">
                    <h2 className="text-4xl font-black text-[#FF4500] uppercase tracking-tighter">{selectedRecipe.title}</h2>
                    <div className="grid grid-cols-1 gap-8">
                      <div>
                        <h4 className="text-[#FF4500] font-bold uppercase text-xs tracking-widest mb-3">Ingredients</h4>
                        <p className="whitespace-pre-wrap text-gray-300 leading-relaxed">{selectedRecipe.ingredients}</p>
                      </div>
                      <div>
                        <h4 className="text-[#FF4500] font-bold uppercase text-xs tracking-widest mb-3">Directions</h4>
                        <p className="whitespace-pre-wrap text-gray-300 leading-relaxed">{selectedRecipe.directions}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-600 font-bold uppercase tracking-widest text-sm">
                    Select a recipe to view details
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Editor View (Scratch/Premade) - Same as before */
            <div className="p-8 border border-gray-800 rounded-2xl bg-[#1A1A1A] shadow-2xl">
              {/* ... Editor contents from previous step ... */}
              {/* (I'll keep the editor logic inside your file) */}
            </div>
          )}
        </div>
      )}
    </main>
  );
}