/// <reference types="node" />
import { existsSync, readFileSync, statSync } from 'fs'
import { createServer } from 'http'
import type { AddressInfo } from 'net'
import { extname, join, normalize, resolve } from 'path'

type RouteType = {
    status?: number
    location?: string
    file?: string
    delay?: number
}

const CONTENT_TYPES: Record<string, string> = {
    '.css': 'text/css',
    '.htm': 'text/html',
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.php': 'text/html',
    '.png': 'image/png',
    '.xhtml': 'application/xhtml+xml',
    '.xml': 'application/xml',
}

const findRoute = (routes: Record<string, RouteType>, pathname: string) => {
    return Object.entries(routes).find(([pattern]) => {
        if (pattern.endsWith('*')) {
            return pathname.startsWith(pattern.slice(0, -1))
        }
        return pathname === pattern
    })?.[1]
}

// resolves pretty urls like real web servers do: /about -> about.html, /docs/ -> docs/index.html
const findFile = (root: string, pathname: string) => {
    const candidates = [
        pathname,
        join(pathname, 'index.html'),
        join(pathname, 'index.php'),
        `${pathname.replace(/\/$/, '')}.html`,
    ]

    for (const candidate of candidates) {
        const filePath = normalize(join(root, candidate))
        if (
            filePath.startsWith(root) &&
            existsSync(filePath) &&
            statSync(filePath).isFile()
        ) {
            return filePath
        }
    }
    return null
}

export const startTestSite = (rootPath: string): Promise<string> => {
    const root = resolve(rootPath)
    const routesPath = join(root, 'routes.json')
    const routes: Record<string, RouteType> = existsSync(routesPath)
        ? JSON.parse(readFileSync(routesPath, 'utf8'))
        : {}

    const server = createServer((request, response) => {
        const pathname = decodeURIComponent(
            new URL(request.url || '/', 'http://localhost').pathname
        )
        const route = findRoute(routes, pathname)

        if (route?.location) {
            response.writeHead(route.status || 302, {
                Location: route.location,
            })
            response.end()
            return
        }
        if (route?.status) {
            response.writeHead(route.status, { 'Content-Type': 'text/html' })
            response.end(`<!DOCTYPE html><title>${route.status}</title>`)
            return
        }

        const filePath = route?.file
            ? normalize(join(root, route.file))
            : findFile(root, pathname)

        if (!filePath || !existsSync(filePath)) {
            response.writeHead(404, { 'Content-Type': 'text/html' })
            response.end('<!DOCTYPE html><title>404</title>')
            return
        }

        setTimeout(() => {
            response.writeHead(200, {
                'Content-Type':
                    CONTENT_TYPES[extname(filePath).toLowerCase()] ||
                    'text/html',
            })
            response.end(readFileSync(filePath))
        }, route?.delay || 0)
    })

    return new Promise((resolveOrigin, reject) => {
        server.once('error', reject)
        server.listen(0, 'localhost', () => {
            const { port } = server.address() as AddressInfo
            resolveOrigin(`http://localhost:${port}`)
        })
    })
}
