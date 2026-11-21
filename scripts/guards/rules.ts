import ts from 'typescript';

/**
 * DzGraph's source rules (CLAUDE.md), read with TypeScript's parser (a comment may say anything). Taken from
 * DzTooltip's guards (our own code), adapted to charts:
 *
 * - `colour`: no colour literal, no colour written through `style`: colours are the theme's (`--tz-*`, `--dzgraph-*`).
 * - `literal-text`: no string literal with letters reaching visible text (`textContent`, `aria-label`…): text comes
 *   from the translated messages. Checked in the DOM layer only (the core writes no text).
 * - `physical`: no `left` / `right` outside `dir.ts`. Unlike DzTooltip, `x` and `clientX` are allowed: in a chart `x`
 *   is the horizontal coordinate of the plot, which `dir.ts` maps; it is not a side.
 * - `html`: no `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`: a chart may show an app's data.
 * - `invisible`: no raw invisible or bidi-control character, no raw combining mark outside comments.
 */
export type Rule = 'colour' | 'literal-text' | 'physical' | 'html' | 'invisible';

const COLOUR = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix|light-dark|color)\(/i;
const COLOUR_PROPS = /^(color|background|backgroundColor|border(?:Block|Inline)?(?:Start|End)?(?:Color)?|outline(?:Color)?|fill|stroke|caretColor|accentColor|boxShadow|textShadow)$/;
const COLOUR_CSS = /^(color|background(-color)?|border(-[a-z]+)*(-color)?|outline(-color)?|fill|stroke|caret-color|accent-color|box-shadow|text-shadow)$/;
const COLOUR_DECL = /(^|[;{\s])(color|background(-color)?|border(-[a-z]+)*(-color)?|outline(-color)?|fill|stroke)\s*:/i;
/** Canvas and SVG attributes that take a colour: their value must come from a resolved token, never a literal. */
const COLOUR_ATTRS = new Set(['fill', 'stroke', 'stop-color', 'flood-color', 'lighting-color', 'color']);
const TEXT_PROPS = new Set(['textContent', 'innerText', 'title', 'ariaLabel', 'placeholder', 'ariaRoleDescription', 'ariaValueText', 'ariaDescription', 'alt', 'nodeValue', 'data', 'aria-label', 'aria-roledescription', 'aria-valuetext', 'aria-description']);
const TEXT_ATTRS = new Set(['aria-label', 'title', 'placeholder', 'aria-roledescription', 'aria-valuetext', 'aria-description', 'alt']);
const TEXT_CALLS = new Set(['createTextNode', 'append', 'prepend', 'replaceChildren', 'before', 'after', 'replaceWith', 'insertAdjacentText']);
/** Physical names, as properties: `.left`, `.right`, `.marginLeft`, `.scrollLeft`, `.cssFloat`. */
const PHYSICAL_PROP = /^(left|right)$|[a-z](Left|Right)$|^cssFloat$/;
/** Physical CSS in strings: the words. */
const PHYSICAL_TEXT = /\b(left|right)\b/i;
const SCSS_COLOUR = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/i;
const SHORTHAND_PROPS = new Set(['margin', 'padding', 'inset', 'borderWidth', 'borderRadius', 'borderStyle', 'borderColor']);
const ARROWS = /^Arrow(Left|Right)$/;
const HTML = new Set(['innerHTML', 'outerHTML', 'insertAdjacentHTML', 'setHTMLUnsafe', 'createContextualFragment', 'parseFromString', 'srcdoc']);
const INVISIBLE = /[ ­؜​-‏‪- ⁠-⁩  ﻿]/;
const MARK = /\p{M}/u;

const hasLetters = (s: string): boolean => /\p{L}/u.test(s);
const COMPARE = new Set([ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.LessThanToken, ts.SyntaxKind.GreaterThanToken, ts.SyntaxKind.LessThanEqualsToken, ts.SyntaxKind.GreaterThanEqualsToken, ts.SyntaxKind.InKeyword, ts.SyntaxKind.InstanceOfKeyword]);

/** Literal text an expression can evaluate to: not a call's arguments (`msg('axis.title')` passes a key), not a test. */
function literalTexts(node: ts.Node): string[] {
  const out: string[] = [];
  const visit = (n: ts.Node): void => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return void out.push(n.text);
    if (ts.isTemplateExpression(n)) {
      out.push(n.head.text, ...n.templateSpans.map((s) => s.literal.text));
      return n.templateSpans.forEach((s) => visit(s.expression));
    }
    if (ts.isCallExpression(n) || ts.isTypeOfExpression(n)) return;
    if (ts.isElementAccessExpression(n)) return visit(n.expression);
    if (ts.isConditionalExpression(n)) return void (visit(n.whenTrue), visit(n.whenFalse));
    if (ts.isBinaryExpression(n) && COMPARE.has(n.operatorToken.kind)) return;
    ts.forEachChild(n, visit);
  };
  visit(node);
  return out;
}

const propName = (n: ts.Node): string | null =>
  ts.isPropertyAccessExpression(n) ? n.name.text
    : ts.isElementAccessExpression(n) && ts.isStringLiteralLike(n.argumentExpression) ? n.argumentExpression.text
      : null;
const camel = (s: string): string => s.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
const isStyle = (n: ts.Expression): boolean => propName(n) === 'style' || (ts.isIdentifier(n) && n.text === 'style');

export interface Finding { readonly rule: Rule; readonly line: number; readonly why: string }

export interface SourceOptions {
  /** Check that no literal text reaches the screen (the DOM layer). */
  readonly text?: boolean;
}

export function checkSource(source: string, file: string, opts: SourceOptions = {}): Finding[] {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const out: Finding[] = [];
  const at = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const add = (rule: Rule, n: ts.Node, why: string) => out.push({ rule, line: at(n), why });
  const isDir = /(^|\/)dir\.ts$/.test(file);
  // paint.ts writes the CSS of a colour: `var(--dzgraph-…)` and `color-mix()` of variables, never a literal colour.
  const isPaint = /(^|\/)paint\.ts$/.test(file);
  const isKeys = /(^|\/)keys\.ts$/.test(file);
  const isLocale = /(^|\/)locales\//.test(file);
  const text = opts.text === true;

  const physicalName = (n: ts.Node, name: string) => {
    if (!isDir && PHYSICAL_PROP.test(name)) add('physical', n, name);
  };

  const visit = (n: ts.Node): void => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) {
      const s = n.text;
      if (COLOUR.test(s) && !(isPaint && !COLOUR.test(s.replace(/color-mix\(/gi, '')))) add('colour', n, `colour literal "${s}"`);
      if (HTML.has(s) && ts.isElementAccessExpression(n.parent)) add('html', n, s);
      if (!isDir && !isLocale) {
        if (ARROWS.test(s)) { if (!isKeys) add('physical', n, `"${s}" outside keys.ts`); }
        else if (PHYSICAL_TEXT.test(s)) add('physical', n, `"${s}"`);
      }
    }
    if (ts.isPropertyAccessExpression(n)) {
      physicalName(n.name, n.name.text);
      if (HTML.has(n.name.text)) add('html', n.name, n.name.text);
      if ((n.name.text === 'write' || n.name.text === 'writeln') && /^(document|doc|ownerDocument)$/.test(propName(n.expression) ?? (ts.isIdentifier(n.expression) ? n.expression.text : ''))) add('html', n.name, 'document.write');
    }
    if (ts.isBindingElement(n) && ts.isObjectBindingPattern(n.parent)) {
      const name = n.propertyName ?? n.name;
      if (ts.isIdentifier(name)) physicalName(name, name.text);
    }
    if (ts.isPropertyAssignment(n) || ts.isShorthandPropertyAssignment(n)) {
      const name = ts.isIdentifier(n.name) || ts.isStringLiteral(n.name) ? n.name.text : null;
      if (text && name && TEXT_PROPS.has(name) && ts.isPropertyAssignment(n) && literalTexts(n.initializer).some(hasLetters)) add('literal-text', n, `{ ${name}: literal text }`);
    }
    if (ts.isBinaryExpression(n) && (n.operatorToken.kind === ts.SyntaxKind.EqualsToken || n.operatorToken.kind === ts.SyntaxKind.PlusEqualsToken)) {
      const name = propName(n.left);
      if (text && name && TEXT_PROPS.has(name) && literalTexts(n.right).some(hasLetters)) add('literal-text', n, `${name} = literal text`);
      if (name && (ts.isPropertyAccessExpression(n.left) || ts.isElementAccessExpression(n.left))) {
        const target = n.left.expression;
        if (isStyle(target)) {
          if (COLOUR_PROPS.test(camel(name))) add('colour', n, `style.${name}`);
          if (name === 'cssText' && literalTexts(n.right).some((t) => COLOUR_DECL.test(t))) add('colour', n, 'style.cssText with a colour');
          if (SHORTHAND_PROPS.has(camel(name)) && literalTexts(n.right).some((t) => t.trim().split(/\s+/).length >= 2)) add('physical', n, `style.${name} shorthand`);
          if (camel(name) === 'textAlign' || camel(name) === 'float') physicalName(n.left, 'cssFloat');
        }
        // A Canvas colour: `ctx.fillStyle = …` must take a resolved token, never a literal (caught by COLOUR above).
      }
    }
    if (ts.isCallExpression(n)) {
      const callee = propName(n.expression) ?? (ts.isIdentifier(n.expression) ? n.expression.text : null);
      const [a0, a1] = n.arguments;
      if (callee === 'setAttribute' && a0 && ts.isStringLiteral(a0) && a1) {
        if (text && TEXT_ATTRS.has(a0.text) && literalTexts(a1).some(hasLetters)) add('literal-text', n, `setAttribute('${a0.text}', literal text)`);
        if (a0.text === 'style' && literalTexts(a1).some((t) => COLOUR_DECL.test(t))) add('colour', n, "setAttribute('style') with a colour");
        if (COLOUR_ATTRS.has(a0.text) && literalTexts(a1).some((t) => t.trim() !== '' && t.trim() !== 'none' && !t.startsWith('var(--'))) add('colour', n, `setAttribute('${a0.text}', literal)`);
      }
      if (callee === 'setProperty' && a0 && ts.isStringLiteral(a0) && COLOUR_CSS.test(a0.text)) add('colour', n, `style.setProperty('${a0.text}')`);
      if (callee === 'setProperty' && a0 && ts.isStringLiteral(a0) && /^(text-align|float)$/.test(a0.text) && a1 && literalTexts(a1).some((t) => /^(left|right)$/.test(t.trim()))) add('physical', n, `style.setProperty('${a0.text}', physical)`);
      if (text && callee && TEXT_CALLS.has(callee)) {
        const args = callee === 'insertAdjacentText' ? n.arguments.slice(1) : n.arguments;
        if (args.some((a) => literalTexts(a).some(hasLetters))) add('literal-text', n, `${callee}(literal text)`);
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);

  const code = stripComments(source);
  const raw = source.split('\n');
  code.split('\n').forEach((line, i) => {
    if (INVISIBLE.test(raw[i] ?? '')) out.push({ rule: 'invisible', line: i + 1, why: 'raw invisible or bidi-control character' });
    else if (!isLocale && MARK.test(line)) out.push({ rule: 'invisible', line: i + 1, why: 'raw combining mark outside a comment' });
  });
  return out;
}

/**
 * The source with every comment blanked, lines kept. Comment ranges come from the syntax tree (around every node), not
 * from a raw scan, which loses its place after a template literal type (see purity.ts).
 */
function stripComments(source: string): string {
  const sf = ts.createSourceFile('x.ts', source, ts.ScriptTarget.Latest, true);
  const ranges = new Map<number, number>();
  const take = (rs: readonly ts.CommentRange[] | undefined) => rs?.forEach((r) => ranges.set(r.pos, r.end));
  const visit = (n: ts.Node): void => {
    take(ts.getLeadingCommentRanges(source, n.getFullStart()));
    take(ts.getTrailingCommentRanges(source, n.getEnd()));
    ts.forEachChild(n, visit);
  };
  visit(sf);
  take(ts.getLeadingCommentRanges(source, sf.endOfFileToken.getFullStart()));
  // Positions are UTF-16 offsets: blank by code unit, keeping newlines.
  let out = source;
  for (const [pos, end] of ranges) out = out.slice(0, pos) + out.slice(pos, end).replace(/[^\n]/g, ' ') + out.slice(end);
  return out;
}

/** SCSS: colour literals only inside the `$tz-palette` map (the palette is the one place colours are written). */
export function checkScss(source: string): Finding[] {
  const out: Finding[] = [];
  const text = source.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
  let inPalette = false;
  let depth = 0;
  text.split('\n').forEach((raw, i) => {
    const line = raw.replace(/\/\/.*$/, '');
    if (/^\s*\$(tz|dzgraph)-palette\s*:/.test(line)) inPalette = true;
    if (inPalette) {
      depth += (line.match(/\(/g) ?? []).length - (line.match(/\)/g) ?? []).length;
      if (depth <= 0 && /;/.test(line)) inPalette = false;
    } else if (SCSS_COLOUR.test(line)) out.push({ rule: 'colour', line: i + 1, why: line.trim() });
    if (/(^|[^-\w])(left|right)\b|-(left|right)\b|\b(text-align|float|clear)\s*:\s*(left|right)/.test(line)) out.push({ rule: 'physical', line: i + 1, why: line.trim() });
  });
  return out;
}
