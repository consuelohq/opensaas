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
	siteTitle: 'Consuelo — Open-Source Sales Infrastructure',
	siteDescription:
		'Power dialer, AI CRM, real-time coaching, and analytics for insurance sales teams. $20/seat. Free CRM forever. Open source.',
	ogImage: '/og.jpg',
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
