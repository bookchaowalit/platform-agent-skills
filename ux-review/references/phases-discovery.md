# Phases P0–P6: setup, product map, routes, flows

Each phase lists **Steps**, **Pass** (what must be true before moving on) and **Output**
(files in the evidence folder, see `report-format.md`).

## P0 Setup

Steps:

1. Read the repository's README, AGENTS/CLAUDE, PRODUCT/DESIGN docs and glossary. Note
   the framework version: some frameworks differ from what you remember, so read their
   local docs before changing code.
2. Choose the environment for each kind of check:
   - **Read-only public pages:** production or staging is fine.
   - **Anything that logs in, writes, uploads, pays or sends:** local or staging only.
     Start the API and database locally when no staging exists.
3. Create one account per role. Use the repository's fixtures where they exist, or
   clearly named test accounts on a local database. Never store passwords in reports.
4. Fix the widths for the review:
   - always 375 and 1440;
   - add 320, 768 and 1024 for layout work;
   - add 390 when the product targets recent phones.
5. Create the evidence folder, and record the commit, environment URLs and date in its
   `README.md`.

Pass:

- every role can sign in;
- the data covers empty, typical and long-content cases;
- the evidence folder exists.

Output: `README.md` covering scope, environment, accounts (role names only), widths and
the commit.

## P1 Product map from code

Steps:

1. List every route from the router, including dynamic segments, and every navigation
   surface: header, side bar, mobile menu, tabs, footer and account menu.
2. List roles and permissions from the auth code, the route guards and the API.
3. Name the main use cases as business outcomes for each role, for example "submit
   land for a station" rather than "open the form". Login, upload and confirm are steps
   inside a use case, not use cases.
4. For each use case, mark it:
   - **implemented** (end to end in code);
   - **partial** (part of the path is a stub, mock or flag);
   - **proposed** (only in docs or copy).

   Cite the file for each status.
5. Note feature flags, mocks and sample data that change what a user sees.

Pass: every route and use case has a status with a source file.

Output: `01-product-map.md`, containing the route table, roles, use cases with status
and evidence, flags and mocks.

## P2 Personas

Steps:

1. Write a persona only for a role the code supports. Note a proposed persona apart from
   the real ones.
2. For each persona, record:
   - goal;
   - entry points;
   - main use cases;
   - key decisions;
   - what success looks like;
   - likely pain points;
   - permissions.

Pass: each persona maps to at least one implemented or partial use case.

Output: `02-personas/<persona>.md`

## P3 Sitemap and route sweep

Steps:

1. Build the sitemap from P1. Give each route a real instance (an id that exists) or
   mark it "no instance".
2. Open every route as each role and logged out, at each width, and record:
   - HTTP status;
   - final URL after redirects;
   - page or console errors;
   - horizontal overflow;
   - load time;
   - whether access matches the permission model;
   - a screenshot.
3. Follow every internal link once and record any 404, wrong redirect or dead end
   (a page with no way forward or back).

Pass:

- there are no 5xx responses or JS errors;
- no page is reachable without its permission;
- no page is unreachable with its permission;
- there are no dead links or dead ends, or each has a defect ID.

Output: `03-sitemap.csv`, `03-route-results.csv` and `03-link-results.csv`, plus
screenshots.

## P4 Authorization matrix

Steps:

1. Make a matrix of role × page × action, with the API endpoint behind each action.
2. Call each endpoint as each role on a local or staging environment and record the
   status code.
3. Probe object access by asking for another user's or organisation's record by ID
   (IDOR).
4. Compare what the UI hides with what the API allows. If the UI hides an action the
   API permits, or shows an action the API refuses, that is a defect.

Pass: every mismatch is a defect or an owner decision.

Output: `04-authorization.csv` and `04-authorization.md`

## P5 Persona flows (as-is and to-be)

Steps:

1. For each persona, draw one overview flow: entry, goal, main use cases and outcomes.
2. For each main use case, draw a detailed flow covering:
   - entry;
   - user action;
   - system response;
   - decisions;
   - validation;
   - the authentication point;
   - success;
   - error;
   - recovery;
   - exit.
3. **As-is flows** use only routes and actions that exist. Write "unknown" where the
   code does not prove a transition.
4. **To-be flows** reduce steps, clarify decisions, remove dead ends and improve
   recovery. Mark every new screen or step as proposed.
5. Give each step a traceability row:
   - step id;
   - route;
   - component file;
   - action;
   - destination;
   - API.

Mermaid rules:

- use `flowchart TD`;
- use short Thai labels;
- give each node a stable ID;
- label every decision branch;
- split a diagram once it has more than about 20 nodes.

Pass: every Mermaid file parses, and every as-is step has a traceability row.

Output:

- `05-flows/<persona>/overview.mmd`
- `05-flows/<persona>/<use-case>.mmd`
- `05-flows/ideal/...`
- `05-traceability.csv`
- `05-actual-vs-ideal.md`

## P6 Flow tests

Steps:

1. Turn each as-is flow into browser steps. Each decision branch becomes its own
   scenario.
2. Run every flow at 1440. Run the P0 and P1 flows again at 375 or 390.
3. For each step, record:
   - pass, fail, blocked (with the reason) or not run;
   - a screenshot;
   - the URL;
   - the time taken.

   Stop a scenario at its first failure, then continue with the next scenario.
4. Keep failures caused by the test script or the diagram apart from product defects.
5. Colour the Mermaid nodes by result so the owner can see where flows break.

Pass:

- every P0 flow passes at both widths, or has a defect ID;
- every blocked step names what would unblock it (an account, data, a flag or a
  third party).

Output:

- `06-flow-tests/step_results.csv`
- `06-flow-tests/flow_summary.csv`
- `06-flow-tests/<flow>.result.mmd`
- screenshots
