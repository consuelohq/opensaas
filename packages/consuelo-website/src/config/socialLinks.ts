// Social Links
// ------------
// Description: The social links data for the website.

export interface SocialLink {
	name: string
	link: string
	icon: string
}

export const socialLinks: SocialLink[] = [
	{
		name: 'X (Twitter)',
		link: 'https://x.com/consuelohq',
		icon: 'twitter-icon'
	},
	{
		name: 'LinkedIn',
		link: 'https://linkedin.com/company/consuelohq',
		icon: 'linkedin-icon'
	},
	{
		name: 'GitHub',
		link: 'https://github.com/consuelohq',
		icon: 'github-icon'
	}
]
