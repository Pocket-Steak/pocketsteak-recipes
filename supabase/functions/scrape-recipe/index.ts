import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

async function fetchText(url: string, options: RequestInit = {}) {
  const res = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(25000),
  })

  const text = await res.text()

  if (!res.ok) {
    throw new Error(`Fetch failed for ${url}: ${res.status} ${text.slice(0, 160)}`)
  }

  return text
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

  if (!aiRes.ok) {
    throw new Error(`OpenAI extraction failed: ${data.error?.message || aiRes.statusText}`)
  }

  const message = data.choices?.[0]?.message?.content

  if (!message) {
    throw new Error("OpenAI returned no recipe content")
  }

  try {
    return JSON.parse(message);
  } catch (_error) {
    throw new Error(`OpenAI returned invalid recipe JSON: ${message.slice(0, 160)}`)
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { url } = await req.json()
    const openAiKey = Deno.env.get('OPENAI_API_KEY')

    if (!openAiKey) throw new Error("Missing OpenAI Key in Supabase Secrets")
    if (!url || !/^https?:\/\//.test(url)) throw new Error("Recipe URL must start with http:// or https://")

    console.log(`LOG: Starting extraction for ${url}`)

    const html = await fetchText(url, { 
      headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' } 
    })
    console.log(`LOG: Pass 1 fetched ${html.length} chars`)
    
    let recipe = await getRecipeFromAI(html, openAiKey)

    if (!recipe.ingredients || recipe.ingredients === "NOT_FOUND" || recipe.ingredients.length < 10) {
      console.log("LOG: Pass 1 failed. Triggering Jina Fallback...")
      const stealthMarkdown = await fetchText(`https://r.jina.ai/${url}`)
      console.log(`LOG: Jina fallback fetched ${stealthMarkdown.length} chars`)
      recipe = await getRecipeFromAI(stealthMarkdown, openAiKey)
    }

    if (!recipe.ingredients || recipe.ingredients === "NOT_FOUND" || recipe.ingredients.length < 10) {
      throw new Error("Recipe extraction failed after fast fetch and Jina fallback")
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
