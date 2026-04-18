import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  // CRITICAL FOR SAFARI: Explicitly allow these methods
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

async function getRecipeFromAI(content: string, openAiKey: string) {
  const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { 
          role: 'system', 
          content: `You are a professional recipe extractor. 
          1. Extract the recipe to a JSON object with keys: "title", "ingredients", and "directions".
          2. Format ingredients as a clean list with one item per line. 
          3. DIRECTIONS MUST BE A LIST: Break directions into short, single-action steps. No long paragraphs.
          4. If ingredients are missing, return ingredients: "NOT_FOUND".` 
        },
        { role: 'user', content: `TEXT CONTENT: ${content.slice(0, 30000)}` }
      ],
      response_format: { type: "json_object" },
      temperature: 0
    }),
  })
  const data = await aiRes.json();
  return JSON.parse(data.choices[0].message.content);
}

serve(async (req) => {
  // Handle CORS Pre-flight (This is the "Handshake" Safari requires)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { url } = await req.json()
    const openAiKey = Deno.env.get('OPENAI_API_KEY')

    if (!openAiKey) throw new Error("Missing OpenAI Key in Supabase Secrets")

    console.log(`LOG: Starting extraction for ${url}`)

    // --- PASS 1: FAST FETCH ---
    const fastRes = await fetch(url, { 
      headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' } 
    })
    const html = await fastRes.text()
    
    let recipe = await getRecipeFromAI(html, openAiKey)

    // --- PASS 2: JINA FALLBACK ---
    if (!recipe.ingredients || recipe.ingredients === "NOT_FOUND" || recipe.ingredients.length < 10) {
      console.log("LOG: Pass 1 failed. Triggering Jina Fallback...")
      const stealthRes = await fetch(`https://r.jina.ai/${url}`)
      const stealthMarkdown = await stealthRes.text()
      recipe = await getRecipeFromAI(stealthMarkdown, openAiKey)
    }

    return new Response(JSON.stringify(recipe), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error("LOG: Pipeline Error ->", error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
