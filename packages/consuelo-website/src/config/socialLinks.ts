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
		name: 'github',
		link: 'https://github.com/consuelohq/opensaas',
		icon: 'github-icon'
	},
	{
		name: 'twitter',
		link: 'https://twitter.com/consuelohq',
		icon: 'twitter-icon'
	}
]
