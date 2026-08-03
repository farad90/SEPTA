import { FormulaNode } from "./ast";
import { FormulaSyntaxError } from "./errors";
import { Token, TokenType, tokenize } from "./lexer";

const COMPARE_OPS: Partial<Record<TokenType, "==" | "!=" | ">" | ">=" | "<" | "<=">> = {
  EQ: "==",
  NEQ: "!=",
  GT: ">",
  GTE: ">=",
  LT: "<",
  LTE: "<=",
};

/**
 * Recursive-descent parser — بدون eval/new Function. گرامر (EBNF):
 *   expression   := logicalOr
 *   logicalOr    := logicalAnd ( "OR" logicalAnd )*
 *   logicalAnd   := comparison ( "AND" comparison )*
 *   comparison   := additive ( ("=="|"!="|">"|">="|"<"|"<=") additive )?
 *   additive     := multiplicative ( ("+"|"-") multiplicative )*
 *   multiplicative := unary ( ("*"|"/"|"%") unary )*
 *   unary        := ("-"|"!")? primary
 *   primary      := NUMBER | IDENTIFIER | call | "(" expression ")"
 *   call         := IDENTIFIER "(" ( expression ("," expression)* )? ")"
 */
export class FormulaParser {
  private tokens: Token[] = [];
  private pos = 0;

  parse(source: string): FormulaNode {
    this.tokens = tokenize(source);
    this.pos = 0;
    const node = this.parseExpression();
    this.expect("EOF", "انتظار پایان عبارت بود — کاراکتر اضافی در انتها");
    return node;
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private advance(): Token {
    return this.tokens[this.pos++];
  }

  private check(type: TokenType): boolean {
    return this.peek().type === type;
  }

  private expect(type: TokenType, message: string): Token {
    if (!this.check(type)) {
      const tok = this.peek();
      throw new FormulaSyntaxError(`${message} (یافت شد: '${tok.value || tok.type}')`, tok.position);
    }
    return this.advance();
  }

  private parseExpression(): FormulaNode {
    return this.parseLogicalOr();
  }

  private parseLogicalOr(): FormulaNode {
    let left = this.parseLogicalAnd();
    while (this.check("OR")) {
      this.advance();
      const right = this.parseLogicalAnd();
      left = { kind: "logical", op: "OR", left, right };
    }
    return left;
  }

  private parseLogicalAnd(): FormulaNode {
    let left = this.parseComparison();
    while (this.check("AND")) {
      this.advance();
      const right = this.parseComparison();
      left = { kind: "logical", op: "AND", left, right };
    }
    return left;
  }

  private parseComparison(): FormulaNode {
    const left = this.parseAdditive();
    const op = COMPARE_OPS[this.peek().type];
    if (op) {
      this.advance();
      const right = this.parseAdditive();
      return { kind: "compare", op, left, right };
    }
    return left;
  }

  private parseAdditive(): FormulaNode {
    let left = this.parseMultiplicative();
    while (this.check("PLUS") || this.check("MINUS")) {
      const opTok = this.advance();
      const right = this.parseMultiplicative();
      left = { kind: "binary", op: opTok.type === "PLUS" ? "+" : "-", left, right };
    }
    return left;
  }

  private parseMultiplicative(): FormulaNode {
    let left = this.parseUnary();
    while (this.check("STAR") || this.check("SLASH") || this.check("PERCENT")) {
      const opTok = this.advance();
      const right = this.parseUnary();
      const op = opTok.type === "STAR" ? "*" : opTok.type === "SLASH" ? "/" : "%";
      left = { kind: "binary", op, left, right };
    }
    return left;
  }

  private parseUnary(): FormulaNode {
    if (this.check("MINUS")) {
      this.advance();
      return { kind: "unary", op: "-", operand: this.parseUnary() };
    }
    if (this.check("NOT")) {
      this.advance();
      return { kind: "unary", op: "!", operand: this.parseUnary() };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): FormulaNode {
    const tok = this.peek();

    if (tok.type === "NUMBER") {
      this.advance();
      return { kind: "number", value: Number(tok.value) };
    }

    if (tok.type === "LPAREN") {
      this.advance();
      const node = this.parseExpression();
      this.expect("RPAREN", "پرانتز باز بدون بسته شدن");
      return node;
    }

    if (tok.type === "IDENTIFIER") {
      this.advance();
      if (this.check("LPAREN")) {
        this.advance();
        const args: FormulaNode[] = [];
        if (!this.check("RPAREN")) {
          args.push(this.parseExpression());
          while (this.check("COMMA")) {
            this.advance();
            args.push(this.parseExpression());
          }
        }
        this.expect("RPAREN", `پرانتز فراخوانی تابع '${tok.value}' بسته نشده`);
        return { kind: "call", name: tok.value.toUpperCase(), args };
      }
      return { kind: "identifier", name: tok.value.toUpperCase() };
    }

    throw new FormulaSyntaxError(
      `عبارت غیرمنتظره — انتظار عدد، متغیر، تابع یا '(' بود (یافت شد: '${tok.value || tok.type}')`,
      tok.position,
    );
  }
}
