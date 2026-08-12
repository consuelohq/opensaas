// Public legacy-route compatibility for the Mintlify-to-Starlight cutover.
export const legacyRedirects = {
  '/connect/connectors': '/connect/apps-and-services/',
  '/connect/connectors/github': '/connect/apps-and-services/github/',
  '/connect/connectors/google-drive': '/connect/apps-and-services/google-drive/',
  '/connect/connectors/gmail': '/connect/apps-and-services/gmail/',
  '/connect/connectors/google-calendar': '/connect/apps-and-services/google-calendar/',
  '/connect/connectors/slack': '/connect/apps-and-services/slack/',
  '/connect/connectors/additional-connectors': '/connect/apps-and-services/additional-services/',
  '/os/concepts/configuration': '/reference/configuration/',
  '/os/glossary': '/reference/glossary/',
  '/os/concepts/mcp-ingress-security': '/secure/hosted-mcp-ingress/',
  '/os/concepts/observability': '/observe/',
  '/tools/sites/overview': '/sites/',
  '/os/concepts/portal': '/build/tools/how-tools-work/',
  '/os/concepts/skills': '/build/skills/how-skills-work/',
  '/os/concepts/scripts': '/build/skills/skill-structure/',
  '/os/concepts/context-and-memory': '/build/shared-memory-and-context/',
  '/os/concepts/files-and-artifacts': '/build/files-and-artifacts/',
  '/os/concepts/approvals': '/build/approvals/',
  '/os/tools/overview': '/build/tools/workspace/',
  '/os/tools/browser-tools': '/build/tools/browser/',
  '/tools/overview': '/build/tools/how-tools-work/',
  '/tools/office': '/build/tools/artifacts/',
  '/build/tools/office': '/build/tools/artifacts/',
  '/tools/media/getting-started': '/build/tools/media/',
  '/developers/agent/tool-system': '/build/tools/how-tools-work/',
  '/developers/agent/integrations': '/connect/apps-and-services/',
  '/os/concepts/integrations-and-capabilities': '/connect/apps-and-services/',
  '/os/overview': '/start/',
  '/os/how-it-works': '/start/core-concepts/',
  '/os/getting-started/install': '/start/install-consuelo-os/',
  '/os/getting-started/connect-agents': '/start/connect-your-first-agent/',
  '/os/getting-started/workspace-launcher': '/start/create-a-workspace/',
  '/os/concepts/local-and-cloud': '/start/local-and-consuelo-cloud/',
  '/user-guide/introduction': '/start/',
  '/user-guide/getting-started/capabilities/what-is-consuelo': '/start/',
  '/user-guide/getting-started/how-tos/create-workspace': '/start/create-a-workspace/',
  '/consuelo-ui/display/app-tooltip': '/developers/introduction',
  '/consuelo-ui/display/checkmark': '/developers/introduction',
  '/consuelo-ui/display/chip': '/developers/introduction',
  '/consuelo-ui/display/icons': '/developers/introduction',
  '/consuelo-ui/display/soon-pill': '/developers/introduction',
  '/consuelo-ui/display/tag': '/developers/introduction',
  '/consuelo-ui/input/block-editor': '/developers/introduction',
  '/consuelo-ui/input/buttons': '/developers/introduction',
  '/consuelo-ui/input/checkbox': '/developers/introduction',
  '/consuelo-ui/input/color-scheme': '/developers/introduction',
  '/consuelo-ui/input/icon-picker': '/developers/introduction',
  '/consuelo-ui/input/image-input': '/developers/introduction',
  '/consuelo-ui/input/radio': '/developers/introduction',
  '/consuelo-ui/input/select': '/developers/introduction',
  '/consuelo-ui/input/text': '/developers/introduction',
  '/consuelo-ui/input/toggle': '/developers/introduction',
  '/consuelo-ui/introduction': '/developers/introduction',
  '/consuelo-ui/navigation': '/developers/introduction',
  '/consuelo-ui/navigation/breadcrumb': '/developers/introduction',
  '/consuelo-ui/navigation/links': '/developers/introduction',
  '/consuelo-ui/navigation/menu-item': '/developers/introduction',
  '/consuelo-ui/navigation/navigation-bar': '/developers/introduction',
  '/consuelo-ui/navigation/step-bar': '/developers/introduction',
  '/consuelo-ui/progress-bar': '/developers/introduction',
  '/graphql-api/analytics/connecting-external-analytics':
    '/developers/api/graphql',
  '/graphql-api/analytics/growth-metrics-dashboards': '/developers/api/graphql',
  '/graphql-api/analytics/scheduled-reports': '/developers/api/graphql',
  '/graphql-api/automation/data-cleanup-automation': '/developers/api/graphql',
  '/graphql-api/automation/internal-workflows-overview':
    '/developers/api/graphql',
  '/graphql-api/automation/lead-scoring-setup': '/developers/api/graphql',
  '/graphql-api/automation/slack-notifications': '/developers/api/graphql',
  '/graphql-api/general/bulk-update-script': '/developers/api/graphql',
  '/graphql-api/general/export-analytics': '/developers/api/graphql',
  '/graphql-api/general/import-automation': '/developers/api/graphql',
  '/graphql-api/general/internal-api-access': '/developers/api/graphql',
  '/graphql-api/general/rate-limits-and-best-practices':
    '/developers/api/graphql',
  '/graphql-api/getting-started/setting-up-internal-workspace':
    '/developers/api/graphql',
  '/graphql-api/overview': '/developers/api/graphql',
  '/graphql-api/troubleshooting/common-ops-issues': '/developers/api/graphql',
  '/os/agent-context/test-driven-agent-work': '/build/workflows/',
  '/os/skills/browser': '/build/skills/bundled/browser/',
  '/os/skills/consuelo-workspace-snapshot': '/build/skills/how-skills-work/',
  '/os/skills/daily-revenue-brief': '/build/skills/how-skills-work/',
  '/os/skills/debugger': '/build/skills/bundled/debugger/',
  '/os/skills/handoff': '/build/skills/bundled/handoff/',
  '/os/skills/office': '/build/skills/bundled/artifacts/',
  '/os/skills/office-landing-page': '/build/skills/how-skills-work/',
  '/os/skills/planned/campaign-brief': '/build/skills/how-skills-work/',
  '/os/skills/planned/follow-up-generator': '/build/skills/how-skills-work/',
  '/os/skills/planned/google-ads-review': '/build/skills/how-skills-work/',
  '/os/skills/planned/landing-page-builder': '/build/skills/how-skills-work/',
  '/os/skills/planned/lead-prioritizer': '/build/skills/how-skills-work/',
  '/os/skills/planned/meta-ads-review': '/build/skills/how-skills-work/',
  '/os/skills/planned/post-call-analysis': '/build/skills/how-skills-work/',
  '/os/skills/planned/sales-coaching': '/build/skills/how-skills-work/',
  '/os/skills/planned/weekly-manager-report': '/build/skills/how-skills-work/',
  '/os/skills/research-ingest': '/build/skills/bundled/research-ingest/',
  '/os/skills/senior-engineer': '/build/skills/bundled/senior-engineer/',
  '/os/skills/sites': '/build/skills/bundled/sites/',
  '/os/skills/skill-creator': '/build/skills/bundled/skill-creator/',
  '/os/skills/task': '/build/skills/bundled/task/',
  '/os/skills/teach': '/build/skills/bundled/teach/',
  '/os/tools/exploration-tools': '/build/tools/workspace/',
  '/os/tools/filesystem-tools': '/build/tools/workspace/',
  '/os/tools/github-and-review-tools': '/build/tools/workspace/',
  '/os/tools/task-and-stream-tools': '/build/tools/workspace/',
  '/os/tools/tool-search': '/build/tools/workspace/',
  '/tools/media/capabilities': '/build/tools/media/',
  '/tools/media/reference/media-breakdown-plan': '/build/tools/media/',
  '/tools/media/reference/media-compose': '/build/tools/media/',
  '/tools/media/reference/media-export': '/build/tools/media/',
  '/tools/media/reference/media-frames-extract': '/build/tools/media/',
  '/tools/media/reference/media-ingest': '/build/tools/media/',
  '/tools/media/reference/media-motion-track': '/build/tools/media/',
  '/tools/media/reference/media-overlay-render': '/build/tools/media/',
  '/tools/media/reference/media-pose-estimate': '/build/tools/media/',
  '/tools/media/reference/media-probe': '/build/tools/media/',
  '/tools/media/reference/media-qa': '/build/tools/media/',
  '/tools/media/reference/media-scene-detect': '/build/tools/media/',
  '/tools/media/reference/media-svg-convert': '/build/tools/media/',
  '/tools/media/reference/media-timeline-validate':
    '/build/tools/media/',
  '/tools/media/reference/media-transcribe': '/build/tools/media/',
  '/tools/media/workflows/first-video': '/build/tools/media/',
  '/tools/media/workflows/image-to-svg': '/build/tools/media/',
  '/tools/media/workflows/youtube-clip-breakdown':
    '/build/tools/media/',
  '/user-guide/billing/capabilities/pricing-plans':
    '/user-guide/getting-started/capabilities/implementation-services',
  '/user-guide/billing/capabilities/workflow-credits':
    '/user-guide/getting-started/capabilities/implementation-services',
  '/user-guide/billing/how-tos/billing-faq':
    '/user-guide/getting-started/capabilities/implementation-services',
  '/user-guide/billing/overview':
    '/user-guide/getting-started/capabilities/implementation-services',
  '/user-guide/calendar-emails/capabilities/calendar': '/connect/apps-and-services/google-calendar/',
  '/user-guide/calendar-emails/capabilities/mailbox': '/connect/apps-and-services/gmail/',
  '/user-guide/calendar-emails/how-tos/can-i-book-meetings-from-consuelo':
    '/build/tools/artifacts/',
  '/user-guide/calendar-emails/how-tos/can-i-send-emails-from-consuelo':
    '/build/tools/artifacts/',
  '/user-guide/calendar-emails/how-tos/can-i-track-email-activity-on-all-objects':
    '/build/tools/artifacts/',
  '/user-guide/calendar-emails/how-tos/connect-several-mailboxes-per-user':
    '/build/tools/artifacts/',
  '/user-guide/calendar-emails/how-tos/i-dont-see-emails-on-records':
    '/build/tools/artifacts/',
  '/user-guide/calendar-emails/how-tos/limit-emails-imported': '/build/tools/artifacts/',
  '/user-guide/calendar-emails/overview': '/connect/apps-and-services/google-workspace/',
  '/user-guide/dashboards/capabilities/chart-settings': '/',
  '/user-guide/dashboards/capabilities/dashboards': '/',
  '/user-guide/dashboards/capabilities/widgets': '/',
  '/user-guide/dashboards/how-tos/dashboards-faq': '/',
  '/user-guide/dashboards/how-tos/widget-faq': '/',
  '/user-guide/dashboards/overview': '/',
  '/user-guide/data-migration/capabilities/error-handling':
    '/',
  '/user-guide/data-migration/capabilities/field-mapping':
    '/',
  '/user-guide/data-migration/capabilities/file-formats':
    '/',
  '/user-guide/data-migration/capabilities/import-relations':
    '/',
  '/user-guide/data-migration/capabilities/uniqueness-constraints':
    '/',
  '/user-guide/data-migration/how-tos/export-your-data':
    '/',
  '/user-guide/data-migration/how-tos/fix-import-errors':
    '/',
  '/user-guide/data-migration/how-tos/import-companies-via-csv':
    '/',
  '/user-guide/data-migration/how-tos/import-contacts-via-csv':
    '/',
  '/user-guide/data-migration/how-tos/import-data-via-api':
    '/',
  '/user-guide/data-migration/how-tos/import-relations-between-objects-via-csv':
    '/',
  '/user-guide/data-migration/how-tos/migrating-from-other-crms':
    '/',
  '/user-guide/data-migration/how-tos/migrating-from-self-hosted-to-cloud':
    '/',
  '/user-guide/data-migration/how-tos/prepare-your-csv-files':
    '/',
  '/user-guide/data-migration/how-tos/update-existing-records-via-import':
    '/',
  '/user-guide/data-migration/how-tos/upload-csv-programmatically':
    '/',
  '/user-guide/data-migration/overview': '/',
  '/user-guide/data-model/capabilities/fields': '/',
  '/user-guide/data-model/capabilities/objects': '/',
  '/user-guide/data-model/capabilities/relation-fields':
    '/',
  '/user-guide/data-model/how-tos/create-custom-fields':
    '/',
  '/user-guide/data-model/how-tos/create-custom-objects':
    '/',
  '/user-guide/data-model/how-tos/create-many-to-many-relations':
    '/',
  '/user-guide/data-model/how-tos/create-relation-fields':
    '/',
  '/user-guide/data-model/how-tos/customize-your-data-model':
    '/',
  '/user-guide/data-model/how-tos/data-model-faq': '/',
  '/user-guide/data-model/overview': '/',
  '/user-guide/dialer/hold-mute': '/build/tools/artifacts/',
  '/user-guide/dialer/how-tos/discord-setup': '/build/tools/artifacts/',
  '/user-guide/dialer/making-calls': '/build/tools/artifacts/',
  '/user-guide/dialer/overview': '/build/tools/artifacts/',
  '/user-guide/dialer/transfers': '/build/tools/artifacts/',
  '/user-guide/discord-bot/capabilities/call-controls': '/build/tools/artifacts/',
  '/user-guide/discord-bot/capabilities/contact-search': '/build/tools/artifacts/',
  '/user-guide/discord-bot/capabilities/queue-management': '/build/tools/artifacts/',
  '/user-guide/discord-bot/capabilities/team-collaboration': '/build/tools/artifacts/',
  '/user-guide/discord-bot/getting-started': '/build/tools/artifacts/',
  '/user-guide/discord-bot/overview': '/build/tools/artifacts/',
  '/user-guide/features/overview': '/start/',
  '/user-guide/file-system/capabilities/auto-indexing':
    '/build/files-and-artifacts/',
  '/user-guide/file-system/capabilities/file-categories':
    '/build/files-and-artifacts/',
  '/user-guide/file-system/capabilities/knowledge-base':
    '/build/files-and-artifacts/',
  '/user-guide/file-system/how-tos/file-system-faq':
    '/build/files-and-artifacts/',
  '/user-guide/file-system/overview': '/build/files-and-artifacts/',
  '/user-guide/graphql-api/overview': '/developers/api/graphql',
  '/user-guide/guides-tutorials/overview': '/start/',
  '/user-guide/highlevel/overview': '/',
  '/user-guide/highlevel/embedded/getting-started':
    '/connect/apps-and-services/leadconnector-dialer/',
  '/user-guide/integrations/overview': '/connect/apps-and-services/',
  '/user-guide/permissions-access/capabilities/permissions': '/secure/access-and-permissions/',
  '/user-guide/permissions-access/capabilities/sso-configuration': '/secure/access-and-permissions/',
  '/user-guide/permissions-access/how-tos/permissions-faq': '/secure/access-and-permissions/',
  '/user-guide/permissions-access/overview': '/secure/access-and-permissions/',
  '/user-guide/settings/capabilities/domains-settings':
    '/user-guide/getting-started/how-tos/configure-your-workspace',
  '/user-guide/settings/capabilities/experience-settings':
    '/user-guide/getting-started/how-tos/configure-your-workspace',
  '/user-guide/settings/capabilities/member-management':
    '/user-guide/getting-started/how-tos/configure-your-workspace',
  '/user-guide/settings/capabilities/profile-settings':
    '/user-guide/getting-started/how-tos/configure-your-workspace',
  '/user-guide/settings/capabilities/updates-settings':
    '/user-guide/getting-started/how-tos/configure-your-workspace',
  '/user-guide/settings/capabilities/workspace-settings':
    '/user-guide/getting-started/how-tos/configure-your-workspace',
  '/user-guide/settings/how-tos/settings-faq':
    '/user-guide/getting-started/how-tos/configure-your-workspace',
  '/user-guide/settings/overview':
    '/user-guide/getting-started/how-tos/configure-your-workspace',
  '/user-guide/views-pipelines/capabilities/calendar-view':
    '/',
  '/user-guide/views-pipelines/capabilities/fields-and-columns':
    '/',
  '/user-guide/views-pipelines/capabilities/filters-and-sorting':
    '/',
  '/user-guide/views-pipelines/capabilities/kanban-views':
    '/',
  '/user-guide/views-pipelines/capabilities/table-views':
    '/',
  '/user-guide/views-pipelines/capabilities/view-settings':
    '/',
  '/user-guide/views-pipelines/how-tos/create-a-calendar-view-for-tasks-due':
    '/',
  '/user-guide/views-pipelines/how-tos/create-a-kanban-view-for-projects':
    '/',
  '/user-guide/views-pipelines/how-tos/create-a-table-view-with-grouping':
    '/',
  '/user-guide/views-pipelines/how-tos/restrict-access-to-your-view':
    '/',
  '/user-guide/views-pipelines/how-tos/set-up-a-sales-pipeline':
    '/',
  '/user-guide/views-pipelines/how-tos/show-expected-amount-in-pipeline':
    '/',
  '/user-guide/views-pipelines/how-tos/track-time-in-stage':
    '/',
  '/user-guide/views-pipelines/overview': '/',
  '/user-guide/workflows/capabilities/send-emails-from-workflows':
    '/build/workflows/',
  '/user-guide/workflows/capabilities/use-branches-in-workflows':
    '/build/workflows/',
  '/user-guide/workflows/capabilities/use-iterator':
    '/build/workflows/',
  '/user-guide/workflows/capabilities/workflow-actions':
    '/build/workflows/',
  '/user-guide/workflows/capabilities/workflow-branches':
    '/build/workflows/',
  '/user-guide/workflows/capabilities/workflow-credits':
    '/build/workflows/',
  '/user-guide/workflows/capabilities/workflow-runs':
    '/build/workflows/',
  '/user-guide/workflows/capabilities/workflow-triggers':
    '/build/workflows/',
  '/user-guide/workflows/capabilities/workflow-versions':
    '/build/workflows/',
  '/user-guide/workflows/how-tos/advanced-configurations/handle-arrays-in-code-actions':
    '/build/workflows/',
  '/user-guide/workflows/how-tos/connect-to-other-tools/bring-product-data-in-consuelo':
    '/build/workflows/',
  '/user-guide/workflows/how-tos/connect-to-other-tools/bring-typeform-submissions-in-consuelo':
    '/build/workflows/',
  '/user-guide/workflows/how-tos/connect-to-other-tools/generate-pdf-from-consuelo':
    '/build/workflows/',
  '/user-guide/workflows/how-tos/connect-to-other-tools/generate-quote-or-invoice-from-consuelo':
    '/build/workflows/',
  '/user-guide/workflows/how-tos/connect-to-other-tools/set-up-a-webhook-trigger':
    '/build/workflows/',
  '/user-guide/workflows/how-tos/crm-automations/closed-won-automations':
    '/build/workflows/',
  '/user-guide/workflows/how-tos/crm-automations/detect-stale-opportunities':
    '/build/workflows/',
  '/user-guide/workflows/how-tos/crm-automations/display-number-of-emails-received':
    '/build/workflows/',
  '/user-guide/workflows/how-tos/crm-automations/display-related-record-data':
    '/build/workflows/',
  '/user-guide/workflows/how-tos/crm-automations/formula-fields':
    '/build/workflows/',
  '/user-guide/workflows/how-tos/crm-automations/notify-teammates-of-note-to-review':
    '/build/workflows/',
  '/user-guide/workflows/how-tos/crm-automations/send-email-alerts-with-tasks-due':
    '/build/workflows/',
  '/user-guide/workflows/how-tos/need-more-help/professional-services':
    '/build/workflows/',
  '/user-guide/workflows/how-tos/need-more-help/workflow-troubleshooting':
    '/build/workflows/',
  '/user-guide/workflows/how-tos/need-more-help/workflows-faq':
    '/build/workflows/',
  '/user-guide/workflows/overview': '/build/workflows/',
};
