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

    console.log("LOG: Scraping URL ->", url)

    // 1. Get the page content
    const siteRes = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36' }
    })
    const html = await siteRes.text()

    // 2. Clean the meat
    const cleanText = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
      .replace(/<[^>]*>?/gm, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 30000); // Increased slice to 30k for bigger pages

    // 3. The AI Extraction (Strictly Dynamic)
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
            content: 'You are a professional recipe extractor. Extract the recipe from the provided text. Return ONLY a JSON object with keys: "title", "ingredients", and "directions". If no recipe is found, return an error message within those keys.' 
          },
          { role: 'user', content: `URL: ${url}\n\nTEXT CONTENT: ${cleanText}` }
        ],
        response_format: { type: "json_object" },
        temperature: 0
      }),
    })

    const aiData = await aiRes.json()
    
    // Check if AI actually returned a message
    if (!aiData.choices?.[0]?.message?.content) {
      throw new Error("AI failed to return data");
    }

    const recipe = JSON.parse(aiData.choices[0].message.content)

    return new Response(JSON.stringify(recipe), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error("LOG: Error caught ->", error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})