import path from "node:path";

export const F8_LANGUAGES = ["python", "javascript", "sql", "c", "cpp", "csharp"] as const;
export type F8Language = typeof F8_LANGUAGES[number];
export const F8_LANGUAGE_INSTRUCTION = `CODE ONE+, CODE DJ and CODE ORACLE must generate only Python, JavaScript, SQL, C, C++ or C# code. Canonical language values: python, javascript, sql, c, cpp, csharp. TypeScript and other programming languages are not permitted, including config scripts. Documentation, HTML/CSS and declarative build/configuration files are allowed as support material. Use portable-source for non-JavaScript primary languages; it is an editable source handoff, not a running or deployed service. Never claim compilation, tests or deployment occurred.`;

const codeExtensions: Record<string, F8Language> = {
  ".py": "python", ".js": "javascript", ".jsx": "javascript", ".mjs": "javascript", ".cjs": "javascript",
  ".sql": "sql", ".c": "c", ".h": "c", ".cpp": "cpp", ".cc": "cpp", ".cxx": "cpp",
  ".hpp": "cpp", ".hh": "cpp", ".hxx": "cpp", ".cs": "csharp",
};
const codeLabels: Record<string, F8Language> = {
  python: "python", py: "python", javascript: "javascript", js: "javascript", jsx: "javascript",
  sql: "sql", c: "c", cpp: "cpp", "c++": "cpp", csharp: "csharp", "c#": "csharp", cs: "csharp",
};
const supportExtensions = new Set([".json", ".yaml", ".yml", ".toml", ".ini", ".cfg", ".conf", ".md", ".txt",
  ".html", ".css", ".scss", ".xml", ".csproj", ".sln", ".props", ".targets", ".resx", ".cmake", ".lock", ".example"]);
const supportLabels = new Set(["json", "yaml", "yml", "toml", "ini", "config", "conf", "markdown", "md",
  "text", "txt", "plaintext", "html", "css", "scss", "xml", "env", "dotenv", "gitignore", "dockerfile",
  "makefile", "cmake", "properties", "sln", "csproj", "editorconfig"]);
const supportNames = new Set(["makefile", "cmakelists.txt", "dockerfile", ".gitignore", ".gitattributes", ".editorconfig", ".env"]);
export function validateF8LanguageBundle(bundle: {
  language: string; platform: string; manifest: { language: string; entrypoint: string };
  files: { path: string; language: string; content: string }[];
}, requested?: F8Language): string | null {
  if (!F8_LANGUAGES.includes(bundle.language as F8Language)) return "Unsupported F8 primary programming language";
  if (requested && bundle.language !== requested) return "Generated language must match the selected F8 language";
  if (bundle.manifest.language !== bundle.language) return "Manifest language must match the F8 bundle language";
  if (bundle.language !== "javascript" && bundle.platform !== "portable-source") return "Non-JavaScript output requires the portable-source implementation path";
  for (const file of bundle.files) {
    if (file.path.includes("\\") || /[\x00-\x1f]/.test(file.path)) return "Generated paths must be safe POSIX relative paths";
    const ext = path.posix.extname(file.path).toLowerCase();
    const name = path.posix.basename(file.path).toLowerCase();
    const language = codeLabels[file.language.toLowerCase()];
    const extensionLanguage = codeExtensions[ext];
    if (extensionLanguage) {
      if (!language || (language !== extensionLanguage && !(ext === ".h" && language === "cpp"))) return `Code language does not match file extension: ${file.path}`;
    } else if (!supportLabels.has(file.language.toLowerCase()) ||
      (!supportExtensions.has(ext) && !supportNames.has(name) && !name.startsWith(".env."))) {
      return `Unsupported F8 programming language or file type: ${file.path}`;
    }
  }
  const entry = bundle.files.find(file => file.path === bundle.manifest.entrypoint);
  if (entry && codeLabels[entry.language.toLowerCase()] !== bundle.language) return "Entrypoint must use the selected primary programming language";
  return null;
}
