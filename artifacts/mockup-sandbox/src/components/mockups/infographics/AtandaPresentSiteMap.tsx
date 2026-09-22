import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  Box,
  Check,
  CircleDashed,
  ExternalLink,
  FileCheck2,
  GitBranch,
  KeyRound,
  LockKeyhole,
  Network,
  RadioTower,
  ShieldCheck,
  Terminal,
  Wrench,
} from "lucide-react";

type Status = "active" | "gated" | "dormant" | "incomplete" | "conditional";

const statusMeta: Record<Status, { label: string; className: string }> = {
  active: { label: "ACTIVE", className: "status-active" },
  gated: { label: "GATED / CONDITIONAL", className: "status-gated" },
  dormant: { label: "INACTIVE / DORMANT", className: "status-dormant" },
  incomplete: { label: "INCOMPLETE / UNROUTED", className: "status-incomplete" },
  conditional: { label: "CONDITIONAL", className: "status-gated" },
};

const routeGroups = [
  {
    title: "Public edge",
    marker: "01",
    note: "Open access • certificate + lead magnets",
    routes: [
      ["/verify", "Certificate verification", "Certificate-ID lookup; supports ?cert= parameter.", "active"],
      ["/test-your-agent", "Agent test magnet", "Public prompt test-kit, email capture, API submission.", "active"],
      ["/calculate-your-savings", "Savings magnet", "Public calculator and lead capture call to action.", "active"],
    ] as [string, string, string, Status][],
  },
  {
    title: "Core staff routes",
    marker: "02",
    note: "Staff Access required after the public edge",
    routes: [
      ["/command", "Command dashboard", "Session metrics, engine health, active task progress. JCSE / streak values are placeholder data.", "active"],
      ["/guide", "Operator guide", "Onboarding materials, recommended paths, exemplar links.", "active"],
      ["/sessions", "Session management", "Searchable session list and detail entry.", "active"],
      ["/session/new", "New session", "Creates a controlled artifact workspace.", "active"],
      ["/session/:id", "Session cockpit", "Status and workspace cockpit with artifact progression.", "active"],
      ["/ingest", "Document ingest", "Parse and upload documents into session workflows.", "active"],
      ["/cartridge", "Cartridge workflow", "Ingestion and packaging interface for document cartridges.", "active"],
      ["/prompts", "Prompt library", "Prompt resources available to the operator.", "active"],
      ["/quests", "Quests", "Task progression and operator objectives.", "active"],
      ["/me/activity", "Activity log", "Personal audit log; restricted to admins / owners.", "active"],
      ["/me/costs", "Cost ledger", "Session cost visibility.", "active"],
      ["/account", "Account profile", "Preferences, data exports, deletion controls.", "active"],
    ] as [string, string, string, Status][],
  },
  {
    title: "Libraries & side-steps",
    marker: "03",
    note: "Staff-gated despite open-access product wording",
    routes: [
      ["/exemplars", "Exemplar library", "Browse, search, and view model exemplars.", "active"],
      ["/exemplars/:id", "Exemplar detail", "Single exemplar record and deterministic hand-off.", "active"],
      ["/spc-player", "SPC Player", "SPC run status, creation, output packages.", "active"],
      ["/spc-player/new", "New SPC Player run", "Create a player run from a recommended or manual kit.", "active"],
      ["/spc-player/:id", "SPC Player detail", "Run inspection and package access.", "active"],
    ] as [string, string, string, Status][],
  },
];

const lifecycle = [
  ["F1", "Prompt test", "Test prompt intent and baseline signal.", "active"],
  ["F2", "ATOMIC", "Atomic framing and constraint lock.", "active"],
  ["F3", "MA", "Model architecture definition.", "active"],
  ["F4", "Micro-PDD", "Small product definition document.", "active"],
  ["F5", "SPC Forge", "Structured prompt construction.", "active"],
  ["F6", "Draft PDD + VDJ", "Draft product definition + value / decision journal.", "active"],
  ["F7", "MVP conversion", "Convert the artifact into a buildable MVP.", "active"],
  ["F8", "CODE DJ export", "Code decision journal export.", "active"],
  ["F9", "Signed custody / runtime", "Signed artifact custody and runtime.", "active"],
  ["F10", "Release gateway", "Merged release intent, destination, processing.", "active"],
];

function StatusBadge({ status }: { status: Status }) {
  const item = statusMeta[status];
  return <span className={`status-badge ${item.className}`}><span className="status-dot" />{item.label}</span>;
}

function SectionLabel({ number, children }: { number: string; children: string }) {
  return <div className="section-label"><span>{number}</span><strong>{children}</strong></div>;
}

function RouteCard({ route, label, detail, status }: { route: string; label: string; detail: string; status: Status }) {
  return (
    <div className="route-card">
      <div className="route-line"><code>{route}</code><StatusBadge status={status} /></div>
      <div className="route-label">{label}</div>
      <p>{detail}</p>
    </div>
  );
}

export function AtandaPresentSiteMap() {
  return (
    <main className="atanda-placard">
      <header className="placard-header">
        <div className="header-kicker"><span className="signal" /> ATANDA // INTERNAL ARCHITECTURE PLACARD <span className="header-rule" /> AUDIT 20.09.2026</div>
        <div className="header-main">
          <div>
            <div className="eyebrow">PRESENT-STATE SITE MAP / STAKEHOLDER EDITION</div>
            <h1>Command Centre <em>route topology</em></h1>
            <p className="lede">A controlled F0–F10 artifact lifecycle for operators turning intent into signed, release-ready work.</p>
          </div>
          <div className="placard-stamp"><ShieldCheck size={30} /><span>ROUTING<br /><b>CONTROLLED</b></span></div>
        </div>
        <div className="header-metrics">
          <div><b>03</b><span>PUBLIC ROUTES</span></div>
          <div><b>22</b><span>STAFF SURFACES</span></div>
          <div><b>10</b><span>CANONICAL GATES</span></div>
          <div><b>04</b><span>STATUS CLASSES</span></div>
        </div>
      </header>

      <section className="access-band">
        <div className="access-copy"><SectionLabel number="00">ENTRY / ACCESS MODEL</SectionLabel><p>Root redirects to <code>/command</code>. Every registered route not listed as public sits behind <b>Staff Access</b>. ADMIN adds the two administrative surfaces. Unknown paths resolve to <b>Not Found</b>.</p></div>
        <div className="access-tree">
          <div className="tree-node root"><Terminal size={17} /><code>/</code><small>REDIRECT</small></div><ArrowDown className="tree-arrow" size={18} />
          <div className="tree-node command"><Network size={17} /><code>/command</code><small>STAFF ACCESS</small></div>
          <div className="tree-split"><span /><span /></div>
          <div className="tree-node public"><ExternalLink size={16} /><code>/verify</code><small>PUBLIC</small></div>
          <div className="tree-node public"><ExternalLink size={16} /><code>/test-your-agent</code><small>PUBLIC</small></div>
          <div className="tree-node public"><ExternalLink size={16} /><code>/calculate-your-savings</code><small>PUBLIC</small></div>
        </div>
      </section>

      <section className="content-section">
        <SectionLabel number="01">ROUTE REGISTER</SectionLabel>
        <div className="route-grid">
          {routeGroups.map((group) => (
            <div className="route-group" key={group.marker}>
              <div className="group-head"><span>{group.marker}</span><div><h2>{group.title}</h2><p>{group.note}</p></div></div>
              {group.routes.map(([route, label, detail, status]) => <RouteCard key={route} route={route} label={label} detail={detail} status={status} />)}
            </div>
          ))}
        </div>
      </section>

      <section className="pipeline-section">
        <SectionLabel number="02">SESSION COCKPIT / CANONICAL ARTIFACT LINE</SectionLabel>
        <div className="pipeline-intro"><div><h2>F0 is advisory. F1–F10 is the controlled line.</h2><p>Sequential, tier, and cost gates shape progression. Each active stage is a custody point, not a loose checklist.</p></div><div className="f0-callout"><span>ADVISORY</span><b>F0</b><code>/f0</code><small>seed prompt dashboard<br />outside canonical line</small></div></div>
        <div className="lifecycle">
          {lifecycle.map(([code, title, detail], index) => <div className="stage" key={code}><div className="stage-index">{code}</div><div className="stage-body"><h3>{title}</h3><p>{detail}</p><StatusBadge status="active" /></div>{index < lifecycle.length - 1 && <ArrowRight className="stage-arrow" size={19} />}</div>)}
        </div>
        <div className="pipeline-rails"><div><LockKeyhole size={16} /><b>Sequential gate</b><span>next stage depends on previous artifact state</span></div><div><KeyRound size={16} /><b>Tier gate</b><span>operator / artifact tier controls availability</span></div><div><Box size={16} /><b>Cost gate</b><span>run economics are tracked before release</span></div></div>
        <div className="side-step"><div className="side-step-tag">OPTIONAL PRE_BUILD SIDE-STEP</div><ArrowDown size={17} /><div><b>SPC Player</b><code>/spc-player/:id</code><span>branches from F5; does not advance stages</span></div></div>
      </section>

      <section className="bottom-grid">
        <div className="panel">
          <SectionLabel number="03">SIDE-STEPS / SEAMS</SectionLabel>
          <div className="fact-list">
            <div><Check /><b>Exemplar → Player</b><span>Deterministic recommendations + manual 1–12 SPC KIT DECK are ACTIVE.</span></div>
            <div><Wrench /><b>Sphinx publish / suggest</b><span><StatusBadge status="gated" /> Environment / service configuration seam.</span></div>
            <div><RadioTower /><b>Webhook delivery</b><span><StatusBadge status="active" /> ACTIVE; per-run authorization required.</span></div>
            <div><GitBranch /><b>F10 / release gateway</b><span><StatusBadge status="active" /> <code>/f10</code> is the final release surface.</span></div>
          </div>
        </div>
        <div className="panel">
          <SectionLabel number="04">PROGRESSION / ADMIN</SectionLabel>
          <div className="fact-list">
            <div><ArrowRight /><b><code>/ascension</code></b><span><StatusBadge status="gated" /> ARK import requires configuration; may show Coming Soon.</span></div>
            <div><ShieldCheck /><b><code>/admin/badges</code></b><span><StatusBadge status="active" /> ACTIVE, admin-only.</span></div>
            <div><RadioTower /><b><code>/admin/ops</code></b><span><StatusBadge status="active" /> ACTIVE, admin-only; cron needs external scheduled deployment.</span></div>
            <div><CircleDashed /><b>Org / account management</b><span><StatusBadge status="active" /> ACTIVE.</span></div>
            <div><AlertTriangle /><b>Subscriptions / billing</b><span><StatusBadge status="dormant" /> Stripe checkout, portal, seats behind <code>SUBSCRIPTIONS_ENABLED</code>.</span></div>
            <div><AlertTriangle /><b><code>/pricing</code> · <code>/f1000</code></b><span><StatusBadge status="incomplete" /> Pricing unregistered; F1000 code exists without route.</span></div>
          </div>
        </div>
      </section>

      <section className="integration-section">
        <SectionLabel number="05">INTEGRATIONS / RUNTIME STATUS</SectionLabel>
        <div className="integration-grid">
          <div className="integration-card"><span className="int-bar active" /><b>LLM PROVIDERS</b><StatusBadge status="active" /><p>Active, requires configured provider credentials.</p></div>
          <div className="integration-card"><span className="int-bar conditional" /><b>GITHUB EXPORT</b><StatusBadge status="conditional" /><p>Export active; OAuth / PR reliability conditional.</p></div>
          <div className="integration-card"><span className="int-bar conditional" /><b>EMAIL</b><StatusBadge status="conditional" /><p>Conditional; dry-run without provider.</p></div>
          <div className="integration-card"><span className="int-bar conditional" /><b>SENTRY</b><StatusBadge status="conditional" /><p>Conditional; no-op without DSN.</p></div>
          <div className="integration-card"><span className="int-bar conditional" /><b>ARK / SPHINX</b><StatusBadge status="conditional" /><p>Conditional, configuration-dependent.</p></div>
          <div className="integration-card"><span className="int-bar dormant" /><b>STRIPE</b><StatusBadge status="dormant" /><p>Intentionally dormant in this deployment.</p></div>
          <div className="integration-card"><span className="int-bar conditional" /><b>SCHEDULED CRON</b><StatusBadge status="conditional" /><p>Conditional; external scheduler required.</p></div>
          <div className="integration-card mismatch"><span className="int-bar gated" /><b>PRODUCT MISMATCH</b><StatusBadge status="gated" /><p>Public SPC Player claim vs staff-gated web route.</p></div>
        </div>
      </section>

      <section className="legend-gap">
        <div className="legend"><SectionLabel number="06">LEGEND</SectionLabel><div className="legend-items"><StatusBadge status="active" /><StatusBadge status="gated" /><StatusBadge status="dormant" /><StatusBadge status="incomplete" /></div></div>
        <div className="gap-box"><div className="gap-title"><AlertTriangle size={18} /> KNOWN GAPS / INTERPRETATION</div><p>Page existence does not guarantee external service configuration. <b>Inactive</b> means intentionally dormant. <b>Incomplete</b> means code / link exists without a registered end-to-end route. Audit reflects source at <b>September 20, 2026</b>.</p></div>
      </section>

      <footer><span>ATANDA COMMAND CENTRE</span><span>Source: current App router, top navigation, OpenAPI, route implementations, and feature-flag/config checks.</span><b>END OF REGISTER //</b></footer>
    </main>
  );
}

export default AtandaPresentSiteMap;