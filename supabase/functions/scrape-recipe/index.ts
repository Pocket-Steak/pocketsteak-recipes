import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// This helper function talks to OpenAI
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
          content: 'You are a professional recipe extractor. Extract the recipe to a JSON object with keys: "title", "ingredients", and "directions". If you cannot find a recipe in the text, return ingredients: "NOT_FOUND".' 
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
  // Handle CORS for your website
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { url } = await req.json()
    const openAiKey = Deno.env.get('OPENAI_API_KEY')

    // --- PASS 1: THE FAST WAY ---
    console.log("LOG: Pass 1 (Fast Fetching)...")
    const fastRes = await fetch(url, { 
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36' } 
    })
    const html = await fastRes.text()
    
    // Check with AI if the fast fetch worked
    let recipe = await getRecipeFromAI(html, openAiKey)

    // --- PASS 2: THE JINA WAY ($0 STEALTH) ---
    // If ingredients are missing or the AI says NOT_FOUND, use Jina
    if (!recipe.ingredients || recipe.ingredients === "NOT_FOUND" || recipe.ingredients.length < 10) {
      console.log("LOG: Pass 1 failed. Triggering Jina Reader ($0 Stealth)...")
      
      const stealthRes = await fetch(`https://r.jina.ai/${url}`)
      const stealthMarkdown = await stealthRes.text()
      
      // Send the clean Jina Markdown back to AI for a second try
      recipe = await getRecipeFromAI(stealthMarkdown, openAiKey)
    } else {
      console.log("LOG: Pass 1 Succeeded. Recipe found without Stealth.");
    }

    // Return the final recipe to your website
    return new Response(JSON.stringify(recipe), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error("LOG: Pipeline Error ->", error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})