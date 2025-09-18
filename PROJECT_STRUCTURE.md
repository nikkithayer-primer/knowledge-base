# Project Structure

## 📁 File Organization

### **CSS Architecture** (`/css/`)
- **`variables.css`** - CSS custom properties for colors, spacing, typography
- **`base.css`** - Base styles, resets, and typography
- **`forms.css`** - Form input styles and layouts
- **`buttons.css`** - Button styles and variants
- **`components.css`** - Status messages, data display, responsive design
- **`main.css`** - Main import file that combines all CSS modules

### **JavaScript Architecture** (`/js/`)
- **`config.js`** - Firebase configuration and initialization
- **`entityFields.js`** - Entity field definitions and formatting utilities
- **`formBuilder.js`** - Dynamic form generation based on entity types
- **`dataProcessor.js`** - Data processing, validation, and sanitization
- **`firebaseOperations.js`** - Firebase database operations (save/load)
- **`ui.js`** - UI management, status messages, and display functions
- **`main.js`** - Main application entry point and event handlers

### **Root Files**
- **`index.html`** - Main HTML structure
- **`knowledgeBaseData.js`** - Sample data structure reference
- **`firebase-setup.md`** - Firebase configuration guide

## 🎨 CSS Variables

All colors are now managed through CSS custom properties:

```css
/* Primary Colors */
--primary-gradient-start: #667eea
--primary-gradient-end: #764ba2
--primary-color: #667eea

/* Neutral Grays */
--gray-50 through --gray-900

/* Status Colors */
--success-bg, --success-text, --success-border
--error-bg, --error-text, --error-border

/* Spacing System */
--space-1 (4px) through --space-16 (64px)

/* Typography */
--font-family, --font-size-*, --font-weight-*
```

## 🏗️ JavaScript Modules

### **Dependency Flow**
```
main.js (entry point)
├── formBuilder.js
│   └── entityFields.js
├── dataProcessor.js
│   └── entityFields.js
├── firebaseOperations.js
│   └── config.js
└── ui.js
    └── dataProcessor.js (for escapeHtml)
```

### **Key Functions**
- **Form Generation**: Dynamic form creation based on entity type
- **Data Processing**: Form data → structured objects with validation
- **Firebase Operations**: Save/load entities with proper error handling
- **UI Management**: Status messages, loading states, data display

## 🚀 Benefits of Refactoring

### **Maintainability**
- ✅ Single responsibility principle for each module
- ✅ Easy to locate and modify specific functionality
- ✅ Clear separation of concerns

### **Scalability**
- ✅ Easy to add new entity types by updating `entityFields.js`
- ✅ CSS variables make theme changes simple
- ✅ Modular structure supports feature additions

### **Performance**
- ✅ Smaller individual files for better caching
- ✅ Tree-shaking friendly ES6 modules
- ✅ Reduced bundle size for unused code

### **Developer Experience**
- ✅ Better IDE support with smaller files
- ✅ Easier debugging with focused modules
- ✅ Clear import/export relationships

## 🎯 Usage

The app works exactly the same as before, but now with:
- Better organized code
- Consistent color system via CSS variables
- Modular JavaScript architecture
- Improved maintainability and extensibility

Access your app at `http://localhost:8080` or `http://localhost:3000` to see the refactored version in action!
