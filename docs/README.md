# Klisteni documentation

Start with the [visual product tour](../README.md). The guides below explain the
current implementation, its evidence and its operating limits. Most technical
guides are written in Spanish, matching the application.

| I want to… | Read |
| --- | --- |
| Start all applications and databases from the repository root | [Unified local development](development.md) |
| Continue the VPS delivery on a Mac, including local Blender work | [Mac workspace and handoff](development-macos.md) |
| Continue from another Codex instance on a VPS with the Mac off | [VPS development and handoff prompt](development-vps.md) |
| Follow the B2B roadmap, white-label refactor, 3D production and UI testing | [Implementation roadmap](roadmap-implementacion.md) |
| Implement company domains, contextual login, multiple branches, themes and modules | [White-label B2B plan and E2E acceptance](b2b-white-label.md) |
| See delivered features, verified results and outstanding acceptance | [Release evidence](b2b-release.md) |
| Reproduce the B2B browser matrix | [Browser validation](b2b-browser-validation.md) |
| Check production-mode containers, migrations and backup restoration | [Runtime validation](b2b-runtime-validation.md) |
| Run the independent gym platform, member app and backoffice | [B2B product](b2b.md) |
| Run the complete local demo or configure a separate instance | [Demo and instance modes](public-demo.md) |
| Understand the educational approach and exercise sources | [Exercise criteria and references](exercise-sources.md) |
| Explore yoga asanas, cultural context and source criteria | [Yoga library and references](yoga-sources.md) |
| Build and record yoga practices, or extend the feature | [Yoga practices](yoga.md) |
| Extend an exercise's planning metadata | [Exercise planning](exercise-planning.md) |
| Inspect the anatomy's origin, preparation and limits | [Anatomy sources](anatomy-model-sources.md) |
| Understand packages, movement and persistence | [Architecture](architecture.md) |
| Set up accounts, invitations and data recovery | [Accounts and operation](accounts.md) |
| Configure trials and development-only billing | [Invitations and subscriptions](subscriptions.md) |
| Understand health charts and missing observations | [Health dashboard](health-dashboard.md) |
| Prepare a normalized health import | [Health import format](health-import.md) |
| Check which health connections exist or are planned | [Integration status](health-integrations.md) |
| Explore the proposed Android synchronization bridge | [Health sync proposal](health-sync.md) |
| Regenerate catalogue posters and movement loops | [Exercise previews](exercise-previews.md) |
| Recreate the README screenshots and GIFs | [README media](readme-media.md) |
| Build, release, observe or roll back the app | [Deployment and operation](deployment.md) |

Account and payment implementation does not establish hosted availability.
The default public demo has no account client, login, paywall or analytics.
An instance requires an operator's public profile and separately configured API.
Automatic health-provider synchronization remains planned; the supported import
path is the normalized Klisteni JSON format.

The October 11 delivery includes the gym workflows and a verified local
production-mode runtime. New Blender content, physical-phone acceptance and public
deployment remain separate work. Preview generation and complete preview validation
are deferred by the project owner; existing media remain in Git. The release guide
records this limitation, including its effect on the full checks and default CI.

The next agreed direction is one shared B2B deployment with company domains and
multiple branches from the first delivery. Domain-bound sessions, branch permissions,
themes and modules are planned in WL-0–WL-8; the existing release evidence does not
validate them. Transfer a published Git checkpoint before continuing on the VPS.
