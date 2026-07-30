export type NotificationType =
  | 'like'
  | 'comment'
  | 'follow'
  | 'new_post'
  | 'mention'
  | 'share'
  | 'repost'

export type NotificationTargetType =
  | 'post'
  | 'comment'
  | 'user'
  | 'discussion'
  | null

export interface NotificationRow {
  id: string
  user_id: string
  type: NotificationType
  actor_id: string
  target_id: string | null
  target_type: NotificationTargetType
  is_read: boolean
  created_at: string
  actor?: {
    username: string
    display_name: string
    avatar_path: string | null
  } | null
}

export function formatNotificationText(notification: NotificationRow) {
  const name = notification.actor?.display_name || 'Kažkas'

  switch (notification.type) {
    case 'like':
      return `${name} pamėgo jūsų įrašą`
    case 'comment':
      return `${name} pakomentavo jūsų įrašą`
    case 'follow':
      return `${name} pradėjo jus sekti`
    case 'new_post':
      return `${name} paskelbė naują įrašą`
    case 'mention':
      return `${name} jus paminėjo`
    case 'share':
      return `${name} pasidalijo jūsų įrašu`
    case 'repost':
      return `${name} pakartotinai paskelbė jūsų įrašą`
    default:
      return `${name} atsiuntė pranešimą`
  }
}

export function getNotificationHref(notification: NotificationRow) {
  if (
    notification.target_type === 'discussion' &&
    notification.target_id
  ) {
    return `/discussions/${notification.target_id}`
  }
  if (notification.target_type === 'post' && notification.target_id) {
    return `/posts/${notification.target_id}`
  }
  if (notification.actor?.username) {
    return `/u/${notification.actor.username}`
  }
  return '/notifications'
}
