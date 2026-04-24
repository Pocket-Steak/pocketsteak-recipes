'use client';

import Image from 'next/image';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

const emptyRecipe = { title: '', ingredients: '', directions: '', notes: '' };

let supabaseClient = null;

const getSupabase = () => {
  if (supabaseClient) return supabaseClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) return null;

  supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  return supabaseClient;
};

const COMMON_INGREDIENT_WORDS = new Set([
  'a', 'an', 'and', 'as', 'at', 'about', 'all', 'by', 'for', 'from', 'in', 'into',
  'of', 'on', 'or', 'per', 'plus', 'the', 'to', 'with',
  'cup', 'cups', 'tbsp', 'tablespoon', 'tablespoons', 'tbs', 'tsp', 'teaspoon',
  'teaspoons', 'lb', 'lbs', 'pound', 'pounds', 'oz', 'ounce', 'ounces', 'g',
  'gram', 'grams', 'kg', 'kilogram', 'kilograms', 'ml', 'milliliter',
  'milliliters', 'l', 'liter', 'liters', 'pinch', 'pinches', 'dash', 'dashes',
  'can', 'cans', 'jar', 'jars', 'package', 'packages', 'packet', 'packets',
  'stick', 'sticks', 'slice', 'slices', 'clove', 'cloves', 'bunch', 'bunches',
  'piece', 'pieces', 'whole', 'small', 'medium', 'large', 'extra',
  'fresh', 'dried', 'ground', 'kosher', 'black', 'white', 'red', 'green',
  'yellow', 'chopped', 'minced', 'diced', 'sliced', 'crushed', 'grated',
  'shredded', 'melted', 'softened', 'cold', 'room', 'temperature', 'divided',
  'optional', 'needed', 'serving', 'serve', 'thinly', 'finely', 'coarsely',
  'packed', 'light', 'dark', 'unsalted', 'salted', 'purpose',
]);

const WEAK_INGREDIENT_WORDS = new Set([
  'batter', 'cheese', 'crust', 'dough', 'dressing', 'filling', 'glaze', 'marinade',
  'mix', 'mixture', 'sauce', 'seasoning',
]);

const FRACTION_REPLACEMENTS = {
  '\u00bc': ' 1/4 ',
  '\u00bd': ' 1/2 ',
  '\u00be': ' 3/4 ',
  '\u2153': ' 1/3 ',
  '\u2154': ' 2/3 ',
  '\u215b': ' 1/8 ',
  '\u215c': ' 3/8 ',
  '\u215d': ' 5/8 ',
  '\u215e': ' 7/8 ',
};

const splitRecipeLines = (value = '') =>
  String(value)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

const cleanDirectionLine = (line) =>
  line.replace(/^\s*(?:step\s*)?\d+\s*[.)-]\s*/i, '').trim();

const splitDirectionSteps = (value = '') =>
  splitRecipeLines(value)
    .map(cleanDirectionLine)
    .filter(Boolean);

const normalizeRecipeText = (value = '') =>
  String(value)
    .toLowerCase()
    .replace(/[\u00bc\u00bd\u00be\u2153\u2154\u215b\u215c\u215d\u215e]/g, (char) => FRACTION_REPLACEMENTS[char] || ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const extractIngredientTokens = (ingredientLine) => {
  const coreName = String(ingredientLine)
    .replace(/\([^)]*\)/g, ' ')
    .split(/[,;]/)[0];

  return normalizeRecipeText(coreName)
    .split(' ')
    .filter((token) => token && !COMMON_INGREDIENT_WORDS.has(token) && !/^\d+$/.test(token));
};

const getIngredientTerms = (ingredientLine) => {
  const tokens = extractIngredientTokens(ingredientLine);
  const terms = new Set();

  if (tokens.length > 1) terms.add(tokens.join(' '));
  if (tokens.length > 2) terms.add(tokens.slice(-2).join(' '));
  tokens.forEach((token) => {
    if (token.length > 2 && !WEAK_INGREDIENT_WORDS.has(token)) terms.add(token);
  });

  return [...terms].sort((a, b) => b.length - a.length);
};

const replaceLastWord = (term, getReplacement) => {
  const words = term.split(' ');
  const lastWord = words[words.length - 1];
  words[words.length - 1] = getReplacement(lastWord);
  return words.join(' ');
};

const singularize = (word) => {
  if (word.endsWith('ies') && word.length > 4) return `${word.slice(0, -3)}y`;
  if (word.endsWith('es') && word.length > 4) return word.slice(0, -2);
  if (word.endsWith('s') && word.length > 3) return word.slice(0, -1);
  return word;
};

const pluralize = (word) => {
  if (word.endsWith('s')) return word;
  if (word.endsWith('y') && word.length > 3) return `${word.slice(0, -1)}ies`;
  return `${word}s`;
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const stepIncludesTerm = (normalizedStep, term) => {
  const variants = new Set([
    term,
    replaceLastWord(term, singularize),
    replaceLastWord(term, pluralize),
  ]);

  return [...variants].some((variant) => {
    const pattern = variant.split(/\s+/).map(escapeRegExp).join('\\s+');
    return new RegExp(`\\b${pattern}\\b`).test(normalizedStep);
  });
};

const getWordVariants = (word) => new Set([word, singularize(word), pluralize(word)]);

const getStepTokens = (step) => new Set(normalizeRecipeText(step).split(' ').filter(Boolean));

const tokenAppearsInStep = (token, stepTokens) =>
  [...getWordVariants(token)].some((variant) => stepTokens.has(variant));

const getIngredientMatchScore = (normalizedStep, stepTokens, ingredient) => {
  if (ingredient.terms.some((term) => stepIncludesTerm(normalizedStep, term))) {
    return 100 + Math.max(...ingredient.terms.map((term) => term.length));
  }

  const strongTokens = ingredient.tokens.filter((token) => token.length > 2 && !WEAK_INGREDIENT_WORDS.has(token));
  const matchedTokens = strongTokens.filter((token) => tokenAppearsInStep(token, stepTokens));

  if (strongTokens.length === 0 || matchedTokens.length === 0) return 0;
  if (strongTokens.length === 1) return matchedTokens[0].length > 3 ? 20 : 0;
  if (matchedTokens.length >= Math.min(2, strongTokens.length)) return 50 + matchedTokens.join('').length;
  if (matchedTokens[0].length >= 7) return 30 + matchedTokens[0].length;

  return 0;
};

const buildIngredientRefs = (ingredients = '') =>
  splitRecipeLines(ingredients).map((line) => {
    const tokens = extractIngredientTokens(line);

    return {
      line,
      terms: getIngredientTerms(line),
      tokens,
    };
  });

const getStepIngredientRefs = (step, ingredientRefs) => {
  const normalizedStep = normalizeRecipeText(step);
  const stepTokens = getStepTokens(step);

  return ingredientRefs
    .map((ingredient) => ({
      ...ingredient,
      score: getIngredientMatchScore(normalizedStep, stepTokens, ingredient),
    }))
    .filter((ingredient) => ingredient.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((ingredient) => ingredient.line);
};

const buildDirectionRows = (directions = '', ingredientRefs = []) =>
  splitDirectionSteps(directions).map((step) => ({
    step,
    ingredients: getStepIngredientRefs(step, ingredientRefs),
  }));

const formatScrapedList = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item;
        return item?.step || item?.direction || item?.text || '';
      })
      .filter(Boolean)
      .join('\n');
  }

  return value || '';
};

function StepMeasurementPreview({ rows }) {
  if (!rows.length) return null;

  return (
    <div className="rounded-xl border border-gray-800 bg-[#0D0D0D] p-4 sm:p-5">
      <h3 className="mb-4 text-[9px] font-black uppercase tracking-widest text-gray-600 sm:text-[10px]">Step Measurement Preview</h3>
      <div className="space-y-4 text-sm text-gray-300">
        {rows.map(({ step, ingredients }, i) => (
          <div key={`${i}-${step}`} className="flex gap-3">
            <span className="text-sm font-black italic text-[#FF4500] sm:text-base">{i + 1}</span>
            <div className="min-w-0">
              <p>{step}</p>
              {ingredients.length > 0 ? (
                <div className="mt-2 space-y-1 border-l border-[#FF4500]/35 pl-3">
                  <p className="text-[8px] font-black uppercase tracking-[0.18em] text-gray-600">Uses</p>
                  {ingredients.map((ingredient) => (
                    <p key={ingredient} className="text-xs font-black leading-relaxed text-[#FF4500]">{ingredient}</p>
                  ))}
                </div>
              ) : (
                <p className="mt-2 border-l border-gray-800 pl-3 text-[10px] font-bold uppercase tracking-[0.12em] text-gray-700">No measured ingredient matched</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const supabase = getSupabase();
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authActionLoading, setAuthActionLoading] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [view, setView] = useState('vault');
  const [urlInput, setUrlInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [recipe, setRecipe] = useState(emptyRecipe);
  const [showEditor, setShowEditor] = useState(false);
  
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
  const missingSupabaseMessage = 'PocketSteak is missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.';

  const ensureSupabase = () => {
    if (!supabase) {
      alert(missingSupabaseMessage);
      return null;
    }

    return supabase;
  };

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

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
  }, [supabase]);

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
    if (!supabase || !user) return;

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
  }, [supabase, user]);

  useEffect(() => { if (user && view === 'vault') fetchVault(); }, [user, view, fetchVault]);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    if (!authEmail || !authPassword) return;

    const client = ensureSupabase();
    if (!client) return;

    setAuthActionLoading(true);
    const { error } = await client.auth.signInWithPassword({ email: authEmail, password: authPassword });

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

    const client = ensureSupabase();
    if (!client) return;

    const { error } = await client.auth.resetPasswordForEmail(authEmail, {
      redirectTo: window.location.origin
    });

    if (error) {
      alert(error.message);
      return;
    }

    alert('Password reset email sent.');
  };

  const signOut = async () => {
    const client = ensureSupabase();
    if (!client) return;

    setIsPasswordRecovery(false);
    setNewPassword('');
    await client.auth.signOut();
  };

  const updatePassword = async (e) => {
    e.preventDefault();
    if (!newPassword) return;

    const client = ensureSupabase();
    if (!client) return;

    const { error } = await client.auth.updateUser({ password: newPassword });

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
    const client = ensureSupabase();
    if (!client) return;

    setIsProcessing(true);
    try {
      const { data, error } = await client.functions.invoke('scrape-recipe', { body: { url: urlInput } });
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
        ingredients: formatScrapedList(data.ingredients), 
        directions: formatScrapedList(data.directions),
        notes: ''
      });
      setView('review');
      setShowEditor(true);
    } catch (err) {
      console.error('Recipe import failed:', err);
      alert(`Unable to import recipe: ${err.message || 'Unknown scrape error'}`);
    } finally { setIsProcessing(false); setUrlInput(''); }
  };

  const saveRecipe = async () => {
    if (!user) return;

    const client = ensureSupabase();
    if (!client) return;

    const { error } = await client.from('recipes').insert([{ 
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
    const client = ensureSupabase();
    if (!client) return;

    const { error } = await client.from('recipes').update({ 
      title: selectedRecipe.title, 
      ingredients: selectedRecipe.ingredients, 
      directions: selectedRecipe.directions,
      notes: selectedRecipe.notes || ''
    }).eq('id', selectedRecipe.id).eq('user_id', user.id);
    if (!error) { setIsEditing(false); fetchVault(); alert("Vault Updated."); }
  };

  const deleteRecipe = async () => {
    if (confirm("Do you want to burn (delete) this recipe?")) {
      const client = ensureSupabase();
      if (!client) return;

      const { error } = await client.from('recipes').delete().eq('id', selectedRecipe.id).eq('user_id', user.id);
      if (!error) { setSelectedRecipe(null); fetchVault(); }
    }
  };

  const copyCheckedItems = () => {
    const list = splitRecipeLines(selectedRecipe.ingredients)
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
    setIsCookingMode(false);
    setIsEditing(false);
    setShowRefHUD(false);
  };

  const filteredVault = vaultItems.filter(item => item.title.toLowerCase().includes(searchQuery.toLowerCase()));
  const recipeIngredientRefs = useMemo(() => buildIngredientRefs(recipe.ingredients), [recipe.ingredients]);
  const recipeDirectionRows = useMemo(
    () => buildDirectionRows(recipe.directions, recipeIngredientRefs),
    [recipe.directions, recipeIngredientRefs]
  );
  const selectedIngredientRefs = useMemo(() => buildIngredientRefs(selectedRecipe?.ingredients), [selectedRecipe?.ingredients]);
  const selectedDirectionRows = useMemo(
    () => buildDirectionRows(selectedRecipe?.directions, selectedIngredientRefs),
    [selectedRecipe?.directions, selectedIngredientRefs]
  );

  return (
    <main className="flex min-h-dvh flex-col items-center justify-start overflow-x-hidden bg-[#0D0D0D] px-3 py-4 font-sans text-white sm:px-4 sm:py-5 lg:h-dvh lg:px-6 lg:py-6 lg:overflow-hidden">
      <div className="mb-4 flex w-full max-w-7xl flex-shrink-0 flex-col items-center text-center sm:mb-6">
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
          <Image
            src="/assets/pocket_steak_logo.png"
            alt="Logo"
            width={144}
            height={144}
            priority
            className="h-14 w-auto sm:h-16"
          />
          <div className="flex flex-col items-center">
            <h1 className="text-2xl font-black uppercase italic leading-none tracking-tighter text-[#FF4500] sm:text-3xl">PocketSteak</h1>
            <p className="mt-0.5 text-[7px] font-black uppercase italic tracking-[0.35em] text-[#FF4500] sm:tracking-[0.4em]">Pitmaster Intelligence</p>
          </div>
        </div>
      </div>

      {authLoading ? (
        <div className="flex flex-1 items-center justify-center text-[10px] font-black uppercase tracking-[0.4em] text-gray-800 animate-pulse">
          Loading pit access
        </div>
      ) : !user ? (
        <div className="mt-6 w-full max-w-md rounded-2xl border-2 border-gray-800 bg-[#141414] p-6 shadow-[0_0_0_1px_rgba(255,69,0,0.12),0_24px_70px_rgba(0,0,0,0.65)] sm:mt-10 sm:p-8">
          <div className="mb-8 border-b border-gray-800 pb-5">
            <h2 className="text-2xl font-black uppercase italic leading-none tracking-tighter text-[#FF4500]">
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
        <div className="mt-6 w-full max-w-md rounded-2xl border-2 border-gray-800 bg-[#141414] p-6 shadow-[0_0_0_1px_rgba(255,69,0,0.12),0_24px_70px_rgba(0,0,0,0.65)] sm:mt-10 sm:p-8">
          <div className="mb-8 border-b border-gray-800 pb-5">
            <h2 className="text-2xl font-black uppercase italic leading-none tracking-tighter text-[#FF4500]">
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
        <div className="flex w-full max-w-7xl flex-1 flex-col gap-4 lg:min-h-0">
          <div className="flex flex-col gap-4 lg:flex-shrink-0 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
              <button onClick={openScratchForm} className={`min-h-14 w-full rounded-2xl border px-5 py-3 uppercase transition-all shadow-lg sm:w-auto sm:rounded-full sm:py-2 ${view === 'scratch' ? 'border-[#FF4500] bg-[#1A1A1A] text-white' : 'border-gray-800 bg-[#141414] text-gray-400 hover:border-[#FF4500] hover:text-white'}`}>
                <span className="block text-[9px] font-black tracking-[0.2em]">+ From Scratch</span>
                <span className="mt-1 block text-[7px] font-bold tracking-[0.16em] text-gray-600">Make your own recipe</span>
              </button>
              <button onClick={openImportForm} className={`min-h-14 w-full rounded-2xl border px-5 py-3 uppercase transition-all shadow-lg sm:w-auto sm:rounded-full sm:py-2 ${view === 'premade' || view === 'review' ? 'border-[#FF4500] bg-[#1A1A1A] text-white' : 'border-gray-800 bg-[#141414] text-gray-400 hover:border-[#FF4500] hover:text-white'}`}>
                <span className="block text-[9px] font-black tracking-[0.2em]">+ Import Recipe</span>
                <span className="mt-1 block text-[7px] font-bold tracking-[0.16em] text-gray-600">Copy URL from web</span>
              </button>
              <button onClick={() => setShowRefHUD(!showRefHUD)} className={`min-h-14 w-full rounded-2xl border px-5 py-3 uppercase transition-all shadow-lg sm:w-auto sm:max-w-[260px] sm:rounded-full sm:py-2 ${showRefHUD ? 'border-[#FF4500] bg-[#1A1A1A] text-white' : 'border-gray-800 bg-[#141414] text-gray-400 hover:border-[#FF4500] hover:text-white'}`}>
                <span className="block text-[9px] font-black tracking-[0.2em]">Reference</span>
                <span className="mt-1 block text-[7px] font-bold tracking-[0.16em] text-gray-600">Cooking temps and measurements</span>
              </button>
            </div>

            <div className="flex flex-col gap-3 xl:items-end">
              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <div className="hidden max-w-[220px] truncate text-right text-[9px] font-black uppercase tracking-[0.2em] text-gray-600 md:block">
                  {user.email}
                </div>
                <button onClick={signOut} className="rounded-full border border-gray-800 bg-[#141414] px-4 py-2 text-[9px] font-black uppercase tracking-[0.2em] text-gray-500 transition-all hover:border-[#FF4500] hover:text-white">
                  Sign Out
                </button>
              </div>

              {isCookingMode && (
                <div className="flex w-full items-stretch overflow-hidden rounded-xl border-2 border-gray-800 bg-black shadow-2xl sm:w-auto">
                  <div className="flex min-w-0 flex-1 flex-col items-center justify-center border-r border-gray-800 bg-[#0A0A0A] px-4 py-3 sm:min-w-[120px] sm:px-6">
                    <span className="text-[7px] font-black uppercase tracking-widest text-gray-500">Mission</span>
                    <span className="font-mono text-xl font-bold text-white">{formatTime(stopwatch)}</span>
                    <button onClick={() => setSwActive(!swActive)} className={`text-[8px] font-black ${swActive ? 'text-amber-500' : 'text-emerald-500'}`}>{swActive ? 'PAUSE' : 'START'}</button>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col items-center justify-center bg-[#0F0F0F] px-4 py-3 sm:min-w-[120px] sm:px-6">
                    <span className="text-[7px] font-black uppercase tracking-widest text-gray-500">Countdown</span>
                    <span onClick={() => !cdActive && setCountdown(c => c + 60)} className={`cursor-pointer font-mono text-xl font-bold ${countdown > 0 ? 'text-[#FF4500]' : 'text-gray-700'}`}>{formatTime(countdown)}</span>
                    <button onClick={() => countdown > 0 && setCdActive(!cdActive)} className={`text-[8px] font-black ${cdActive ? 'text-amber-500' : 'text-emerald-500'}`}>{cdActive ? 'STOP' : 'GO'}</button>
                  </div>
                  <button onClick={() => { setStopwatch(0); setSwActive(false); setCountdown(0); setCdActive(false); }} className="px-4 font-black text-gray-600 transition-colors hover:text-red-500">✕</button>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4 lg:min-h-0 lg:flex-1 lg:flex-row lg:gap-6 lg:overflow-hidden">
            <div className="flex w-full flex-col gap-3 lg:w-[18rem] lg:min-h-0 lg:flex-shrink-0">
              <input placeholder="Search recipes..." className="rounded-lg border-2 border-gray-800 bg-[#141414] p-3 text-sm outline-none shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)] focus:border-[#FF4500]" onChange={(e) => setSearchQuery(e.target.value)} />
              <div className="max-h-64 overflow-hidden rounded-2xl border-2 border-gray-700 bg-[#101010] p-3 shadow-[0_0_0_1px_rgba(255,69,0,0.12),0_18px_45px_rgba(0,0,0,0.55)] lg:max-h-none lg:flex-1 lg:min-h-0">
                <div className="max-h-64 space-y-2 overflow-y-auto pr-2 custom-scrollbar lg:h-full lg:max-h-none">
                  {filteredVault.map(item => (
                    <div key={item.id} onClick={() => { setSelectedRecipe(item); setView('vault'); setShowEditor(false); setIsCookingMode(false); setIsEditing(false); setShowRefHUD(false); }} className={`rounded-xl border p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.025)] transition-all cursor-pointer ${selectedRecipe?.id === item.id ? 'border-[#FF4500] bg-[#1A1A1A]' : 'border-gray-900 bg-[#141414] hover:border-gray-700 hover:bg-[#1A1A1A]'}`}>
                      <h3 className="truncate text-sm font-bold uppercase tracking-tight">{item.title}</h3>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="relative flex min-h-[420px] flex-1 flex-col overflow-hidden rounded-2xl border-2 border-gray-700 bg-[#141414] shadow-[0_0_0_1px_rgba(255,69,0,0.12),0_24px_70px_rgba(0,0,0,0.65)] lg:min-h-0">
              {showRefHUD && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm sm:p-6"
                  onClick={() => setShowRefHUD(false)}
                >
                  <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Pitmaster reference"
                    className="w-full max-w-2xl rounded-2xl border border-[#FF4500]/50 bg-black/98 p-5 shadow-2xl sm:p-6"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="mb-4 flex items-center justify-between border-b border-gray-800 pb-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-[#FF4500]">Pitmaster Ref Intel</span>
                      <button onClick={() => setShowRefHUD(false)} className="text-gray-600 hover:text-white">✕</button>
                    </div>
                    <div className="grid grid-cols-1 gap-5 font-mono text-xs sm:grid-cols-2 sm:gap-6 sm:text-[10px]">
                      <div className="space-y-4">
                        <p className="border-b border-gray-900 text-[9px] font-black uppercase text-gray-500">Internal Temps</p>
                        <div className="flex justify-between"><span>Rare</span><span className="text-[#FF4500]">125°F</span></div>
                        <div className="flex justify-between"><span>Med-Rare</span><span className="text-[#FF4500]">135°F</span></div>
                        <div className="flex justify-between"><span>Medium</span><span className="text-[#FF4500]">145°F</span></div>
                        <div className="flex justify-between"><span>Chicken</span><span className="text-[#FF4500]">165°F</span></div>
                      </div>
                      <div className="space-y-4">
                        <p className="border-b border-gray-900 text-[9px] font-black uppercase text-gray-500">Conversions</p>
                        <div className="flex justify-between"><span>1 Cup</span><span>8 oz</span></div>
                        <div className="flex justify-between"><span>1/2 Cup</span><span>4 oz</span></div>
                        <div className="flex justify-between"><span>1 Tbsp</span><span>3 tsp</span></div>
                        <div className="flex justify-between"><span>Pint</span><span>16 oz</span></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {view === 'premade' && !showEditor ? (
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar sm:p-6 lg:p-8">
                  <div className="mx-auto max-w-xl rounded-2xl border-2 border-gray-800 bg-[#101010] p-6 text-center shadow-[inset_0_0_0_1px_rgba(255,255,255,0.025),0_18px_45px_rgba(0,0,0,0.45)] sm:p-10">
                    <h2 className="mb-6 text-xl font-black uppercase italic tracking-tighter text-[#FF4500]">Import Recipe</h2>
                    <input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="PASTE URL HERE" className="mb-4 w-full rounded-xl border border-gray-800 bg-[#0D0D0D] p-4 text-center font-bold outline-none focus:border-[#FF4500]" />
                    <button onClick={handleUrlScrape} className={`w-full rounded-xl bg-[#FF4500] p-4 font-black text-white ${isProcessing ? 'animate-pulse' : ''}`}>{isProcessing ? 'PREPPING...' : 'PREPARE RECIPE'}</button>
                  </div>
                </div>
              ) : (view === 'scratch' || view === 'review') ? (
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar sm:p-6 lg:p-8">
                  <div className="mx-auto max-w-2xl space-y-5 rounded-2xl border-2 border-gray-800 bg-[#101010] p-5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.025),0_18px_45px_rgba(0,0,0,0.45)] sm:space-y-6 sm:p-8">
                    <div className="flex items-center justify-between border-b border-gray-800 pb-4">
                      <h2 className="text-xs font-black uppercase tracking-widest text-gray-600">{view === 'review' ? 'Review Imported Recipe' : 'Recipe Intake Form'}</h2>
                    </div>
                    <input value={recipe.title} onChange={(e) => setRecipe({ ...recipe, title: e.target.value })} placeholder="RECIPE NAME" className="w-full border-b border-gray-800 bg-transparent p-2 text-2xl font-black uppercase italic outline-none focus:border-[#FF4500] sm:text-3xl" />
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-gray-600">* Each line becomes its own ingredient or instruction line.</p>
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <textarea value={recipe.ingredients} onChange={(e) => setRecipe({ ...recipe, ingredients: e.target.value })} placeholder="INGREDIENTS" className="h-48 w-full rounded-xl border border-gray-800 bg-[#0D0D0D] p-4 text-xs outline-none focus:border-[#FF4500]" />
                      <textarea value={recipe.directions} onChange={(e) => setRecipe({ ...recipe, directions: e.target.value })} placeholder="DIRECTIONS" className="h-48 w-full rounded-xl border border-gray-800 bg-[#0D0D0D] p-4 text-xs outline-none focus:border-[#FF4500]" />
                    </div>
                    <StepMeasurementPreview rows={recipeDirectionRows} />
                    <textarea value={recipe.notes} onChange={(e) => setRecipe({ ...recipe, notes: e.target.value })} placeholder="NOTES" className="h-32 w-full rounded-xl border border-gray-800 bg-[#0D0D0D] p-4 text-xs outline-none focus:border-[#FF4500]" />
                    <button onClick={saveRecipe} className="w-full rounded-xl bg-[#FF4500] p-4 font-black uppercase tracking-widest text-white transition-all shadow-lg hover:bg-[#E63E00]">SAVE TO COOKBOOK</button>
                  </div>
                </div>
              ) : selectedRecipe ? (
                <>
                  <div className="flex flex-col gap-4 border-b border-gray-800 bg-[#1A1A1A] p-4 sm:p-6 sm:flex-row sm:items-start sm:justify-between lg:flex-shrink-0">
                    {isEditing ? (
                      <input
                        aria-label="Recipe title"
                        value={selectedRecipe.title || ''}
                        onChange={(e) => setSelectedRecipe({ ...selectedRecipe, title: e.target.value })}
                        className="min-w-0 flex-1 rounded-xl border border-gray-800 bg-[#0D0D0D] px-4 py-3 text-xl font-black uppercase italic leading-none tracking-tighter text-[#FF4500] outline-none focus:border-[#FF4500] sm:text-2xl"
                      />
                    ) : (
                      <h2 className="min-w-0 flex-1 text-xl font-black uppercase italic leading-none tracking-tighter text-[#FF4500] sm:text-2xl">{selectedRecipe.title}</h2>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {!isEditing && (
                        <button onClick={() => setIsCookingMode(!isCookingMode)} className={`rounded-full border px-6 py-1.5 text-[9px] font-black ${isCookingMode ? 'border-[#FF4500] bg-[#FF4500] text-white' : 'border-gray-700 text-gray-500 hover:text-white'}`}>{isCookingMode ? 'Exit' : 'Cook'}</button>
                      )}
                      {!isCookingMode && (
                        <button onClick={() => setIsEditing(!isEditing)} className="rounded-full border border-gray-700 px-4 py-1.5 text-[9px] font-black text-gray-500 hover:text-white">{isEditing ? 'Cancel' : 'Edit'}</button>
                      )}
                      {!isCookingMode && !isEditing && (
                        <button onClick={deleteRecipe} className="rounded-full border border-red-900/50 px-4 py-1.5 text-[9px] font-black text-red-900 hover:bg-red-900 hover:text-white">Burn</button>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto p-4 custom-scrollbar sm:p-6">
                    {isEditing ? (
                      <div className="flex flex-col gap-4 pr-1 sm:pr-2">
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                          <textarea value={selectedRecipe.ingredients || ''} onChange={(e) => setSelectedRecipe({ ...selectedRecipe, ingredients: e.target.value })} className="h-52 rounded-xl border border-gray-800 bg-[#0D0D0D] p-4 text-xs outline-none focus:border-[#FF4500] sm:h-56" />
                          <textarea value={selectedRecipe.directions || ''} onChange={(e) => setSelectedRecipe({ ...selectedRecipe, directions: e.target.value })} className="h-52 rounded-xl border border-gray-800 bg-[#0D0D0D] p-4 text-xs outline-none focus:border-[#FF4500] sm:h-56" />
                        </div>
                        <StepMeasurementPreview rows={selectedDirectionRows} />
                        <textarea value={selectedRecipe.notes || ''} onChange={(e) => setSelectedRecipe({ ...selectedRecipe, notes: e.target.value })} placeholder="NOTES" className="h-32 w-full rounded-xl border border-gray-800 bg-[#0D0D0D] p-4 text-xs outline-none focus:border-[#FF4500]" />
                        <button onClick={updateRecipe} className="w-full rounded-xl bg-[#FF4500] p-4 font-black uppercase tracking-widest text-white transition-all hover:bg-[#E63E00]">Update Cookbook</button>
                      </div>
                    ) : isCookingMode ? (
                      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 pb-8 sm:gap-12 sm:pb-20">
                        <section>
                          <h4 className="mb-4 text-xs font-black uppercase text-[#FF4500]">Prep Checklist</h4>
                          <div className="space-y-3">
                            {selectedIngredientRefs.map((ingredient, i) => (
                              <div key={`${i}-${ingredient.line}`} onClick={() => setCheckedIngredients({ ...checkedIngredients, [i]: !checkedIngredients[i] })} className={`cursor-pointer rounded-xl border p-3 transition-all sm:p-4 ${checkedIngredients[i] ? 'border-transparent bg-black opacity-10' : 'border-gray-800 bg-[#1A1A1A]'}`}>
                                <div className="flex items-start gap-4">
                                  <div className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded border-2 ${checkedIngredients[i] ? 'border-emerald-500 bg-emerald-500' : 'border-gray-600'}`}>{checkedIngredients[i] && '✓'}</div>
                                  <span className="text-base sm:text-lg">{ingredient.line}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </section>
                        <section>
                          <h4 className="mb-4 text-xs font-black uppercase text-[#FF4500]">The Process</h4>
                          <div className="space-y-4">
                            {selectedDirectionRows.map(({ step, ingredients }, i) => {
                              return (
                                <div key={`${i}-${step}`} onClick={() => setCheckedDirections({ ...checkedDirections, [i]: !checkedDirections[i] })} className={`cursor-pointer rounded-2xl border-l-4 p-4 transition-all sm:p-6 ${checkedDirections[i] ? 'border-gray-900 bg-black opacity-10' : 'border-[#FF4500] bg-[#1A1A1A]'}`}>
                                  <p className="text-base leading-relaxed sm:text-lg">{step}</p>
                                  {ingredients.length > 0 && (
                                    <div className="mt-4 space-y-2 border-t border-gray-800 pt-3">
                                      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-gray-600">Uses</p>
                                      {ingredients.map((ingredient) => (
                                        <p key={ingredient} className="text-sm font-black leading-relaxed text-[#FF4500]">{ingredient}</p>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </section>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-4 sm:gap-6">
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
                          <div className="flex flex-col rounded-xl border-2 border-gray-800 bg-[#0D0D0D] p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.025),0_12px_30px_rgba(0,0,0,0.28)] sm:p-5">
                            <div className="mb-5 flex items-center justify-between gap-3">
                              <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-600">Ingredients</h4>
                              <div className="flex gap-2 text-[10px] font-black uppercase">
                                <button onClick={copyCheckedItems} className="text-[#FF4500] hover:underline">Copy</button>
                                <span className="text-gray-800">/</span>
                                <button onClick={clearChecks} className="text-gray-500 hover:text-white">Clear</button>
                              </div>
                            </div>
                            <div className="max-h-72 space-y-3 overflow-y-auto pr-2 custom-scrollbar lg:flex-1 lg:min-h-0 lg:max-h-none">
                              {selectedIngredientRefs.map((ingredient, i) => (
                                <div key={`${i}-${ingredient.line}`} className="group flex cursor-pointer items-start gap-3" onClick={() => setCheckedIngredients({ ...checkedIngredients, [i]: !checkedIngredients[i] })}>
                                  <div className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-all ${checkedIngredients[i] ? 'border-[#FF4500] bg-[#FF4500]' : 'border-gray-700 group-hover:border-gray-500'}`}>
                                    {checkedIngredients[i] && <span className="text-[8px] font-bold text-white">✓</span>}
                                  </div>
                                  <span className={`text-sm leading-tight transition-all ${checkedIngredients[i] ? 'italic line-through text-gray-700' : 'text-gray-300'}`}>{ingredient.line}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="flex flex-col rounded-xl border-2 border-gray-800 bg-[#0D0D0D] p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.025),0_12px_30px_rgba(0,0,0,0.28)] sm:p-5">
                            <h4 className="mb-5 text-[10px] font-black uppercase tracking-widest text-gray-600">Directions</h4>
                            <div className="max-h-80 space-y-4 overflow-y-auto pr-2 text-sm text-gray-400 custom-scrollbar lg:flex-1 lg:min-h-0 lg:max-h-none">
                              {selectedDirectionRows.map(({ step, ingredients }, i) => {
                                return (
                                  <div key={`${i}-${step}`} className="flex gap-3">
                                    <span className="font-black italic text-[#FF4500]">{i + 1}</span>
                                    <div className="min-w-0">
                                      <p>{step}</p>
                                      {ingredients.length > 0 && (
                                        <div className="mt-2 space-y-1 border-l border-[#FF4500]/35 pl-3">
                                          <p className="text-[8px] font-black uppercase tracking-[0.18em] text-gray-600">Uses</p>
                                          {ingredients.map((ingredient) => (
                                            <p key={ingredient} className="text-xs font-black leading-relaxed text-[#FF4500]">{ingredient}</p>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                        <div className="rounded-xl border-2 border-gray-800 bg-[#0D0D0D] p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.025),0_12px_30px_rgba(0,0,0,0.28)] sm:p-5">
                          <h4 className="mb-4 text-[10px] font-black uppercase tracking-widest text-gray-600">Notes</h4>
                          <div className="max-h-48 overflow-y-auto pr-2 text-sm leading-relaxed text-gray-400 whitespace-pre-wrap custom-scrollbar">
                            {selectedRecipe.notes?.trim() || 'No field notes yet.'}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex min-h-[320px] flex-1 items-center justify-center p-6 text-center text-[10px] font-black uppercase tracking-[0.4em] text-gray-800 animate-pulse">
                  Select intel from recipe list
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
