import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'

export default defineConfig([
  ...nextVitals,
  globalIgnores(['.next/**', 'node_modules/**', '.pnpm-store/**', 'next-env.d.ts', 'Get-Content proxy.ts']),
])
