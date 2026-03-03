# Ultra Minimal Next.js App

A clean, minimal Next.js starting point with TypeScript and no unnecessary dependencies.

## Features

- **Ultra minimal**: Only essential dependencies (Next.js, React, TypeScript)
- **No CSS frameworks**: Uses inline styles for simplicity
- **TypeScript ready**: Full TypeScript support out of the box
- **Clean structure**: Simple layout and page components
- **Production ready**: Can be built and deployed

## Getting Started

### Installation

```bash
npm install
```

### Development

Start the development server:

```bash
npm run dev
```

The app will be available at [http://localhost:43263](http://localhost:43263).

### Production Build

Create a production build:

```bash
npm run build
```

Start the production server:

```bash
npm run start
```

## Project Structure

```
/
├── app/
│   ├── layout.tsx    # Root layout with basic styling
│   └── page.tsx      # Home page with minimal UI
├── package.json      # Minimal dependencies
├── next.config.ts    # Next.js configuration
├── tsconfig.json     # TypeScript configuration
└── README.md         # This file
```

## Customization

1. **Add pages**: Create new files in the `app/` directory
2. **Add styling**: Use inline styles or add a CSS framework
3. **Add dependencies**: Install additional packages as needed

## Why Ultra Minimal?

This starter is designed for:
- Learning Next.js fundamentals
- Quick prototyping
- Projects where minimal dependencies are preferred
- Understanding the core Next.js features without framework overhead

## License

MIT
