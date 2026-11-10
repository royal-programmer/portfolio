/**
 * `fit`: paste a job description, see the overlap with my stack. Client-side and pure: the text is
 * matched against an alias table. Every entry says honestly whether I have the skill (it must also be in
 * the résumé's lists), have used something close (adjacent), or do not have it yet.
 */
import type { TerminalData } from "@/lib/site/terminal-data";

export const FIT_MAX = 8 * 1024;

type Status = "have" | "adjacent" | "not";
type Skill = {
  /** Name printed in the output. */
  id: string;
  /** Lower-case spellings found in a job description. */
  aliases: string[];
  status: Status;
  /** have: the résumé / stack item that must exist for this to count. adjacent: what I have instead. */
  via?: string;
  /** Match only with this exact capitalisation (e.g. "Go"). */
  exact?: boolean;
};

const S = (id: string, aliases: string[], status: Status, via?: string, exact?: boolean): Skill => ({ id, aliases, status, via, exact });

/** Things I have (must also be listed in the résumé), things I have used next to them, and things I do not have. */
export const SKILLS: Skill[] = [
  S("C#", ["c#", "csharp", "c sharp"], "have", "C#"),
  S(".NET", [".net", "dotnet", "dot net", ".net core", "asp.net", "asp.net core", "asp.net mvc"], "have", ".NET"),
  S("React", ["react", "reactjs", "react.js"], "have", "React"),
  S("TypeScript", ["typescript", "ts"], "have", "TypeScript"),
  S("JavaScript", ["javascript", "js", "es6", "ecmascript"], "adjacent", "TypeScript"),
  S("Python", ["python", "python3"], "have", "Python"),
  S("FastAPI", ["fastapi"], "have", "FastAPI"),
  S("REST APIs", ["rest api", "rest apis", "restful", "web api", "web apis", "api design"], "have", "REST APIs"),
  S("SQL Server", ["sql server", "mssql", "ms sql", "t-sql", "tsql"], "have", "SQL Server"),
  S("SQL", ["sql", "rdbms", "relational database", "relational databases"], "have", "SQL Server"),
  S("PostgreSQL", ["postgres", "postgresql", "psql"], "have", "PostgreSQL"),
  S("RabbitMQ", ["rabbitmq", "amqp"], "have", "RabbitMQ"),
  S("Git", ["git", "github", "version control"], "have", "Git"),
  S("GitHub Actions", ["github actions"], "have", "GitHub Actions"),
  S("CI/CD", ["ci/cd", "cicd", "ci cd", "continuous integration", "continuous delivery", "continuous deployment"], "have", "CI/CD"),
  S("IIS", ["iis"], "have", "IIS"),
  S("Entra ID / Azure AD", ["azure ad", "entra", "entra id", "active directory", "sso", "oauth", "oidc", "saml"], "have", "Microsoft Entra ID"),
  S("Agile", ["agile", "scrum", "kanban"], "have", "Agile"),
  S("NetSuite", ["netsuite"], "have", "NetSuite"),
  S("Oracle EBS", ["oracle ebs", "oracle e-business", "oracle erp"], "have", "Oracle E-Business Suite"),
  S("Salesforce", ["salesforce", "sfdc"], "have", "Salesforce"),
  S("SAP SuccessFactors", ["successfactors", "sap"], "have", "SAP SuccessFactors"),
  S("Node.js", ["node", "node.js", "nodejs", "express.js", "expressjs"], "adjacent", "TypeScript, MERN internship"),
  S("MongoDB", ["mongodb", "mongo", "nosql"], "adjacent", "MERN internship"),
  S("Next.js", ["next.js", "nextjs"], "adjacent", "React, this site"),
  S("Kafka", ["kafka", "event streaming", "pub/sub", "pubsub", "message broker", "message queue", "message queues"], "adjacent", "RabbitMQ"),
  S("Azure", ["azure"], "adjacent", "Microsoft Entra ID"),
  S("Azure DevOps", ["azure devops", "jenkins", "gitlab ci", "circleci", "teamcity"], "adjacent", "GitHub Actions"),
  S("Java", ["java", "spring", "spring boot"], "adjacent", "C#"),
  S("Angular / Vue", ["angular", "vue", "vue.js", "svelte"], "adjacent", "React"),
  S("Django / Flask", ["django", "flask"], "adjacent", "FastAPI"),
  S("MySQL / Oracle DB", ["mysql", "mariadb", "oracle db", "oracle database", "pl/sql"], "adjacent", "SQL Server, PostgreSQL"),
  S("Microservices", ["microservices", "microservice", "service-oriented", "soa"], "adjacent", "Ocelot API Gateway, sync services"),
  S("Docker", ["docker", "containers", "containerization"], "not"),
  S("Kubernetes", ["kubernetes", "k8s", "helm"], "not"),
  S("AWS", ["aws", "amazon web services", "ec2", "lambda", "s3"], "not"),
  S("GCP", ["gcp", "google cloud"], "not"),
  S("GraphQL", ["graphql"], "not"),
  S("Redis", ["redis", "memcached"], "not"),
  S("Go", ["go", "golang"], "not", undefined, true),
  S("Rust", ["rust"], "not"),
  S("Terraform", ["terraform", "infrastructure as code", "iac", "ansible"], "not"),
  S("Linux", ["linux", "bash", "shell scripting"], "not"),
  S("Elasticsearch", ["elasticsearch", "elastic", "opensearch"], "not"),
  S("Machine learning", ["machine learning", "ml", "deep learning", "pytorch", "tensorflow"], "not"),
  S("Mobile (iOS/Android)", ["swift", "kotlin", "react native", "flutter", "ios", "android"], "not"),
  S("PHP / Ruby", ["php", "laravel", "ruby", "rails"], "not"),
];

export type FitResult = {
  matched: string[];
  adjacent: Array<{ want: string; have: string }>;
  notYet: string[];
  /** Share of the recognised skills I cover (adjacent counts half); null when nothing was recognised. */
  pct: number | null;
  verdict: string;
  /** What the verdict says, for the shell to put in words: no skill recognised, or how strong the overlap is. */
  level: "none" | "strong" | "good" | "partial";
  total: number;
  truncated: boolean;
};

const WORD = /[a-z0-9_#+]/;
const STOP_AFTER_GO = new Set(["to", "with", "beyond", "the", "above", "further", "live", "ahead", "back", "on", "for", "and", "in", "forward", "through", "over", "from", "a", "an", "your"]);

/** True when `alias` occurs in `text` as a whole token (not inside `javascript`, `nosql`, `asp.net`). */
function has(text: string, orig: string, alias: string, exact?: boolean): boolean {
  let from = 0;
  for (;;) {
    const i = text.indexOf(alias, from);
    if (i < 0) return false;
    from = i + 1;
    const before = i ? text[i - 1] : " ";
    const after = text[i + alias.length] ?? " ";
    if (/[a-z0-9_]/.test(before) || (/[#+]/.test(before) && /[a-z0-9]/.test(alias[0]))) continue;
    if (/[a-z0-9_]/.test(after) && !/[#+]$/.test(alias)) continue;
    if (/[#+]/.test(after) && /[a-z0-9]$/.test(alias)) continue;
    if (WORD.test(after) && /[#+]$/.test(alias)) continue;
    if (exact) {
      if (orig.slice(i, i + alias.length) !== "Go") continue;
      const next = /^\s+([a-z]+)/i.exec(orig.slice(i + alias.length))?.[1]?.toLowerCase();
      if ((next && STOP_AFTER_GO.has(next)) || /(^|[.!?\n])\s*$/.test(orig.slice(0, i))) continue;
    }
    return true;
  }
}

export function fitMatch(raw: string, data: TerminalData): FitResult {
  const truncated = raw.length > FIT_MAX;
  const orig = raw.slice(0, FIT_MAX);
  const text = orig.toLowerCase();
  // What the résumé and stack really list, lower-cased: a "have" entry only counts when it is in here.
  const pool = new Set([...data.resume.skills.flatMap((g) => g.items), ...data.stack].map((x) => x.toLowerCase()));
  const found = new Map<string, Skill>();
  for (const s of SKILLS) {
    if (s.aliases.some((a) => has(text, orig, a, s.exact))) found.set(s.id, s);
  }
  // "sql" is implied by a more specific database; keep the most specific line only.
  if (found.has("SQL Server") && found.has("SQL")) found.delete("SQL");
  const matched: string[] = [];
  const adjacent: FitResult["adjacent"] = [];
  const notYet: string[] = [];
  for (const s of found.values()) {
    if (s.status === "have" && s.via && pool.has(s.via.toLowerCase())) matched.push(s.id);
    else if (s.status === "have" || s.status === "adjacent") adjacent.push({ want: s.id, have: s.via ?? "" });
    else notYet.push(s.id);
  }
  const total = matched.length + adjacent.length + notYet.length;
  if (!total) return { matched, adjacent, notYet, pct: null, verdict: "no skills I recognise in that text · is it a job description?", level: "none", total: 0, truncated };
  const pct = Math.round(((matched.length + adjacent.length * 0.5) / total) * 100);
  const level = pct >= 70 ? "strong" : pct >= 45 ? "good" : "partial";
  const word = `${level} overlap`;
  return { matched, adjacent, notYet, pct, verdict: `${word} · ${pct}% of the ${total} skills I recognised`, level, total, truncated };
}
