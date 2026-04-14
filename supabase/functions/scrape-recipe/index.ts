import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function getRecipeFromAI(html: string, openAiKey: string) {
  const cleanText = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<[^>]*>?/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 30000);

  const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Extract recipe to JSON: title, ingredients, directions. If you cannot find ingredients, return ingredients: "NOT_FOUND".' },
        { role: 'user', content: `TEXT CONTENT: ${cleanText}` }
      ],
      response_format: { type: "json_object" },
      temperature: 0
    }),
  })
  const data = await aiRes.json();
  return JSON.parse(data.choices[0].message.content);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { url } = await req.json()
    const openAiKey = Deno.env.get('OPENAI_API_KEY')
    const sbKey = Deno.env.get('SCRAPINGBEE_API_KEY')

    // --- PASS 1: FAST FETCH ---
    console.log("LOG: Pass 1 - Fast Fetching...");
    const fastRes = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const fastHtml = await fastRes.text();
    
    let recipe = await getRecipeFromAI(fastHtml, openAiKey);

    // --- CHECK IF WE NEED PASS 2 ---
    // If ingredients are missing or the AI explicitly said NOT_FOUND
    if (!recipe.ingredients || recipe.ingredients === "NOT_FOUND" || recipe.ingredients.length < 10) {
      console.log("LOG: Pass 1 failed to find ingredients. Pass 2 - Launching STEALTH MODE...");
      
      const sbUrl = `https://app.scrapingbee.com/api/v1/?api_key=${sbKey}&url=${encodeURIComponent(url)}&render_js=true`;
      const stealthRes = await fetch(sbUrl);
      const stealthHtml = await stealthRes.text();
      
      recipe = await getRecipeFromAI(stealthHtml, openAiKey);
    } else {
      console.log("LOG: Pass 1 Succeeded. Recipe found without Stealth.");
    }

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