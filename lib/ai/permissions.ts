import { AiError } from './errors'

export type AiPermissionScope =
  | 'profile:read_self'
  | 'social:read_self'
  | 'social:create_post'
  | 'social:read_feed'
  | 'business:read_self'
  | 'business:create_service'
  | 'public:read'

const FORBIDDEN_RESOURCE_PATTERNS = [
  'messages', // Direct private messaging between users is STRICTLY DENIED for AI
  'direct_messages',
  'user_secrets',
  'auth_tokens',
  'billing_secrets',
  'private_conversations',
  'ai_memory:other',
  'ai_messages:other',
  'ai_conversations:other',
  'profiles:private_email',
  'private_files',
  'query_database',
  'execute_sql',
  'read_table',
  'admin_query',
  'search_web',
  'web_search',
  'browse_web_page',
  'platform_stats',
  'platform_users',
]

export function checkResourceAccess(resourceName: string): void {
  const normalized = resourceName.toLowerCase().trim()
  for (const forbidden of FORBIDDEN_RESOURCE_PATTERNS) {
    if (normalized === forbidden || normalized.startsWith(forbidden + '/') || normalized.startsWith(forbidden + ':')) {
      throw new AiError(
        'AI_FORBIDDEN',
        `Neturiu prieigos prie kito vartotojo privačių duomenų, interneto paieškos ar bendros platformos statistikos ("${resourceName}").`,
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
    case 'prepare_create_post':
    case 'create_post':
      if (!userScopes.has('social:create_post') && !userScopes.has('social:read_self')) {
        throw new AiError('AI_FORBIDDEN', 'Trūksta teisės skelbti įrašus', { status: 403 })
      }
      break
    case 'get_public_feed':
      if (!userScopes.has('social:read_feed') && !userScopes.has('public:read')) {
        throw new AiError('AI_FORBIDDEN', 'Trūksta teisės skaityti viešą feed', { status: 403 })
      }
      break
    case 'prepare_create_service':
    case 'create_service':
      if (!userScopes.has('business:create_service') && !userScopes.has('business:read_self')) {
        throw new AiError('AI_FORBIDDEN', 'Trūksta teisės kurti paslaugas', { status: 403 })
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
