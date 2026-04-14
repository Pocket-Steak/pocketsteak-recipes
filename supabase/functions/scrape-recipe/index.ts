import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle browser permission check
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { url } = await req.json()
    
    const openAiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openAiKey) throw new Error("OpenAI Key missing from Supabase Secrets")

    // 1. Fetch the raw HTML from the website
    const siteRes = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36' }
    })
    const html = await siteRes.text()

    // 2. Use OpenAI to "Read" the specific HTML provided
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
            content: 'You are a master data extractor. I will provide HTML from a recipe website. Your task is to extract the EXACT title, ingredients, and directions from the text provided. Do not use your own knowledge; only use what is in the HTML. Return a JSON object with: "title", "ingredients" (string), and "directions" (string).' 
          },
          { 
            role: 'user', 
            content: `Extract the specific recipe from this HTML: ${html.slice(0, 30000)}` 
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1 // Keeps the AI focused on facts, not creativity
      }),
    })

    const aiData = await aiRes.json()
    
    if (aiData.error) throw new Error(aiData.error.message)

    const recipe = JSON.parse(aiData.choices[0].message.content)

    // 3. Send the specific recipe back to your website
    return new Response(JSON.stringify({
      title: recipe.title || "Unknown Recipe",
      ingredients: recipe.ingredients || "",
      directions: recipe.directions || ""
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})