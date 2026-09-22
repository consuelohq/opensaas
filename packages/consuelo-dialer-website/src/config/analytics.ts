// Google tracking
export const googleSiteVerification = import.meta.env.PUBLIC_GOOGLE_SITE_VERIFICATION || ''
export const googleAnalyticsMeasurementID = import.meta.env.PUBLIC_GA_TRACKING_ID || ''
export const googleTagManagerID = import.meta.env.PUBLIC_GTM_ID || ''

// PostHog
export const posthogKey = import.meta.env.PUBLIC_POSTHOG_KEY || ''
export const posthogHost = import.meta.env.PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'

// Sentry
export const sentryDsn = import.meta.env.PUBLIC_SENTRY_DSN || ''
