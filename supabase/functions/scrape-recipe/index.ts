import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 1. Handle browser permission check
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { url } = await req.json()
    
    // 2. Fetch the page while pretending to be a real Chrome browser
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
      }
    })
    
    const html = await response.text()

    // 3. Search the HTML for Recipe Metadata
    const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)
    let recipeData = null

    if (jsonLdMatch) {
      for (const script of jsonLdMatch) {
        try {
          const content = script.replace(/<script type="application\/ld\+json">|<\/script>/g, '')
          const parsed = JSON.parse(content)
          
          // Look for "Recipe" in single objects, arrays, or @graph structures
          const found = Array.isArray(parsed) 
            ? parsed.find(i => i['@type'] === 'Recipe')
            : (parsed['@graph'] ? parsed['@graph'].find(i => i['@type'] === 'Recipe') : (parsed['@type'] === 'Recipe' ? parsed : null))
          
          if (found) {
            recipeData = found
            break
          }
        } catch (e) { continue }
      }
    }

    if (!recipeData) throw new Error('The Pit couldn\'t find recipe data on this page.')

    // 4. Format the output for the frontend
    const ingredients = Array.isArray(recipeData.recipeIngredient) 
      ? recipeData.recipeIngredient.join('\n') 
      : (recipeData.recipeIngredient || "");

    const directions = Array.isArray(recipeData.recipeInstructions) 
      ? recipeData.recipeInstructions.map((i: any) => i.text || i).join('\n') 
      : (recipeData.recipeInstructions || "");

    // 5. Send success back to the website
    return new Response(
      JSON.stringify({
        title: recipeData.name || "Untitled Steak",
        ingredients: ingredients,
        directions: directions
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    // Send error back to the website
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})