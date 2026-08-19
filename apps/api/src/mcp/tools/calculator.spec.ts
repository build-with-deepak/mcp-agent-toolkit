import { CalculatorError, evaluate } from './calculator';

describe('calculator evaluate', () => {
  it('handles precedence: multiplication before addition', () => {
    expect(evaluate('2 + 3 * 4')).toBe(14);
  });

  it('handles parentheses', () => {
    expect(evaluate('(2 + 3) * 4')).toBe(20);
  });

  it('handles unary minus, including doubled', () => {
    expect(evaluate('-5 + 3')).toBe(-2);
    expect(evaluate('--5')).toBe(5);
  });

  it('power is right-associative', () => {
    expect(evaluate('2 ^ 3 ^ 2')).toBe(512); // 2^(3^2), not (2^3)^2 = 64
  });

  it('supports decimals and modulo', () => {
    expect(evaluate('10.5 % 3')).toBeCloseTo(1.5);
  });

  it('supports functions with multiple arguments', () => {
    expect(evaluate('max(3, min(10, 7), 5)')).toBe(7);
    expect(evaluate('sqrt(16) + round(2.6)')).toBe(7);
  });

  it('rejects division by zero with a clear message', () => {
    expect(() => evaluate('1 / 0')).toThrow(CalculatorError);
    expect(() => evaluate('1 / 0')).toThrow(/division by zero/i);
  });

  it('rejects unknown functions, naming the available ones', () => {
    expect(() => evaluate('log(10)')).toThrow(/available/);
  });

  it('rejects trailing garbage instead of silently ignoring it', () => {
    expect(() => evaluate('1 + 1; process.exit()')).toThrow(CalculatorError);
  });

  it('rejects anything resembling code', () => {
    expect(() => evaluate('constructor')).toThrow(CalculatorError);
    expect(() => evaluate('1).__proto__')).toThrow(CalculatorError);
  });
});
