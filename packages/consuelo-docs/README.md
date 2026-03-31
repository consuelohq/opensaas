# Consuelo Documentation

Official documentation for Consuelo, powered by [Mintlify](https://mintlify.com).

## 🌐 Live Site

Visit the documentation at [docs.consuelohq.com](https://docs.consuelohq.com)

## 📚 Content

This repository contains:

- **User Guide** (46 pages) - Complete guide for Consuelo users
- **Developers** (24 pages) - Technical documentation for developers
- **Consuelo UI** (25 pages) - UI component library documentation

## 🚀 Local Development

To run the documentation locally:

```bash
# From the consuelo monorepo root
npx nx run consuelo-docs:dev
```

The documentation will be available at `http://localhost:3000`

## 📝 Editing Content

### Adding/Editing Pages

1. Edit MDX files in the appropriate directory:
   - `user-guide/` - User documentation
   - `developers/` - Developer documentation
   - `consuelo-ui/` - Component documentation

2. Update `navigation/base-structure.json` if you need to change the tab/group hierarchy or add/remove pages. This file stays in the repo and is **not** uploaded to Crowdin.
3. Keep the translation template (`navigation/navigation.template.json`) in sync by running `yarn docs:generate-navigation-template` after editing the base structure. This template is the only file that should be pushed to Crowdin.
4. For each translated locale pulled from Crowdin, ensure a `packages/consuelo-docs/l/<language>/navigation.json` file exists. These files contain **labels only**; page slugs always come from the base structure.
5. Run `yarn docs:generate` to rebuild `docs.json` from the base structure + translated labels.

### MDX Format

All documentation pages use MDX format with frontmatter:

```mdx
---
title: Page Title
description: Page description
image: /images/path/to/image.png
---

Your content here...
```

### Adding Images

1. Place images in the `/images/` directory
2. Reference them in MDX: `![Alt text](/images/your-image.png)`
3. Or use Mintlify Frame component:

```mdx
<Frame>
  <img src="/images/your-image.png" alt="Description" />
</Frame>
```

## 🔧 Configuration

- `navigation/base-structure.json` - Source of truth for tabs, groups, icons, and page slugs (English only, not sent to Crowdin).
- `navigation/navigation.template.json` - Generated translation template (labels only) that is uploaded to Crowdin.
- `l/<language>/navigation.json` - Locale-specific label files pulled from Crowdin.
- `docs.json` - Generated Mintlify configuration (always run `yarn docs:generate` after modifying navigation files).
- `package.json` - Package dependencies and scripts (`docs:generate`, `docs:generate-navigation-template`, …).
- `project.json` - Nx workspace configuration

## 📦 Building

```bash
# Build the documentation
npx nx run consuelo-docs:build
```

## 🔗 Links

- [Consuelo Website](https://consuelohq.com)
- [GitHub Repository](https://github.com/consuelohq/opensaas)
- [Mintlify Documentation](https://mintlify.com/docs)

## 🤝 Contributing

To contribute to the documentation:

1. Fork the repository
2. Make your changes in the `packages/consuelo-docs` directory
3. Test locally with `npx nx run consuelo-docs:dev`
4. Submit a pull request

## 📄 License

This documentation is part of the Consuelo project and is licensed under [AGPL-3.0](../../LICENSE).
