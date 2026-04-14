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
    const sbKey = Deno.env.get('SCRAPINGBEE_API_KEY')

    console.log("LOG: Stealth Scraping URL ->", url)

    // 1. Call ScrapingBee instead of the website directly
    // render_js=true tells it to act like a real Chrome browser
    const sbUrl = `https://app.scrapingbee.com/api/v1/?api_key=${sbKey}&url=${encodeURIComponent(url)}&render_js=true`
    
    const siteRes = await fetch(sbUrl)
    
    if (!siteRes.ok) {
        throw new Error(`ScrapingBee failed: ${siteRes.statusText}`)
    }
    
    const html = await siteRes.text()

    // 2. Clean the meat (stripping the HTML bloat)
    const cleanText = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
      .replace(/<[^>]*>?/gm, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 35000); 

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
            content: 'You are a professional recipe extractor. Extract the recipe from the provided text. Return ONLY a JSON object with keys: "title", "ingredients", and "directions".' 
          },
          { role: 'user', content: `TEXT CONTENT: ${cleanText}` }
        ],
        response_format: { type: "json_object" },
        temperature: 0
      }),
    })

    const aiData = await aiRes.json()
    
    if (!aiData.choices?.[0]?.message?.content) {
      throw new Error("OpenAI failed to process the stealth data");
    }

    const recipe = JSON.parse(aiData.choices[0].message.content)

    return new Response(JSON.stringify(recipe), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error("LOG: Stealth Error ->", error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})