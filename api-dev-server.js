import express from 'express'
import { readdirSync } from 'fs'
import { pathToFileURL } from 'url'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config()

const app = express()
app.use(express.json({ limit: '10mb' }))

// Load all api/*.js files as routes
const apiDir = path.resolve('api')
for (const file of readdirSync(apiDir).filter(f => f.endsWith('.js'))) {
  const route = `/api/${file.replace('.js', '')}`
  const mod = await import(pathToFileURL(path.join(apiDir, file)).href)
  app.all(route, (req, res) => mod.default(req, res))
}

app.listen(3001, () => console.log('API dev server running on http://localhost:3001'))
