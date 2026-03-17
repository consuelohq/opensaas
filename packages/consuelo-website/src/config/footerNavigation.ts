// Footer Navigation
// ------------
// Description: The footer navigation data for the website.
export interface Logo {
	src: string
	alt: string
	text: string
}

export interface FooterAbout {
	title: string
	aboutText: string
	logo: Logo
}

export interface SubCategory {
	subCategory: string
	subCategoryLink: string
}

export interface FooterColumn {
	category: string
	subCategories: SubCategory[]
}

export interface SubFooter {
	copywriteText: string
}

export interface FooterData {
	footerAbout: FooterAbout
	footerColumns: FooterColumn[]
	subFooter: SubFooter
}

export const footerNavigationData: FooterData = {
	footerAbout: {
		title: 'Consuelo',
		aboutText:
			'Sales infrastructure that works everywhere you work. Power dialer, AI coaching, CRM, and lead automation — all connected.',
		logo: {
			src: '/logo.svg',
			alt: 'Consuelo — Sales Infrastructure',
			text: 'Consuelo'
		}
	},
	footerColumns: [
		{
			category: 'Product',
			subCategories: [
				{ subCategory: 'Features', subCategoryLink: '/features' },
				{ subCategory: 'Pricing', subCategoryLink: '/pricing' },
				{ subCategory: 'Changelog', subCategoryLink: '/changelog' }
			]
		},
		{
			category: 'Company',
			subCategories: [
				{ subCategory: 'Blog', subCategoryLink: '/blog' },
				{ subCategory: 'FAQ', subCategoryLink: '/faq' },
				{ subCategory: 'Contact', subCategoryLink: '/contact' }
			]
		},
		{
			category: 'Legal',
			subCategories: [
				{ subCategory: 'Terms', subCategoryLink: '/terms' },
				{ subCategory: 'Privacy', subCategoryLink: '/terms' }
			]
		}
	],
	subFooter: {
		copywriteText: '© Consuelo 2026.'
	}
}
