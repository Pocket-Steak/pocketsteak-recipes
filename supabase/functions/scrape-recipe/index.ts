import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { url } = await req.json()
    const openAiKey = Deno.env.get('OPENAI_API_KEY')

    // 1. Fetch with a very "Human" header to prevent being blocked
    const siteRes = await fetch(url, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    })
    
    let html = await siteRes.text()

    // 2. Aggressively clean the HTML so the AI doesn't get "drowned" in code
    const cleanedHtml = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, "")
      .slice(0, 60000); // 60k characters is plenty

    // 3. The AI "Eagle Eye" Request
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
            content: 'You are a professional recipe scraper. I will give you HTML from a cooking site. Look specifically for the ingredients list (usually near keywords like Walmart, shopping list, or checkboxes). Return a JSON object with: "title", "ingredients", and "directions". If you cannot find them, return an error message in the JSON.' 
          },
          { role: 'user', content: `Extract the recipe from this HTML: ${cleanedHtml}` }
        ],
        response_format: { type: "json_object" },
        temperature: 0
      }),
    })

    const aiData = await aiRes.json()
    const recipe = JSON.parse(aiData.choices[0].message.content)

    return new Response(JSON.stringify(recipe), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})