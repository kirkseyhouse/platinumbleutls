<!-- cat-agent-consumer {"schema_version":1,"id":"consumer.platinum-bleu-site","kind":"adapter","business":"platinum-bleu","version":"0.1.2","shared_root":"C:\\dev\\cat-agent-system","shared_commit":"ded5ef67353d55b60058aec05e920c32a29e2892","project_root":"C:\\dev\\Platinum-Bleu-shared-agent-consumer","overlay":"businesses/platinum-bleu/overlay.md"} -->
# Shared-system consumer loader

This isolated website-repository consumer accepts shared guidance version `0.1.2` at
`ded5ef67353d55b60058aec05e920c32a29e2892`. All existing local instructions follow unchanged.

Before shared-dependent work:

1. Confirm the project root is `C:\dev\Platinum-Bleu-shared-agent-consumer`, the business is
   Platinum Bleu (`platinum-bleu`), and the branch is `codex/platinum-shared-consumer`.
   Run `git status --short --branch`, understand staged, modified and untracked work, and preserve it.
2. From this root, run
   `pwsh -NoProfile -File C:\dev\cat-agent-system\scripts\validate-system.ps1 -ConsumerPath .\AGENTS.md`.
   If validation fails or the accepted checkout is missing, report the exact failure and stop
   shared-dependent work. Do not substitute a checkout, change the pin or upgrade automatically.
3. Read these six documents from the validated shared root:
   `core/operating-principles.md`, `core/authority-model.md`, `core/handoff-protocol.md`,
   `core/model-routing.md`, `core/tool-use.md`, and `core/knowledge-management.md`.
   Load only `businesses/platinum-bleu/overlay.md` as business guidance.
4. Preserve authority: host constraints, current user scope, applicable local project instructions,
   Platinum Bleu's designated business sources, then the accepted shared guidance.
   Shared methods do not replace local rules, business facts, records or approval gates.
5. Before accessing Notion, Google Drive, Housecall Pro, QuickBooks, WordPress, Cloudflare,
   Vercel, billing or any other connected system, confirm explicit task authorization and the
   exact active account, workspace, company and project belong to the intended Platinum Bleu context.
   Missing or conflicting identity blocks that access. Tool availability is not identity evidence.
6. Keep the non-Git operations/evidence workspace `C:\dev\Platinum Bleu` separate from the
   website repository `C:\dev\Platinum Bleu\platinum-bleu-site`, this isolated consumer, and the
   separate `platinum-bleu-dashboard` application. Never edit an original checkout through this pilot.
   The base-branch snapshot does not include original uncommitted planning revisions. Before future
   website work, read the current local strategy, design, plan and handoffs in the original website
   repository read-only and resolve differences before implementation. Do not infer approval from this snapshot.
7. Preserve existing operational ownership: Platinum Bleu HQ, Intake, role dashboards and SOPs in
   Notion; the Website Implementation Dashboard for website status; Housecall Pro for operational
   customer/job records; QuickBooks for accounting; and designated Google Drive document originals.
   Keep these systems, credentials, billing, deployment configuration and production state outside
   the shared system. Create no dashboard, CRM, source of truth, plugin or production integration.
8. This release authorizes only a local consumer adapter, local validation, read-only walkthrough
   and scoped local commit. It authorizes no connected-system access or update, website build,
   cross-business data sharing, push, merge, rebase, deployment or production action.
   The local dashboard synchronization contract applies to separately authorized website builds;
   it does not authorize an external update for this shared-guidance pilot.
9. Report local structural validation separately from observed walkthrough behavior and production
   readiness. Neither a validator pass nor this commit proves live access, integration, business
   outcomes or universal agent compliance. Report verified, structural-only, untested and blocked
   evidence, owner decisions, exact Git state, the next model/effort recommendation, a one-sentence
   model rationale, and a ready-to-paste Next Prompt for Codex. The Next Prompt must continue from
   existing context, state the exact next action and expected output, preserve relevant constraints,
   and never make Catherine restate known context or desired output. Use `Next Prompt: none` only
   when no next task is known.

# Platinum Bleu Website Build Instructions

## Authoritative project surfaces

- Work only in this repository for the Platinum Bleu website replacement.
- Treat the current repository, approved implementation plan, and checked-in migration evidence as the technical source of truth.
- Use the Notion **Website Implementation Dashboard** under **Platinum Bleu HQ** as the stakeholder status source: https://app.notion.com/p/3dc401438e5081199a58ec10161fba6d
- Preserve unrelated and pre-existing worktree changes.

## Dashboard synchronization contract

Keep the Notion website dashboard synchronized throughout every authorized build session.

1. Before implementation, update the applicable milestone to `In Progress` and confirm its owner, dependencies, definition of done, and evidence state.
2. After each meaningful implementation step, update the milestone percentage only from demonstrated deliverables and attach the relevant commit, file, test, preview, or approved external-evidence link.
3. After verification, record the exact result, update `Last Verified`, and classify the evidence as `Verified`, `Partial`, `Unavailable`, or `Owner Decision`.
4. When work cannot proceed, mark the milestone `Blocked` immediately and name the exact decision, access, dependency, or evidence required and its owner.
5. At each approval gate, stop before deployment, DNS, hosting, WordPress, analytics, Search Console, email, or live Housecall Pro action until Catherine approves that specific action.
6. At session close, reconcile Git status and delivered evidence with the milestone; refresh project health, phase, next milestone, progress, blockers, and the current weekly update; then read the changed Notion records back.

Do not call work complete because a draft, commit, preview, deployment, test banner, or dashboard percentage exists. Report verified, partial, untested, and blocked work separately.

Work performed independently by another developer is not verified until its code, tests, deployment, or other evidence is inspected. Do not infer their progress from messages or elapsed time.
