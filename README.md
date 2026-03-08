# Graph-Based Documentation System UI

A minimal, clean UI for managing graph-based documentation and flow systems built with Next.js and TailwindCSS.

## Features

- **Hierarchical Document Management**: Unlimited nesting levels with vertical hierarchy
- **Contextual Relationships**: Horizontal links with conditions for cross-references
- **Clean Minimal UI**: Built with TailwindCSS only, no component libraries
- **Full CRUD Operations**: Create, read, update, delete nodes with real-time updates
- **Bidirectional Navigation**: Vertical tree + horizontal links with reciprocal relationships
- **Condition Management**: Add/remove conditions on nodes and links
- **Right Panel Editing**: Detailed editing interface for selected nodes

## Architecture Overview

The application follows a component-based architecture with custom hooks for state management:

```
app/
├── components/
│   ├── NodeItem.tsx      # Individual node card with edit/delete controls
│   ├── VerticalTree.tsx  # Hierarchical tree display with connectors
│   ├── HorizontalLinks.tsx # Side badges for horizontal navigation
│   ├── TopBar.tsx        # Header with breadcrumb navigation
│   ├── MainCanvas.tsx    # Central area for tree display
│   └── RightPanel.tsx    # Edit panel for selected nodes
├── hooks/
│   └── useNodes.ts       # Custom hook for node state management
├── types/
│   └── index.ts          # TypeScript type definitions
├── layout.tsx            # Root layout with metadata
├── page.tsx              # Main application page
└── items/
    └── [id]/
        └── page.tsx      # Dynamic item detail pages
```

## Core Components

### 1. NodeItem Component
- Individual node card with title, content, and conditions
- Edit/Delete buttons visible on hover
- Horizontal link badges for navigation
- Inline editing mode with save/cancel

### 2. VerticalTree Component
- Displays hierarchical tree structure
- Visual connectors between parent and child nodes
- Handles unlimited nesting levels
- Click-to-select functionality for right panel

### 3. HorizontalLinks Component
- Side badges showing contextual relationships
- Bidirectional links with reciprocal relationships
- Condition tags on links
- Click to navigate to related nodes

### 4. State Management (useNodes Hook)
- Manages all node operations (CRUD)
- Handles parent-child relationships
- Manages bidirectional horizontal links
- Persists state across navigation

## Data Model

```typescript
interface Node {
  id: string;
  title: string;
  content: string;
  parentId: string | null;
  children: string[];
  leftLinks: Link[];
  rightLinks: Link[];
  conditions: string[];
  createdAt: string;
  updatedAt: string;
}

interface Link {
  targetId: string;
  condition: string;
}
```

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

The app will be available at [http://localhost:3000](http://localhost:3000).

### Production Build

Create a production build:

```bash
npm run build
```

Start the production server:

```bash
npm start
```

## Usage Guide

### 1. Adding Nodes
- Click `+` buttons above/below any node to add child nodes
- Click `←` or `→` buttons to add horizontal links
- New nodes appear with inline editing enabled

### 2. Editing Nodes
- Click "Edit" on any node for inline editing
- Select a node to open it in the right panel
- Edit title, content, and conditions in the right panel
- Changes save automatically

### 3. Navigating
- Click horizontal link badges to navigate to related nodes
- Use breadcrumb navigation at the top to move up the hierarchy
- Browser back button works for navigation history

### 4. Managing Conditions
- Add conditions in the right panel for selected nodes
- Conditions appear as tags on nodes and links
- Remove conditions by clicking the × button

### 5. Deleting Nodes
- Click "Delete" on any node
- Nodes are removed from hierarchy and all links
- Parent nodes automatically update their children list

## Key Implementation Details

### Unique ID Generation
```typescript
// Uses timestamp + random string to ensure uniqueness
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
```

### Bidirectional Horizontal Links
When adding a right link from Node A to Node B:
1. Adds right link in Node A's `rightLinks` array
2. Adds reciprocal left link in Node B's `leftLinks` array
3. Both links share the same condition

### Delete with Cleanup
1. Removes node from parent's children array
2. Removes reciprocal horizontal links from connected nodes
3. Navigates to parent if current node was deleted
4. Updates all related state atomically

## Styling Principles

- **Minimalist Design**: White background, gray-100 separators, subtle shadows
- **Clean Typography**: System fonts with proper hierarchy and spacing
- **Responsive Layout**: Max width `max-w-3xl` for optimal readability
- **Subtle Interactions**: Hover states, smooth transitions, clear focus states
- **Consistent Spacing**: Tailwind spacing scale used throughout

## Performance Considerations

1. **Lazy Loading**: Children loaded on demand for deep hierarchies
2. **Simple DOM**: Minimal nested elements, efficient rendering
3. **Optimized State Updates**: Batched updates with React state
4. **No Heavy Libraries**: Pure TailwindCSS, no canvas or chart libraries
5. **Efficient Navigation**: Client-side routing with Next.js App Router

## Tech Stack Details

- **Next.js 16.1.6**: React framework with App Router
- **React 19.2.3**: Latest React version with concurrent features
- **TailwindCSS 3.4.0**: Utility-first CSS framework
- **TypeScript**: Full type safety throughout the codebase
- **Custom Hooks**: No external state libraries (Redux/Zustand)

## Testing Results

✅ **All CRUD operations** working correctly  
✅ **Navigation** (vertical, horizontal, breadcrumb) functional  
✅ **Right panel editing** with real-time updates  
✅ **Condition management** add/remove working  
✅ **Delete functionality** with proper cleanup  
✅ **Bidirectional horizontal links** properly synchronized  
✅ **Inline editing** with save/cancel functionality  
✅ **Breadcrumb navigation** showing correct hierarchy  

## Future Enhancements

1. **API Integration**: Connect to backend GraphQL/REST API
2. **Collaboration**: Real-time updates with WebSockets
3. **Export/Import**: JSON export/import functionality
4. **Search**: Full-text search across nodes
5. **Themes**: Dark mode support
6. **Offline Support**: Local storage persistence
7. **Drag & Drop**: Reorder nodes visually
8. **Export Formats**: Markdown, PDF, or image export

## License

MIT
