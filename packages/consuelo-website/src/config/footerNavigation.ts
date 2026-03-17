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
			'Open-source sales infrastructure for insurance teams. Power dialer, AI CRM, real-time coaching, and analytics — all in one platform.',
		logo: {
			src: '/logo.svg',
			alt: 'Consuelo',
			text: 'Consuelo'
		}
	},
	footerColumns: [
		{
			category: 'Product',
			subCategories: [
				{ subCategory: 'Features', subCategoryLink: '/features' },
				{ subCategory: 'Pricing', subCategoryLink: '/pricing' },
				{ subCategory: 'FAQ', subCategoryLink: '/faq' },
				{ subCategory: 'Changelog', subCategoryLink: '/changelog' }
			]
		},
		{
			category: 'Resources',
			subCategories: [
				{ subCategory: 'Documentation', subCategoryLink: 'https://docs.consuelohq.com' },
				{ subCategory: 'Blog', subCategoryLink: '/blog' },
				{ subCategory: 'GitHub', subCategoryLink: 'https://github.com/consuelohq/opensaas' }
			]
		},
		{
			category: 'Company',
			subCategories: [
				{ subCategory: 'Contact', subCategoryLink: '/contact' },
				{ subCategory: 'Terms', subCategoryLink: '/terms' }
			]
		}
	],
	subFooter: {
		copywriteText: '© Consuelo 2025.'
	}
}
