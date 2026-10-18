import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isBuiltin } from 'node:module'
import ts from 'typescript'

// Allowed internal dependencies are intentionally directional. Apps compose
// these layers; lower layers must never import their consumers.
const layers = {
  'b2b-contracts': [],
  'b2b-domain': ['b2b-contracts'],
  'b2b-client': ['b2b-contracts'],
  'b2b-react': ['b2b-contracts', 'b2b-client'],
  'b2b-ui': ['b2b-contracts', 'anatomy-viewer', 'model-assets'],
  'b2b-api': ['b2b-contracts', 'b2b-domain', 'catalog-base', 'scene-schema'],
  'b2b-web': [
    'b2b-contracts',
    'b2b-domain',
    'b2b-client',
    'b2b-react',
    'b2b-ui',
    'anatomy-viewer',
    'model-assets',
  ],
}
const prefix = '@klisteniapp/'
const externalLayers = {
  'b2b-contracts': ['zod'],
  'b2b-domain': [],
  'b2b-client': [],
  'b2b-react': ['react'],
  'b2b-ui': ['react'],
}
const inside = (path, directory) => path === directory || path.startsWith(`${directory}${sep}`)
const json = (path) => JSON.parse(readFileSync(path, 'utf8'))

function sourceFiles(directory) {
  if (!existsSync(directory)) return []
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? sourceFiles(path) : /\.[cm]?[jt]sx?$/.test(path) ? [path] : []
  })
}

function importsOf(source) {
  const imports = []
  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const clause = ts.isImportDeclaration(node) ? node.importClause : node
      const bindings = ts.isImportDeclaration(node) ? clause?.namedBindings : node.exportClause
      const typeOnly = Boolean(
        clause?.isTypeOnly ||
          (!clause?.name &&
            bindings &&
            (ts.isNamedImports(bindings) || ts.isNamedExports(bindings)) &&
            bindings.elements.length &&
            bindings.elements.every((item) => item.isTypeOnly)),
      )
      imports.push({ specifier: node.moduleSpecifier.text, typeOnly })
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal)
    ) {
      imports.push({ specifier: node.argument.literal.text, typeOnly: true })
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
    ) {
      const argument = node.arguments[0]
      if (
        argument &&
        (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument))
      ) {
        imports.push({ specifier: argument.text, typeOnly: false })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return imports
}

function resolveSource(path) {
  return [
    path,
    `${path}.ts`,
    `${path}.tsx`,
    `${path}.js`,
    join(path, 'index.ts'),
    join(path, 'index.tsx'),
  ].find((candidate) => existsSync(candidate) && /\.[cm]?[jt]sx?$/.test(candidate))
}

function exportedTarget(exports, subpath) {
  if (typeof exports?.[subpath] === 'string') return exports[subpath]
  for (const [key, value] of Object.entries(exports ?? {})) {
    if (!key.includes('*') || typeof value !== 'string') continue
    const [start, end] = key.split('*')
    if (subpath.startsWith(start) && subpath.endsWith(end)) {
      return value.replace('*', subpath.slice(start.length, end ? -end.length : undefined))
    }
  }
  return null
}

function cycleErrors(graph, label) {
  const active = new Set(),
    complete = new Set(),
    errors = []
  function visit(node, path) {
    if (active.has(node)) {
      errors.push(`${label}: ${[...path.slice(path.indexOf(node)), node].join(' -> ')}`)
      return
    }
    if (complete.has(node)) return
    active.add(node)
    for (const next of graph.get(node) ?? []) if (graph.has(next)) visit(next, [...path, node])
    active.delete(node)
    complete.add(node)
  }
  for (const node of graph.keys()) visit(node, [])
  return errors
}

export function checkB2BBoundaries(root) {
  root = resolve(root)
  const errors = [],
    workspaces = []
  for (const group of ['apps', 'packages']) {
    if (!existsSync(join(root, group))) continue
    for (const entry of readdirSync(join(root, group), { withFileTypes: true })) {
      const directory = join(root, group, entry.name),
        manifest = join(directory, 'package.json')
      if (entry.isDirectory() && existsSync(manifest))
        workspaces.push({ directory, ...json(manifest) })
    }
  }
  const byName = new Map(workspaces.map((pkg) => [pkg.name, pkg]))
  const selected = workspaces.filter((pkg) => Object.hasOwn(layers, pkg.name?.slice(prefix.length)))
  const packageGraph = new Map(),
    fileGraph = new Map()
  for (const pkg of selected) {
    const name = pkg.name.slice(prefix.length)
    const allowed = new Set(layers[name].map((dependency) => `${prefix}${dependency}`))
    const runtime = { ...pkg.dependencies, ...pkg.peerDependencies }
    const declared = { ...runtime, ...pkg.devDependencies }
    const dependencies = Object.keys(declared).filter((dependency) => dependency.startsWith(prefix))
    packageGraph.set(pkg.name, dependencies)
    for (const dependency of dependencies) {
      if (!allowed.has(dependency))
        errors.push(`${pkg.name}: forbidden layer dependency ${dependency}`)
      if (!byName.has(dependency)) errors.push(`${pkg.name}: missing workspace ${dependency}`)
    }
    if (inside(pkg.directory, join(root, 'packages'))) {
      if (pkg.private !== true) errors.push(`${pkg.name}: internal packages must be private`)
      for (const [entry, target] of Object.entries(pkg.exports ?? {})) {
        if (
          entry.includes('*') ||
          typeof target !== 'string' ||
          !target.startsWith('./') ||
          !inside(resolve(pkg.directory, target), pkg.directory)
        ) {
          errors.push(`${pkg.name}: exports must name explicit local entrypoints (${entry})`)
        } else if (!existsSync(resolve(pkg.directory, target)))
          errors.push(`${pkg.name}: missing export ${entry}`)
      }
      if (!pkg.exports?.['.']) errors.push(`${pkg.name}: missing public root export`)
    }
    for (const file of [
      ...sourceFiles(join(pkg.directory, 'src')),
      ...sourceFiles(join(pkg.directory, 'tests')),
    ]) {
      const source = ts.createSourceFile(
        file,
        readFileSync(file, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
      )
      const isSource = inside(file, join(pkg.directory, 'src'))
      const fileName = relative(root, file)
      fileGraph.set(fileName, [])
      for (const { specifier, typeOnly } of importsOf(source)) {
        let target
        if (specifier.startsWith('.')) {
          const absolute = resolve(dirname(file), specifier)
          if (!inside(absolute, pkg.directory))
            errors.push(`${fileName}: relative import crosses workspace boundary (${specifier})`)
          target = resolveSource(absolute)
        } else if (specifier.startsWith(prefix)) {
          const parts = specifier.split('/'),
            dependency = parts.slice(0, 2).join('/'),
            subpath = parts.length > 2 ? `./${parts.slice(2).join('/')}` : '.'
          if (
            dependency !== pkg.name &&
            !Object.hasOwn(isSource && !typeOnly ? runtime : declared, dependency)
          ) {
            errors.push(
              `${fileName}: undeclared ${isSource && !typeOnly ? 'runtime ' : ''}dependency ${dependency}`,
            )
          }
          if (dependency !== pkg.name && !allowed.has(dependency))
            errors.push(`${fileName}: forbidden layer import ${dependency}`)
          const owner = byName.get(dependency),
            exported = exportedTarget(owner?.exports, subpath)
          if (!exported) errors.push(`${fileName}: package path is not exported (${specifier})`)
          else target = resolveSource(resolve(owner.directory, exported))
        } else if (isBuiltin(specifier)) {
          if (isSource && Object.hasOwn(externalLayers, name))
            errors.push(`${fileName}: shared package cannot import Node runtime (${specifier})`)
        } else {
          const dependency = specifier
            .split('/')
            .slice(0, specifier.startsWith('@') ? 2 : 1)
            .join('/')
          if (!Object.hasOwn(isSource && !typeOnly ? runtime : declared, dependency))
            errors.push(`${fileName}: undeclared external dependency ${dependency}`)
          if (isSource && externalLayers[name] && !externalLayers[name].includes(dependency))
            errors.push(`${fileName}: forbidden external layer dependency ${dependency}`)
        }
        if (target && !typeOnly) fileGraph.get(fileName).push(relative(root, target))
      }
      if (isSource && ['b2b-contracts', 'b2b-domain'].includes(name)) {
        const forbidden = new Set([
          'window',
          'document',
          'localStorage',
          'sessionStorage',
          'navigator',
          'fetch',
        ])
        function inspect(node) {
          const parent = node.parent
          const propertyName =
            parent &&
            parent.name === node &&
            (ts.isPropertyAccessExpression(parent) ||
              ts.isPropertySignature(parent) ||
              ts.isPropertyAssignment(parent) ||
              ts.isMethodSignature(parent))
          if (ts.isIdentifier(node) && forbidden.has(node.text) && !propertyName)
            errors.push(`${fileName}: pure layer cannot access ${node.text}`)
          ts.forEachChild(node, inspect)
        }
        inspect(source)
      }
    }
  }
  return [
    ...errors,
    ...cycleErrors(packageGraph, 'Workspace dependency cycle'),
    ...cycleErrors(fileGraph, 'Module import cycle'),
  ]
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = checkB2BBoundaries(fileURLToPath(new URL('..', import.meta.url)))
  if (errors.length) {
    console.error(errors.join('\n'))
    process.exitCode = 1
  } else console.log('B2B package boundaries, public exports and dependency graphs are valid.')
}
