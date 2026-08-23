import { AiPermissionScope, validateToolPermission } from '../permissions'
import { OpenAiToolDefinition } from '../omnirouter'
import { getMyProfile } from './profile'
import { getMyPosts, getMyBookmarks, getMyNotifications, prepareCreatePost, createPost, getPublicFeed } from './social'
import { getMyBusinessStats, getMyServices, getMyOrders, prepareCreateService } from './business'
import { searchPublicPosts, searchPublicServices } from './search'
import { getPublicProfile } from './public'

export interface ToolExecutionContext {
  userId: string
  supabase: any
  scopes?: Set<AiPermissionScope>
}

export interface ToolParameterSpec {
  type: string
  description: string
  required?: boolean
  enum?: string[]
}

export interface ToolDefinitionSpec {
  name: string
  description: string
  parameters: Record<string, ToolParameterSpec>
}

export const ALLOWED_TOOLS_DEFINITIONS: ToolDefinitionSpec[] = [
  {
    name: 'prepare_create_post',
    description: 'Paruošia naujo įrašo juodraštį vartotojo patvirtinimui prieš paskelbiant į MiniSocial',
    parameters: {
      content: { type: 'string', description: 'Įrašo tekstas', required: true },
    },
  },
  {
    name: 'create_post',
    description: 'Paskelbia naują įrašą dabartinio prisijungusio vartotojo vardu į MiniSocial',
    parameters: {
      content: { type: 'string', description: 'Įrašo tekstas', required: true },
    },
  },
  {
    name: 'get_public_feed',
    description: 'Gauna naujausius viešus socialinio tinklo įrašus (feed)',
    parameters: {
      limit: { type: 'number', description: 'Kiek įrašų grąžinti (1-20, pagal nutylėjimą 10)' },
    },
  },
  {
    name: 'prepare_create_service',
    description: 'Paruošia naujos meistro paslaugos juodraštį vartotojo patvirtinimui',
    parameters: {
      name: { type: 'string', description: 'Paslaugos pavadinimas', required: true },
      price: { type: 'number', description: 'Kaina eurais', required: true },
      priceType: { type: 'string', description: 'Kainos tipas: "fixed" | "hourly" | "from"' },
      description: { type: 'string', description: 'Paslaugos aprašymas' },
    },
  },
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

/**
 * Builds OpenAI-compatible Tool Definitions from ALLOWED_TOOLS_DEFINITIONS
 */
export function buildToolSchemas(): OpenAiToolDefinition[] {
  return ALLOWED_TOOLS_DEFINITIONS.map((tool) => {
    const properties: Record<string, any> = {}
    const required: string[] = []

    for (const [key, param] of Object.entries(tool.parameters)) {
      properties[key] = {
        type: param.type,
        description: param.description,
        ...(param.enum ? { enum: param.enum } : {}),
      }
      if (param.required) {
        required.push(key)
      }
    }

    return {
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties,
          ...(required.length > 0 ? { required } : {}),
          additionalProperties: false,
        },
      },
    }
  })
}

export async function executeTool(
  toolName: string,
  args: Record<string, any> = {},
  context: ToolExecutionContext,
): Promise<any> {
  const { userId, supabase, scopes } = context

  const activeScopes =
    scopes ||
    new Set<AiPermissionScope>([
      'profile:read_self',
      'social:read_self',
      'social:create_post',
      'social:read_feed',
      'business:read_self',
      'business:create_service',
      'public:read',
    ])

  // Validate that the tool is authorized under the active scopes
  validateToolPermission(toolName, activeScopes)

  // Explicitly disallow passing arbitrary userId for user-specific tools:
  // we always pass the server-authenticated context.userId
  switch (toolName) {
    case 'prepare_create_post':
      return prepareCreatePost(userId, args.content || '')
    case 'create_post':
      return createPost(userId, supabase, args.content || '')
    case 'prepare_create_service':
      return prepareCreateService(userId, args)
    case 'get_public_feed':
      return getPublicFeed(supabase, args.limit)
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
