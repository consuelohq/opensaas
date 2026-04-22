// Config
// ------------
// Description: The configuration file for the website.

export interface Logo {
	src: string
	darkSrc?: string
	alt: string
}

export type Mode = 'auto' | 'light' | 'dark'

export interface Config {
	siteTitle: string
	siteDescription: string
	ogImage: string
	logo: Logo
	canonical: boolean
	noindex: boolean
	mode: Mode
	scrollAnimations: boolean
}

export const configData: Config = {
	siteTitle: 'Consuelo | Open-Source Sales Infrastructure for Insurance Sales Teams',
	siteDescription:
		'Power dialer, AI CRM, real-time coaching, and analytics for insurance sales teams. Open source, composable, and built to integrate everywhere your team works.',
	ogImage: '/og.png',
	logo: {
		src: '/logo.svg',
		darkSrc: '/logo-dark.svg',
		alt: 'Consuelo'
	},
	canonical: true,
	noindex: false,
	mode: 'auto',
	scrollAnimations: true
}
