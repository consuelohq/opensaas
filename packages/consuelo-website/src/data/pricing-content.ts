import { siteLinks } from './site-links'

export type PricingHeroContent = {
	title: string
	subtitle: string
}

export type PricingAccountLink = {
	prompt: string
	label: string
	href: string
}

export type PricingArtworkMotif = 'switch' | 'secure' | 'observe'

export type PricingPlan = {
	name: string
	price: string
	subtitle: string
	badge?: string
	imageLabel: string
	motif: PricingArtworkMotif
	bullets: string[]
	highlight?: boolean
}

export const pricingHero: PricingHeroContent = {
	title: 'CHOOSE A PLAN',
	subtitle: 'All paid plans include monthly credits for hosted Consuelo usage.'
}

export const pricingAccountLink: PricingAccountLink = {
	prompt: 'Already have an account?',
	label: 'SIGN IN',
	href: siteLinks.login
}

export const pricingPlans: PricingPlan[] = [
	{
		name: 'Free',
		price: '$0',
		subtitle: 'LOCAL',
		imageLabel: 'NO LOCK-IN',
		motif: 'switch',
		bullets: ['ALL CORE FEATURES', 'LOCAL WORKSPACE', 'BRING YOUR OWN AGENT', '$0 MONTHLY CREDITS']
	},
	{
		name: 'Plus',
		price: '$20',
		subtitle: 'PER MONTH',
		badge: '10% BONUS',
		imageLabel: 'STAYS LOCKED',
		motif: 'secure',
		bullets: [
			'$22 MONTHLY CREDITS',
			'$10 ROLLOVER CAP',
			'HOSTED WORKSPACE USAGE',
			'CLOUD SANDBOXES'
		],
		highlight: true
	},
	{
		name: 'Super',
		price: '$100',
		subtitle: 'PER MONTH',
		badge: '10% BONUS',
		imageLabel: 'READ RECEIPTS',
		motif: 'observe',
		bullets: [
			'$110 MONTHLY CREDITS',
			'$50 ROLLOVER CAP',
			'HOSTED WORKSPACE USAGE',
			'CLOUD SANDBOXES'
		]
	},
	{
		name: 'Ultra',
		price: '$200',
		subtitle: 'PER MONTH',
		badge: '10% BONUS',
		imageLabel: 'READ RECEIPTS',
		motif: 'observe',
		bullets: [
			'$220 MONTHLY CREDITS',
			'$100 ROLLOVER CAP',
			'HOSTED WORKSPACE USAGE',
			'CLOUD SANDBOXES'
		]
	}
]
