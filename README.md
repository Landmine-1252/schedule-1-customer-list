# Schedule 1 - Customer List

**Live Version:** [https://landmine-1252.github.io/schedule-1-customer-list/](https://landmine-1252.github.io/schedule-1-customer-list/)

A web-based tool for analyzing customer preferences across different areas to help you identify optimal combinations of favorites to stock in each location.

## Overview

This tool helps you determine the minimum set of favorites needed to satisfy at least 8 customers per area by analyzing their preferences. It's designed to help you make informed decisions about which products to prioritize in different areas.

## Features

- **Customer Coverage Analysis**: View optimal favorite combinations for each area
- **Filtering System**: Filter customers by Area, Standards, or specific Favorites
- **Search Functionality**: Quickly find specific customers by name
- **Match Mode Toggle**: Switch between "Match all" or "Match any" mode for favorite filters
- **Responsive Design**: Works on both desktop and mobile devices
- **Theme Switching**: Toggle between light and dark themes
- **Visual Tags**: Color-coded favorite tags for easy identification

## How to Use

1. View the "Customer Coverage Analysis" section for optimal favorite combinations
2. Use the filters on the left to narrow down results:
   - Filter by Area to focus on specific locations
   - Filter by Standards to focus on customer quality levels
   - Filter by Favorites to see who prefers specific products
3. Toggle between "Match all" or "Match any" mode for favorite filters
4. Use the search bar to find specific customers by name
5. The analysis will update automatically based on your filter selections

## Setup

This project is a static site intended for GitHub Pages. For local testing, run it with a simple web server so the JSON files load correctly:

### Using Python (Recommended)

1. Open a terminal or command prompt in the project directory
2. Run one of these commands depending on your Python version:

   ```bash
   python -m http.server 8080    # Python 3
   python3 -m http.server 8080   # Alternative for Python 3
   python -m SimpleHTTPServer 8080    # Python 2
   ```

3. Open your browser and navigate to `http://localhost:8080`

### Direct Opening (Not Recommended)

Simply opening `index.html` directly in a browser may not work properly due to browser security restrictions preventing JSON files from loading when using the `file://` protocol.

## Validation

Run the built-in validation script before publishing changes:

```bash
node scripts/validate-project.js
```

It checks the JSON structure, verifies that every favorite has a color, and confirms that `index.html` still references the expected page elements and `app.js`.

## Data Structure

The application uses two JSON files:

- `data.json`: Contains customer information including names, areas, standards, and favorites
- `colors.json`: Maps favorite types to specific colors for visual representation

## Repository

<https://github.com/Landmine-1252/schedule-1-customer-list>
