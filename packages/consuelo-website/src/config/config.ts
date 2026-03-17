// Config
// ------------
// Description: The configuration file for the website.

export interface Logo {
	src: string
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
	siteTitle: 'Consuelo — Sales Infrastructure That Works Everywhere You Work',
	siteDescription:
		'Power dialer, AI coaching, CRM, and lead automation — all connected. $20/mo.',
	ogImage: '/og.jpg',
	logo: {
		src: '/logo.svg',
		alt: 'Consuelo'
	},
	canonical: true,
	noindex: false,
	mode: 'auto',
	scrollAnimations: false
}
