/** Bounded syntax inspection; never imports, evaluates, or executes inspected code.
 * Supports JS/TS/JSX/TSX/JSON string literals (including decoded escapes),
 * no-substitution templates, string + string, parentheses/type wrappers, and
 * literal string arrays with .join(a literal string separator).
 * Deliberately does not resolve identifiers, template substitutions, arbitrary
 * calls, getters, imports, spread elements, encoded payloads, or control flow.
 * Resource/parser failures are returned without source text or parser messages.
 */
import { extname } from 'node:path'
import ts from 'typescript'

export const staticStringLimits = Object.freeze({
  sourceBytes: 8 * 1024 * 1024,
  nodes: 500_000,
  depth: 64,
  arrayElements: 1024,
  valueChars: 128 * 1024,
  totalChars: 16 * 1024 * 1024,
})

const syntaxKinds = new Map([
  ['.js', ts.ScriptKind.JS], ['.mjs', ts.ScriptKind.JS], ['.cjs', ts.ScriptKind.JS],
  ['.jsx', ts.ScriptKind.JSX], ['.ts', ts.ScriptKind.TS], ['.mts', ts.ScriptKind.TS],
  ['.cts', ts.ScriptKind.TS], ['.tsx', ts.ScriptKind.TSX], ['.json', ts.ScriptKind.JSON],
])

export function staticStringsIn(text, path, limits = staticStringLimits) {
  const kind = syntaxKinds.get(extname(path).toLowerCase())
  const result = { supported: kind !== undefined, units: [], issues: [] }
  if (!result.supported) return result
  const issue = (category, location = 'file') => {
    if (!result.issues.some(item => item.category === category && item.location === location)) result.issues.push({ category, location })
  }
  if (Buffer.byteLength(text, 'utf8') > limits.sourceBytes) {
    issue('static-analysis-size-limit')
    return result
  }
  let source
  try { source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, false, kind) }
  catch { issue('static-analysis-parse-error'); return result }
  const position = (start, end) => {
    const { line, character } = source.getLineAndCharacterOfPosition(start)
    return `line:${line + 1}:column:${character + 1}:source:${start}-${end}`
  }
  // TypeScript may recover a useful AST. Still fail the audit for malformed
  // input so partial parsing cannot be mistaken for complete coverage.
  for (const diagnostic of source.parseDiagnostics.slice(0, 10)) {
    issue('static-analysis-parse-error', position(diagnostic.start || 0, (diagnostic.start || 0) + (diagnostic.length || 0)))
  }
  const nodes = [], stack = [source]
  while (stack.length) {
    if (nodes.length >= limits.nodes) { issue('static-analysis-node-limit'); return result }
    const node = stack.pop()
    nodes.push(node)
    ts.forEachChild(node, child => { stack.push(child) })
  }
  const values = new WeakMap()
  let totalChars = 0
  const wrapper = node => ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isTypeAssertionExpression(node) || ts.isNonNullExpression(node) || ts.isSatisfiesExpression(node)
  const unwrap = node => {
    const origin = node
    for (let depth = 0; depth <= limits.depth; depth++) {
      if (!wrapper(node)) return node
      node = node.expression
    }
    issue('static-analysis-depth-limit', position(origin.getStart(source), origin.end))
    return undefined
  }
  const literal = node => node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
  // Reverse preorder visits children first, without recursive interpretation.
  for (let index = nodes.length - 1; index >= 0; index--) {
    const node = nodes[index]
    let value, depth = 1, form
    if (literal(node)) { value = node.text; form = 'literal' }
    else if (wrapper(node)) {
      const child = values.get(node.expression)
      if (child) { value = child.value; depth = child.depth + 1 }
    } else if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const left = values.get(node.left), right = values.get(node.right)
      if (left && right) {
        depth = Math.max(left.depth, right.depth) + 1
        if (left.value.length + right.value.length > limits.valueChars) {
          issue('static-analysis-value-limit', position(node.getStart(source), node.end)); continue
        }
        value = left.value + right.value
        form = 'concat'
      }
    } else if (ts.isCallExpression(node) && !node.questionDotToken && ts.isPropertyAccessExpression(node.expression) && !node.expression.questionDotToken && node.expression.name.text === 'join' && node.arguments.length === 1) {
      const array = unwrap(node.expression.expression), separator = unwrap(node.arguments[0])
      if (array && ts.isArrayLiteralExpression(array) && literal(separator)) {
        if (array.elements.length > limits.arrayElements) {
          issue('static-analysis-array-limit', position(node.getStart(source), node.end)); continue
        }
        // No property lookups or custom join implementation are invoked.
        const elements = array.elements.map(element => values.get(element))
        if (elements.every(Boolean)) {
          const size = elements.reduce((sum, element) => sum + element.value.length, 0) + Math.max(0, elements.length - 1) * separator.text.length
          if (size > limits.valueChars) {
            issue('static-analysis-value-limit', position(node.getStart(source), node.end)); continue
          }
          value = elements.map(element => element.value).join(separator.text)
          depth = Math.max(0, ...elements.map(element => element.depth)) + 1
          form = 'join'
        }
      }
    }
    if (value === undefined) continue
    const start = node.getStart(source), location = position(start, node.end)
    if (depth > limits.depth) { issue('static-analysis-depth-limit', location); continue }
    if (value.length > limits.valueChars) { issue('static-analysis-value-limit', location); continue }
    totalChars += value.length
    if (totalChars > limits.totalChars) { issue('static-analysis-output-limit', location); break }
    values.set(node, { value, depth })
    // Wrappers share the child's characters and origin; do not emit duplicates.
    if (form) result.units.push({ value, location: `${location}:static-${form}` })
  }
  return result
}
