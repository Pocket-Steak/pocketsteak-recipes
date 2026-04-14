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

    // 1. Get the page content
    const siteRes = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36' }
    })
    const html = await siteRes.text()

    // 2. STRIP ALL HTML TAGS - This leaves just the raw text of the recipe
    const cleanText = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
      .replace(/<[^>]*>?/gm, ' ') // Remove all HTML tags
      .replace(/\s+/g, ' ')       // Collapse extra spaces
      .trim()
      .slice(0, 20000);           // Keep the first 20k characters of text

    // 3. The AI Extraction
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
            content: 'You are a recipe parser. I will provide raw text from a website. Extract the Title, Ingredients, and Directions into a JSON object. If you see "Mississippi Chicken Chili" or specific ingredients like "ranch dressing mix", include them. Return ONLY JSON.' 
          },
          { role: 'user', content: `Extract the recipe from this text: ${cleanText}` }
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