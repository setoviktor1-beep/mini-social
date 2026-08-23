import { AiError } from './errors'

export type AiPermissionScope =
  | 'profile:read_self'
  | 'social:read_self'
  | 'business:read_self'
  | 'public:read'

const FORBIDDEN_RESOURCE_PATTERNS = [
  'messages', // Direct private messaging between users is STRICTLY DENIED for AI
  'direct_messages',
  'user_secrets',
  'auth_tokens',
  'billing_secrets',
]

export function checkResourceAccess(resourceName: string): void {
  const normalized = resourceName.toLowerCase().trim()
  for (const forbidden of FORBIDDEN_RESOURCE_PATTERNS) {
    if (normalized === forbidden || normalized.startsWith(forbidden + '/')) {
      throw new AiError(
        'AI_FORBIDDEN',
        `AI prieiga prie resurso "${resourceName}" yra griežtai draudžiama.`,
        { status: 403 },
      )
    }
  }
}

export function validateToolPermission(
  toolName: string,
  userScopes: Set<AiPermissionScope>,
): void {
  switch (toolName) {
    case 'get_my_profile':
      if (!userScopes.has('profile:read_self')) {
        throw new AiError('AI_FORBIDDEN', 'Trūksta teisės skaityti savo profilį', { status: 403 })
      }
      break
    case 'get_my_posts':
    case 'get_my_bookmarks':
    case 'get_my_notifications':
      if (!userScopes.has('social:read_self')) {
        throw new AiError('AI_FORBIDDEN', 'Trūksta teisės skaityti savo socialinius duomenis', { status: 403 })
      }
      break
    case 'get_my_business_stats':
    case 'get_my_services':
    case 'get_my_orders':
      if (!userScopes.has('business:read_self')) {
        throw new AiError('AI_FORBIDDEN', 'Trūksta teisės skaityti verslo duomenis', { status: 403 })
      }
      break
    case 'search_public_posts':
    case 'search_public_services':
    case 'get_public_profile':
      if (!userScopes.has('public:read')) {
        throw new AiError('AI_FORBIDDEN', 'Trūksta teisės atlikti viešą paiešką', { status: 403 })
      }
      break
    default:
      throw new AiError('AI_FORBIDDEN', `Neleistinas arba nežinomas įrankis: ${toolName}`, { status: 403 })
  }
}
