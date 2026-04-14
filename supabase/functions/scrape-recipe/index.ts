import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { url } = await req.json()
    const response = await fetch(url)
    const html = await response.text()

    // Look for the "Recipe" data hidden in the site's code
    const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)
    let recipeData = null

    if (jsonLdMatch) {
      for (const script of jsonLdMatch) {
        try {
          const content = script.replace(/<script type="application\/ld\+json">|<\/script>/g, '')
          const parsed = JSON.parse(content)
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

    if (!recipeData) throw new Error('No recipe data found on this page.')

    // Format for PocketSteak
    return new Response(
      JSON.stringify({
        title: recipeData.name,
        ingredients: Array.isArray(recipeData.recipeIngredient) ? recipeData.recipeIngredient.join('\n') : recipeData.recipeIngredient,
        directions: Array.isArray(recipeData.recipeInstructions) 
          ? recipeData.recipeInstructions.map((i: any) => i.text || i).join('\n') 
          : recipeData.recipeInstructions
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})