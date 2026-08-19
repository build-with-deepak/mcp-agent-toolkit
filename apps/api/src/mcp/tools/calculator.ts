/**
 * A recursive-descent arithmetic evaluator — deliberately NOT `eval` or
 * `new Function`. The expression comes from an LLM acting on visitor
 * input; handing that to a JavaScript evaluator, however "sandboxed",
 * turns a calculator into a code-execution tool. Sixty lines of parser is
 * the boring, correct alternative.
 *
 * Grammar:
 *   expr    := term (('+'|'-') term)*
 *   term    := factor (('*'|'/'|'%') factor)*
 *   factor  := unary ('^' factor)?          // right-associative power
 *   unary   := '-' unary | primary
 *   primary := number | '(' expr ')' | fn '(' expr (',' expr)* ')'
 */

const FUNCTIONS: Record<string, (...args: number[]) => number> = {
  sqrt: (x) => Math.sqrt(x),
  abs: (x) => Math.abs(x),
  round: (x) => Math.round(x),
  floor: (x) => Math.floor(x),
  ceil: (x) => Math.ceil(x),
  min: (...args) => Math.min(...args),
  max: (...args) => Math.max(...args),
};

export class CalculatorError extends Error {}

export function evaluate(expression: string): number {
  const parser = new Parser(expression);
  const value = parser.parseExpression();
  parser.expectEnd();
  if (!Number.isFinite(value)) {
    throw new CalculatorError(
      'Expression did not evaluate to a finite number.',
    );
  }
  return value;
}

class Parser {
  private pos = 0;

  constructor(private readonly input: string) {}

  parseExpression(): number {
    let value = this.parseTerm();
    for (;;) {
      const op = this.peekOperator(['+', '-']);
      if (!op) return value;
      this.pos += 1;
      const rhs = this.parseTerm();
      value = op === '+' ? value + rhs : value - rhs;
    }
  }

  expectEnd(): void {
    this.skipWhitespace();
    if (this.pos < this.input.length) {
      throw new CalculatorError(
        `Unexpected "${this.input.slice(this.pos, this.pos + 10)}" at position ${this.pos}.`,
      );
    }
  }

  private parseTerm(): number {
    let value = this.parseFactor();
    for (;;) {
      const op = this.peekOperator(['*', '/', '%']);
      if (!op) return value;
      this.pos += 1;
      const rhs = this.parseFactor();
      if ((op === '/' || op === '%') && rhs === 0) {
        throw new CalculatorError('Division by zero.');
      }
      value = op === '*' ? value * rhs : op === '/' ? value / rhs : value % rhs;
    }
  }

  private parseFactor(): number {
    const base = this.parseUnary();
    if (this.peekOperator(['^'])) {
      this.pos += 1;
      return base ** this.parseFactor(); // right-assoc via recursion
    }
    return base;
  }

  private parseUnary(): number {
    this.skipWhitespace();
    if (this.input[this.pos] === '-') {
      this.pos += 1;
      return -this.parseUnary();
    }
    return this.parsePrimary();
  }

  private parsePrimary(): number {
    this.skipWhitespace();
    const char = this.input[this.pos];

    if (char === '(') {
      this.pos += 1;
      const value = this.parseExpression();
      this.expectChar(')');
      return value;
    }

    const fnMatch = /^([a-z]+)\s*\(/.exec(this.input.slice(this.pos));
    if (fnMatch) {
      const fn = FUNCTIONS[fnMatch[1]];
      if (!fn) {
        throw new CalculatorError(
          `Unknown function "${fnMatch[1]}" — available: ${Object.keys(FUNCTIONS).join(', ')}.`,
        );
      }
      this.pos += fnMatch[0].length;
      const args = [this.parseExpression()];
      this.skipWhitespace();
      while (this.input[this.pos] === ',') {
        this.pos += 1;
        args.push(this.parseExpression());
      }
      this.expectChar(')');
      return fn(...args);
    }

    const numMatch = /^\d+(\.\d+)?/.exec(this.input.slice(this.pos));
    if (numMatch) {
      this.pos += numMatch[0].length;
      return Number(numMatch[0]);
    }

    throw new CalculatorError(
      `Expected a number, "(" or a function at position ${this.pos}.`,
    );
  }

  private peekOperator(ops: string[]): string | null {
    this.skipWhitespace();
    const char = this.input[this.pos];
    return ops.includes(char) ? char : null;
  }

  private expectChar(expected: string): void {
    this.skipWhitespace();
    if (this.input[this.pos] !== expected) {
      throw new CalculatorError(
        `Expected "${expected}" at position ${this.pos}.`,
      );
    }
    this.pos += 1;
  }

  private skipWhitespace(): void {
    while (/\s/.test(this.input[this.pos] ?? '')) this.pos += 1;
  }
}
