import ts from 'typescript';

/**
 * The core's promise (CLAUDE.md), read from its sources with TypeScript's parser: no `Date`, no Temporal, no clock,
 * no randomness, no host global, no package, no dynamic import. `Intl` is allowed. The syntax tree, not the raw
 * scanner: a raw scan cannot tell where a template literal type (`series-${number}`) ends and then reads the next
 * comment as code (found 2026-11-21). Comments and strings may say anything; `globalThis.Date` or `const D = Date`
 * cannot hide. Rules taken from DzGrid's purity test (our own code).
 */
const FORBIDDEN_NAMES = new Set([
  'Date', 'Temporal', 'performance', 'globalThis', 'self', 'window', 'document', 'navigator', 'location',
  'localStorage', 'sessionStorage', 'fetch', 'setTimeout', 'setInterval', 'requestAnimationFrame',
  'cancelAnimationFrame', 'queueMicrotask', 'process', 'require', 'crypto', 'Worker', 'eval',
  'AbortController', 'AbortSignal', 'OffscreenCanvas', 'Path2D', 'DOMParser',
]);

/** Whether an identifier is a name being declared or a member's name, not a reference to a global. */
function isNameNotReference(id: ts.Identifier): boolean {
  const p = id.parent;
  if (ts.isPropertyAccessExpression(p) && p.name === id) return true;
  if (ts.isQualifiedName(p) && p.right === id) return true;
  if ((ts.isPropertySignature(p) || ts.isPropertyDeclaration(p) || ts.isMethodSignature(p) || ts.isMethodDeclaration(p) || ts.isPropertyAssignment(p) || ts.isGetAccessor(p) || ts.isSetAccessor(p) || ts.isEnumMember(p)) && p.name === id) return true;
  if (ts.isBindingElement(p) && p.propertyName === id) return true;
  if ((ts.isImportSpecifier(p) || ts.isExportSpecifier(p)) && p.propertyName === id) return true;
  if (ts.isLabeledStatement(p) || ts.isBreakOrContinueStatement(p)) return true;
  return false;
}

/** Every reason a source breaks purity, as short labels. */
export function purityViolations(source: string): string[] {
  const sf = ts.createSourceFile('x.ts', source, ts.ScriptTarget.Latest, true);
  const found: string[] = [];
  const visit = (n: ts.Node): void => {
    if (ts.isIdentifier(n) && FORBIDDEN_NAMES.has(n.text) && !isNameNotReference(n)) found.push(n.text);
    if (ts.isPropertyAccessExpression(n) && n.name.text === 'random' && ts.isIdentifier(n.expression) && n.expression.text === 'Math') found.push('Math.random');
    if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword) found.push('import()');
    if ((ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier) && !n.moduleSpecifier.text.startsWith('.')) found.push(`package ${n.moduleSpecifier.text}`);
    if (ts.isImportEqualsDeclaration(n)) found.push('import =');
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return found;
}
