import { AiPermissionScope, validateToolPermission } from '../permissions'
import { getMyProfile } from './profile'
import { getMyPosts, getMyBookmarks, getMyNotifications } from './social'
import { getMyBusinessStats, getMyServices, getMyOrders } from './business'
import { searchPublicPosts, searchPublicServices } from './search'
import { getPublicProfile } from './public'

export interface ToolExecutionContext {
  userId: string
  supabase: any
  scopes?: Set<AiPermissionScope>
}

export const ALLOWED_TOOLS_DEFINITIONS = [
  {
    name: 'get_my_profile',
    description: 'Gauna dabartinio prisijungusio vartotojo profilio duomenis',
    parameters: {},
  },
  {
    name: 'get_my_posts',
    description: 'Gauna dabartinio prisijungusio vartotojo paskutinius įrašus',
    parameters: {
      limit: { type: 'number', description: 'Kiek įrašų grąžinti (1-20, pagal nutylėjimą 10)' },
    },
  },
  {
    name: 'get_my_bookmarks',
    description: 'Gauna dabartinio vartotojo išsaugotus įrašus',
    parameters: {
      limit: { type: 'number', description: 'Kiek įrašų grąžinti (1-20)' },
    },
  },
  {
    name: 'get_my_notifications',
    description: 'Gauna dabartinio vartotojo naujausius pranešimus',
    parameters: {
      limit: { type: 'number', description: 'Kiek pranešimų grąžinti (1-20)' },
    },
  },
  {
    name: 'get_my_business_stats',
    description: 'Gauna dabartinio meistro/verslo šio ir praėjusio mėnesio pajamas, užsakymų statistiką',
    parameters: {},
  },
  {
    name: 'get_my_services',
    description: 'Gauna dabartinio meistro teikiamų paslaugų sąrašą ir kainas',
    parameters: {},
  },
  {
    name: 'get_my_orders',
    description: 'Gauna dabartinio vartotojo meistro arba kliento užsakymų istoriją',
    parameters: {
      limit: { type: 'number', description: 'Kiek užsakymų grąžinti (1-20)' },
    },
  },
  {
    name: 'search_public_posts',
    description: 'Ieško viešų socialinio tinklo įrašų pagal raktinį žodį',
    parameters: {
      query: { type: 'string', description: 'Paieškos frazė', required: true },
      limit: { type: 'number', description: 'Rezultatų limitas (1-10)' },
    },
  },
  {
    name: 'search_public_services',
    description: 'Ieško meistrų viešų paslaugų pagal raktinį žodį',
    parameters: {
      query: { type: 'string', description: 'Paieškos frazė', required: true },
      limit: { type: 'number', description: 'Rezultatų limitas (1-10)' },
    },
  },
  {
    name: 'get_public_profile',
    description: 'Gauna kito vartotojo viešą profilį pagal slapyvardį (@username)',
    parameters: {
      identifier: { type: 'string', description: 'Vartotojo slapyvardis arba ID', required: true },
    },
  },
]

export async function executeTool(
  toolName: string,
  args: Record<string, any> = {},
  context: ToolExecutionContext,
): Promise<any> {
  const { userId, supabase, scopes } = context

  const activeScopes = scopes || new Set<AiPermissionScope>([
    'profile:read_self',
    'social:read_self',
    'business:read_self',
    'public:read',
  ])

  // Validate that the tool is authorized under the active scopes
  validateToolPermission(toolName, activeScopes)

  // Explicitly disallow passing arbitrary userId for user-specific tools:
  // we always pass the server-authenticated context.userId
  switch (toolName) {
    case 'get_my_profile':
      return getMyProfile(userId, supabase)
    case 'get_my_posts':
      return getMyPosts(userId, supabase, args.limit)
    case 'get_my_bookmarks':
      return getMyBookmarks(userId, supabase, args.limit)
    case 'get_my_notifications':
      return getMyNotifications(userId, supabase, args.limit)
    case 'get_my_business_stats':
      return getMyBusinessStats(userId, supabase)
    case 'get_my_services':
      return getMyServices(userId, supabase)
    case 'get_my_orders':
      return getMyOrders(userId, supabase, args.limit)
    case 'search_public_posts':
      return searchPublicPosts(args.query || '', supabase, args.limit)
    case 'search_public_services':
      return searchPublicServices(args.query || '', supabase, args.limit)
    case 'get_public_profile':
      return getPublicProfile(args.identifier || '', supabase)
    default:
      return { error: `Nežinomas įrankis: ${toolName}` }
  }
}
