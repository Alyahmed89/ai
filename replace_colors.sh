#!/bin/bash

# Replace all blue colors with appropriate grey shades
find . -name "*.tsx" -o -name "*.jsx" -o -name "*.css" | grep -v node_modules | while read file; do
    echo "Processing $file"
    
    # Replace text-blue-* with text-gray-*
    sed -i 's/text-blue-50/text-gray-50/g' "$file"
    sed -i 's/text-blue-100/text-gray-100/g' "$file"
    sed -i 's/text-blue-200/text-gray-200/g' "$file"
    sed -i 's/text-blue-300/text-gray-300/g' "$file"
    sed -i 's/text-blue-400/text-gray-400/g' "$file"
    sed -i 's/text-blue-500/text-gray-500/g' "$file"
    sed -i 's/text-blue-600/text-gray-600/g' "$file"
    sed -i 's/text-blue-700/text-gray-700/g' "$file"
    sed -i 's/text-blue-800/text-gray-800/g' "$file"
    sed -i 's/text-blue-900/text-gray-900/g' "$file"
    
    # Replace border-blue-* with border-gray-*
    sed -i 's/border-blue-50/border-gray-50/g' "$file"
    sed -i 's/border-blue-100/border-gray-100/g' "$file"
    sed -i 's/border-blue-200/border-gray-200/g' "$file"
    sed -i 's/border-blue-300/border-gray-300/g' "$file"
    sed -i 's/border-blue-400/border-gray-400/g' "$file"
    sed -i 's/border-blue-500/border-gray-500/g' "$file"
    sed -i 's/border-blue-600/border-gray-600/g' "$file"
    sed -i 's/border-blue-700/border-gray-700/g' "$file"
    sed -i 's/border-blue-800/border-gray-800/g' "$file"
    sed -i 's/border-blue-900/border-gray-900/g' "$file"
    
    # Replace ring-blue-* with ring-gray-*
    sed -i 's/ring-blue-50/ring-gray-50/g' "$file"
    sed -i 's/ring-blue-100/ring-gray-100/g' "$file"
    sed -i 's/ring-blue-200/ring-gray-200/g' "$file"
    sed -i 's/ring-blue-300/ring-gray-300/g' "$file"
    sed -i 's/ring-blue-400/ring-gray-400/g' "$file"
    sed -i 's/ring-blue-500/ring-gray-500/g' "$file"
    sed -i 's/ring-blue-600/ring-gray-600/g' "$file"
    sed -i 's/ring-blue-700/ring-gray-700/g' "$file"
    sed -i 's/ring-blue-800/ring-gray-800/g' "$file"
    sed -i 's/ring-blue-900/ring-gray-900/g' "$file"
    
    # Replace focus:ring-blue-* with focus:ring-gray-*
    sed -i 's/focus:ring-blue-50/focus:ring-gray-50/g' "$file"
    sed -i 's/focus:ring-blue-100/focus:ring-gray-100/g' "$file"
    sed -i 's/focus:ring-blue-200/focus:ring-gray-200/g' "$file"
    sed -i 's/focus:ring-blue-300/focus:ring-gray-300/g' "$file"
    sed -i 's/focus:ring-blue-400/focus:ring-gray-400/g' "$file"
    sed -i 's/focus:ring-blue-500/focus:ring-gray-500/g' "$file"
    sed -i 's/focus:ring-blue-600/focus:ring-gray-600/g' "$file"
    sed -i 's/focus:ring-blue-700/focus:ring-gray-700/g' "$file"
    sed -i 's/focus:ring-blue-800/focus:ring-gray-800/g' "$file"
    sed -i 's/focus:ring-blue-900/focus:ring-gray-900/g' "$file"
    
    # Replace focus:border-blue-* with focus:border-gray-*
    sed -i 's/focus:border-blue-50/focus:border-gray-50/g' "$file"
    sed -i 's/focus:border-blue-100/focus:border-gray-100/g' "$file"
    sed -i 's/focus:border-blue-200/focus:border-gray-200/g' "$file"
    sed -i 's/focus:border-blue-300/focus:border-gray-300/g' "$file"
    sed -i 's/focus:border-blue-400/focus:border-gray-400/g' "$file"
    sed -i 's/focus:border-blue-500/focus:border-gray-500/g' "$file"
    sed -i 's/focus:border-blue-600/focus:border-gray-600/g' "$file"
    sed -i 's/focus:border-blue-700/focus:border-gray-700/g' "$file"
    sed -i 's/focus:border-blue-800/focus:border-gray-800/g' "$file"
    sed -i 's/focus:border-blue-900/focus:border-gray-900/g' "$file"
    
    # Replace from-blue-* with from-gray-*
    sed -i 's/from-blue-50/from-gray-50/g' "$file"
    sed -i 's/from-blue-100/from-gray-100/g' "$file"
    sed -i 's/from-blue-200/from-gray-200/g' "$file"
    sed -i 's/from-blue-300/from-gray-300/g' "$file"
    sed -i 's/from-blue-400/from-gray-400/g' "$file"
    sed -i 's/from-blue-500/from-gray-500/g' "$file"
    sed -i 's/from-blue-600/from-gray-600/g' "$file"
    sed -i 's/from-blue-700/from-gray-700/g' "$file"
    sed -i 's/from-blue-800/from-gray-800/g' "$file"
    sed -i 's/from-blue-900/from-gray-900/g' "$file"
    
    # Replace to-blue-* with to-gray-*
    sed -i 's/to-blue-50/to-gray-50/g' "$file"
    sed -i 's/to-blue-100/to-gray-100/g' "$file"
    sed -i 's/to-blue-200/to-gray-200/g' "$file"
    sed -i 's/to-blue-300/to-gray-300/g' "$file"
    sed -i 's/to-blue-400/to-gray-400/g' "$file"
    sed -i 's/to-blue-500/to-gray-500/g' "$file"
    sed -i 's/to-blue-600/to-gray-600/g' "$file"
    sed -i 's/to-blue-700/to-gray-700/g' "$file"
    sed -i 's/to-blue-800/to-gray-800/g' "$file"
    sed -i 's/to-blue-900/to-gray-900/g' "$file"
    
    # Replace hover:text-blue-* with hover:text-gray-*
    sed -i 's/hover:text-blue-50/hover:text-gray-50/g' "$file"
    sed -i 's/hover:text-blue-100/hover:text-gray-100/g' "$file"
    sed -i 's/hover:text-blue-200/hover:text-gray-200/g' "$file"
    sed -i 's/hover:text-blue-300/hover:text-gray-300/g' "$file"
    sed -i 's/hover:text-blue-400/hover:text-gray-400/g' "$file"
    sed -i 's/hover:text-blue-500/hover:text-gray-500/g' "$file"
    sed -i 's/hover:text-blue-600/hover:text-gray-600/g' "$file"
    sed -i 's/hover:text-blue-700/hover:text-gray-700/g' "$file"
    sed -i 's/hover:text-blue-800/hover:text-gray-800/g' "$file"
    sed -i 's/hover:text-blue-900/hover:text-gray-900/g' "$file"
done

echo "Color replacement complete!"
