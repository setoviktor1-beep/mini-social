import Link from 'next/link'

export default function ParsedContent({ content }: { content: string }) {
  // Parses `#hashtag` and `@username` into links while keeping the rest of the text intact.
  // Note: `\w` includes letters, numbers and underscore.
  const re = /(@\w+|#\w+)/g

  const nodes: React.ReactNode[] = []
  let lastIndex = 0
  let m: RegExpExecArray | null

  while ((m = re.exec(content)) !== null) {
    const start = m.index
    const token = m[0]
    const end = start + token.length

    if (start > lastIndex) {
      nodes.push(content.slice(lastIndex, start))
    }

    if (token.startsWith('#')) {
      const tag = token.slice(1)
      nodes.push(
        <Link
          key={`tag-${start}-${tag}`}
          href={`/search?q=%23${encodeURIComponent(tag)}`}
          className="text-blue-600 dark:text-blue-400 hover:underline"
        >
          {token}
        </Link>
      )
    } else if (token.startsWith('@')) {
      const username = token.slice(1)
      nodes.push(
        <Link
          key={`user-${start}-${username}`}
          href={`/u/${username}`}
          className="text-blue-600 dark:text-blue-400 hover:underline"
        >
          {token}
        </Link>
      )
    } else {
      nodes.push(token)
    }

    lastIndex = end
  }

  if (lastIndex < content.length) {
    nodes.push(content.slice(lastIndex))
  }

  return <>{nodes}</>
}

