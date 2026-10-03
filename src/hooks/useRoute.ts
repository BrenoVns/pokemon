import { useEffect, useState } from 'react'

// Roteamento por hash (#/sets, #/card/<id>…): funciona no GitHub Pages sem 404.html.
export type Route =
  | { name: 'collection' }
  | { name: 'sets' }
  | { name: 'set'; key: string }
  | { name: 'card'; id: string }
  | { name: 'settings' }

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  switch (parts[0]) {
    case 'sets':
      return parts[1] ? { name: 'set', key: decodeURIComponent(parts.slice(1).join('/')) } : { name: 'sets' }
    case 'card':
      return parts[1] ? { name: 'card', id: parts[1] } : { name: 'collection' }
    case 'settings':
      return { name: 'settings' }
    default:
      return { name: 'collection' }
  }
}

export function routeHref(route: Route): string {
  switch (route.name) {
    case 'collection':
      return '#/'
    case 'sets':
      return '#/sets'
    case 'set':
      return `#/sets/${encodeURIComponent(route.key)}`
    case 'card':
      return `#/card/${route.id}`
    case 'settings':
      return '#/settings'
  }
}

let depth = 0

export function navigate(route: Route, replace = false) {
  const href = routeHref(route)
  if (!replace) depth++
  if (replace) {
    history.replaceState(null, '', href)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  } else {
    window.location.hash = href
  }
}

/** Volta para a tela anterior do app, ou para um destino padrão se abriu direto no link. */
export function goBack(fallback: Route) {
  if (depth > 0) {
    depth--
    history.back()
  } else navigate(fallback, true)
}

// Guarda a rolagem de cada tela para restaurar ao voltar.
const scrollPositions = new Map<string, number>()

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash))
  useEffect(() => {
    let current = window.location.hash
    const onScroll = () => scrollPositions.set(current, window.scrollY)
    const onChange = () => {
      current = window.location.hash
      setRoute(parseRoute(current))
      const y = scrollPositions.get(current) ?? 0
      requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, y)))
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('hashchange', onChange)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('hashchange', onChange)
    }
  }, [])
  return route
}
