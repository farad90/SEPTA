import { FormulaSyntaxError } from "./errors";

export type TokenType =
  | "NUMBER"
  | "IDENTIFIER"
  | "PLUS"
  | "MINUS"
  | "STAR"
  | "SLASH"
  | "PERCENT"
  | "LPAREN"
  | "RPAREN"
  | "COMMA"
  | "EQ"
  | "NEQ"
  | "GT"
  | "GTE"
  | "LT"
  | "LTE"
  | "AND"
  | "OR"
  | "NOT"
  | "EOF";

export interface Token {
  type: TokenType;
  value: string;
  position: number;
}

const KEYWORDS = new Set(["AND", "OR"]);

/** لغزش امن — بدون eval یا new Function؛ فقط دستور زبان محدود فرمول را می‌شناسد */
export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  const n = source.length;
  let i = 0;

  while (i < n) {
    const ch = source[i];

    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      i++;
      continue;
    }

    const start = i;

    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(source[i + 1] ?? ""))) {
      let j = i;
      while (j < n && /[0-9]/.test(source[j])) j++;
      if (source[j] === ".") {
        j++;
        while (j < n && /[0-9]/.test(source[j])) j++;
      }
      tokens.push({ type: "NUMBER", value: source.slice(i, j), position: start });
      i = j;
      continue;
    }

    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < n && /[A-Za-z0-9_]/.test(source[j])) j++;
      const text = source.slice(i, j);
      const upper = text.toUpperCase();
      if (KEYWORDS.has(upper)) {
        tokens.push({ type: upper as TokenType, value: text, position: start });
      } else {
        tokens.push({ type: "IDENTIFIER", value: text, position: start });
      }
      i = j;
      continue;
    }

    switch (ch) {
      case "+":
        tokens.push({ type: "PLUS", value: ch, position: start });
        i++;
        continue;
      case "-":
        tokens.push({ type: "MINUS", value: ch, position: start });
        i++;
        continue;
      case "*":
        tokens.push({ type: "STAR", value: ch, position: start });
        i++;
        continue;
      case "/":
        tokens.push({ type: "SLASH", value: ch, position: start });
        i++;
        continue;
      case "%":
        tokens.push({ type: "PERCENT", value: ch, position: start });
        i++;
        continue;
      case "(":
        tokens.push({ type: "LPAREN", value: ch, position: start });
        i++;
        continue;
      case ")":
        tokens.push({ type: "RPAREN", value: ch, position: start });
        i++;
        continue;
      case ",":
        tokens.push({ type: "COMMA", value: ch, position: start });
        i++;
        continue;
      case "=":
        if (source[i + 1] === "=") {
          tokens.push({ type: "EQ", value: "==", position: start });
          i += 2;
          continue;
        }
        throw new FormulaSyntaxError("کاراکتر غیرمنتظره '=' — منظورتون '==' بود؟", start);
      case "!":
        if (source[i + 1] === "=") {
          tokens.push({ type: "NEQ", value: "!=", position: start });
          i += 2;
          continue;
        }
        tokens.push({ type: "NOT", value: "!", position: start });
        i++;
        continue;
      case ">":
        if (source[i + 1] === "=") {
          tokens.push({ type: "GTE", value: ">=", position: start });
          i += 2;
          continue;
        }
        tokens.push({ type: "GT", value: ">", position: start });
        i++;
        continue;
      case "<":
        if (source[i + 1] === "=") {
          tokens.push({ type: "LTE", value: "<=", position: start });
          i += 2;
          continue;
        }
        tokens.push({ type: "LT", value: "<", position: start });
        i++;
        continue;
      default:
        throw new FormulaSyntaxError(`کاراکتر غیرمجاز '${ch}'`, start);
    }
  }

  tokens.push({ type: "EOF", value: "", position: n });
  return tokens;
}
