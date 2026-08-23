export interface AiModelOption {
  id: string
  name: string
  provider: string
  badge: string
  description: string
}

export const AVAILABLE_AI_MODELS: AiModelOption[] = [
  {
    id: 'nvidia/nemotron-3-ultra-550b-a55b:free',
    name: 'NVIDIA Nemotron Ultra',
    provider: 'nvidia',
    badge: 'Ultra / Free',
    description: 'Aukščiausio lygio mąstymas ir tikslumas',
  },
  {
    id: 'google/gemini-3.5-flash-lite',
    name: 'Google Gemini 3.5 Flash-Lite',
    provider: 'google',
    badge: '3.5 Flash-Lite',
    description: 'Greiti atsakymai ir idėjų generavimas',
  },
  {
    id: 'google/gemma-4-31b-it:free',
    name: 'Google Gemma 4 31B-IT',
    provider: 'google',
    badge: 'Free',
    description: 'Open-source atviro kodo modelis',
  },
]

export const DEFAULT_AI_MODEL_ID = 'nvidia/nemotron-3-ultra-550b-a55b:free'
