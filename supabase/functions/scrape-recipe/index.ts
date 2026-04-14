import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { url } = await req.json()
    
    // Grabbing the key you set up in Supabase Secrets earlier
    const openAiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openAiKey) throw new Error("OpenAI Key missing from Supabase Secrets")

    // 1. Get the raw HTML
    const siteRes = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })
    const html = await siteRes.text()

    // 2. Use the AI Chef to extract the recipe
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
            content: 'You are a professional chef. I will give you raw HTML from a recipe site. Return ONLY a JSON object with: title, ingredients (string with newlines), and directions (string with newlines).' 
          },
          { role: 'user', content: `Extract the steak recipe from this: ${html.slice(0, 20000)}` }
        ],
        response_format: { type: "json_object" }
      }),
    })

    const aiData = await aiRes.json()
    
    // Check if OpenAI returned an error (like quota)
    if (aiData.error) throw new Error(aiData.error.message)

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