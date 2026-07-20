// Cozyla screenshot → structured data via Claude vision.
// Calls the Anthropic API directly from the browser using the user's own key
// (stored locally, never in the repo). This is acceptable for a personal/family
// app; the key never leaves the device except in requests to Anthropic.

const MODEL = 'claude-sonnet-5'
const API_URL = 'https://api.anthropic.com/v1/messages'

export type ImportKind = 'recipe' | 'plan' | 'grocery'

export interface ParsedRecipe {
  name: string
  servings: number | null
  perServing?: { kcal?: number; protein?: number; carbs?: number; fat?: number }
  ingredients: string[] // raw lines, e.g. "212 g brown sugar"
  category?: string
}
export interface ParsedPlanDay { date?: string; day?: string; meals: { slot: string; name: string }[] }
export interface ParsedGrocery { items: string[] }

export interface VisionResult {
  kind: ImportKind
  recipe?: ParsedRecipe
  plan?: ParsedPlanDay[]
  grocery?: ParsedGrocery
  raw: string
  cost: ImportCost
}

// claude-sonnet-5 standard pricing (USD per token). Images bill as input tokens.
const USD_PER_INPUT_TOKEN = 3 / 1_000_000
const USD_PER_OUTPUT_TOKEN = 15 / 1_000_000

export interface ImportCost {
  inputTokens: number
  outputTokens: number
  usd: number
}

function costFrom(usage: { input_tokens?: number; output_tokens?: number } | undefined): ImportCost {
  const input = usage?.input_tokens ?? 0
  const output = usage?.output_tokens ?? 0
  return { inputTokens: input, outputTokens: output, usd: input * USD_PER_INPUT_TOKEN + output * USD_PER_OUTPUT_TOKEN }
}

const PROMPTS: Record<ImportKind, string> = {
  recipe: `This is a screenshot of a recipe from the Cozyla family planner app. Extract it as JSON with this exact shape:
{"kind":"recipe","recipe":{"name":string,"servings":number|null,"perServing":{"kcal":number,"protein":number,"carbs":number,"fat":number}|null,"ingredients":[string],"category":string|null}}
- "perServing" = the "Nutrition per Serving" values if shown (kcal, grams). Omit fields not shown.
- "ingredients" = each ingredient line verbatim including its quantity, e.g. "212 G Brown Sugar".
Respond with ONLY the JSON, no prose.`,
  plan: `This is a screenshot of a weekly meal plan from the Cozyla app (days as columns, meal slots as rows: Breakfast/Lunch/Dinner/Snack). Extract as JSON:
{"kind":"plan","plan":[{"day":string,"date":string|null,"meals":[{"slot":"breakfast"|"lunch"|"dinner"|"snack","name":string}]}]}
Include only cells that contain a meal. Respond with ONLY the JSON.`,
  grocery: `This is a screenshot of a grocery/shopping list from the Cozyla app. Extract every item as JSON:
{"kind":"grocery","grocery":{"items":[string]}}
One entry per item, verbatim. Respond with ONLY the JSON.`,
}

/** Strip an optional ```json fence and parse. */
function parseJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  return JSON.parse(start >= 0 ? cleaned.slice(start, end + 1) : cleaned)
}

export async function parseScreenshot(
  apiKey: string, kind: ImportKind, base64Image: string, mediaType: string,
): Promise<VisionResult> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Image } },
          { type: 'text', text: PROMPTS[kind] },
        ],
      }],
    }),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => '')
    if (res.status === 401) throw new Error('API key rejected — check it in Settings.')
    if (res.status === 429) throw new Error('Rate limited — wait a moment and try again.')
    throw new Error(`Anthropic API error ${res.status}: ${err.slice(0, 200)}`)
  }

  const data = await res.json()
  const text: string = data?.content?.[0]?.text ?? ''
  const cost = costFrom(data?.usage)
  let parsed: Record<string, unknown>
  try {
    parsed = parseJson(text) as Record<string, unknown>
  } catch {
    throw new Error('Could not read the screenshot — try a clearer, full-screen image.')
  }
  return { kind, recipe: parsed.recipe as never, plan: parsed.plan as never, grocery: parsed.grocery as never, raw: text, cost }
}

/** File → base64 (no data: prefix) + media type, for the API. */
export function fileToBase64(file: File): Promise<{ data: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const comma = result.indexOf(',')
      resolve({ data: result.slice(comma + 1), mediaType: file.type || 'image/jpeg' })
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
