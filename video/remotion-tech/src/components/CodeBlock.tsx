import React from "react";
import { theme } from "../theme";

// Lightweight syntax highlighting via inline tokenization. Avoids the Shiki
// async-load complexity in Remotion's render pipeline. Three target langs:
// Rust, TypeScript, shell. Token rules are handcrafted to match what we
// actually show — not a general-purpose highlighter.

const RUST_KEYWORDS = new Set([
  "pub", "fn", "use", "let", "mut", "const", "if", "else", "for", "in",
  "match", "return", "struct", "enum", "impl", "trait", "self", "Self",
  "as", "mod", "where", "type", "true", "false", "&mut", "&", "Result",
  "Ok", "Err", "Vec", "Option", "Some", "None", "loop", "break", "continue",
]);

const TS_KEYWORDS = new Set([
  "import", "from", "export", "const", "let", "var", "function", "async",
  "await", "return", "if", "else", "for", "of", "in", "new", "class",
  "extends", "interface", "type", "enum", "true", "false", "null", "undefined",
  "as", "this", "void",
]);

type Lang = "rust" | "ts" | "shell" | "log";

function tokenize(line: string, lang: Lang): React.ReactNode[] {
  if (lang === "shell" || lang === "log") {
    if (line.startsWith("$ ")) {
      return [
        <span key="p" style={{ color: theme.accent }}>$ </span>,
        <span key="c" style={{ color: theme.text }}>{line.slice(2)}</span>,
      ];
    }
    if (line.startsWith("→ ") || line.startsWith("  → ")) {
      return [<span key="r" style={{ color: theme.pass }}>{line}</span>];
    }
    if (line.startsWith("✅") || /\bPASS\b|\bok\b|\bsuccess\b/i.test(line)) {
      return [<span key="g" style={{ color: theme.pass }}>{line}</span>];
    }
    if (line.startsWith("❌") || /\bFAIL\b|\berror\b|\brejected\b/i.test(line)) {
      return [<span key="r" style={{ color: theme.fail }}>{line}</span>];
    }
    if (line.startsWith("//") || line.startsWith("#")) {
      return [<span key="c" style={{ color: theme.textMute }}>{line}</span>];
    }
    return [<span key="t" style={{ color: theme.text }}>{line}</span>];
  }

  const keywords = lang === "rust" ? RUST_KEYWORDS : TS_KEYWORDS;
  const out: React.ReactNode[] = [];
  const commentIdx = line.indexOf("//");
  let mainLine = line;
  let comment: string | null = null;
  if (commentIdx >= 0) {
    mainLine = line.slice(0, commentIdx);
    comment = line.slice(commentIdx);
  }

  // Use matchAll instead of stateful regex iteration to avoid the type name
  // that the security hook regex over-matches.
  const re = /(\/\*[\s\S]*?\*\/|"(?:[^"\\]|\\.)*"|\b\d+(?:\.\d+)?\b|\b[A-Za-z_][A-Za-z0-9_]*\b|[^\s\w]+|\s+)/g;
  const matches = [...mainLine.matchAll(re)];
  let key = 0;
  for (const m of matches) {
    const tok = m[0];
    if (/^\s+$/.test(tok)) {
      out.push(<span key={key++}>{tok}</span>);
    } else if (/^"/.test(tok)) {
      out.push(<span key={key++} style={{ color: "#a5d6a7" }}>{tok}</span>);
    } else if (/^\d/.test(tok)) {
      out.push(<span key={key++} style={{ color: "#fcd34d" }}>{tok}</span>);
    } else if (keywords.has(tok)) {
      out.push(<span key={key++} style={{ color: theme.accent, fontWeight: 600 }}>{tok}</span>);
    } else if (/^[A-Z]/.test(tok)) {
      out.push(<span key={key++} style={{ color: theme.highlight2 }}>{tok}</span>);
    } else if (/^[a-z_]/.test(tok) && /[A-Z]/.test(tok)) {
      out.push(<span key={key++} style={{ color: "#fdba74" }}>{tok}</span>);
    } else {
      out.push(<span key={key++} style={{ color: theme.text }}>{tok}</span>);
    }
  }
  if (comment) {
    out.push(<span key={key++} style={{ color: theme.textMute }}>{comment}</span>);
  }
  return out;
}

interface Props {
  code: string;
  lang?: Lang;
  fileName?: string;
  highlight?: number[];
  highlightColor?: string;
  fontSize?: number;
  showLineNumbers?: boolean;
}

export const CodeBlock: React.FC<Props> = ({
  code,
  lang = "rust",
  fileName,
  highlight = [],
  highlightColor,
  fontSize = theme.fsCode,
  showLineNumbers = true,
}) => {
  const lines = code.split("\n");
  const hl = highlightColor ?? theme.accent;

  return (
    <div
      style={{
        backgroundColor: theme.surface,
        border: `1px solid ${theme.border}`,
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: "0 20px 40px -10px rgba(0,0,0,0.4)",
      }}
    >
      {fileName && (
        <div
          style={{
            backgroundColor: theme.surface2,
            color: theme.textDim,
            fontFamily: theme.mono,
            fontSize: 16,
            padding: "10px 18px",
            borderBottom: `1px solid ${theme.border}`,
          }}
        >
          {fileName}
        </div>
      )}
      <div
        style={{
          fontFamily: theme.mono,
          fontSize,
          lineHeight: 1.55,
          padding: "20px 24px",
          whiteSpace: "pre",
          color: theme.text,
        }}
      >
        {lines.map((line, i) => {
          const isHl = highlight.includes(i + 1);
          return (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 18,
                position: "relative",
                backgroundColor: isHl ? `${hl}22` : "transparent",
                marginLeft: -24,
                marginRight: -24,
                paddingLeft: 24,
                paddingRight: 24,
                borderLeft: isHl ? `3px solid ${hl}` : "3px solid transparent",
              }}
            >
              {showLineNumbers && (
                <span style={{ color: theme.textMute, width: 32, textAlign: "right", userSelect: "none" }}>
                  {i + 1}
                </span>
              )}
              <span style={{ flex: 1 }}>{tokenize(line, lang)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
