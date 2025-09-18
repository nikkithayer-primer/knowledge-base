// Data processing and validation functionality
import { entityFields } from './entityFields.js';
import { formatFieldName } from './entityFields.js';

// Process form data into structured object
export function processFormData(formData, entityType) {
    const data = {};
    const fields = entityFields[entityType];
    
    fields.forEach(field => {
        if (field.type === 'array') {
            // Collect all values for array fields
            const values = formData.getAll(field.name)
                .filter(value => value.trim() !== '')
                .map(value => value.trim());
            data[field.name] = values;
        } else if (field.name === 'coordinates_lat' || field.name === 'coordinates_lng') {
            // Handle coordinates
            const value = formData.get(field.name);
            if (value) {
                if (!data.coordinates) data.coordinates = {};
                const coordKey = field.name === 'coordinates_lat' ? 'lat' : 'lng';
                data.coordinates[coordKey] = parseFloat(value);
            }
        } else {
            const value = formData.get(field.name);
            if (value) {
                if (field.type === 'number') {
                    data[field.name] = parseInt(value);
                } else {
                    data[field.name] = value.trim();
                }
            }
        }
    });
    
    // Auto-generate ID based on wikidata_id or create a fallback
    data.id = generateEntityId(data, entityType);
    
    return data;
}

// Generate entity ID based on wikidata_id or create a fallback
function generateEntityId(data, entityType) {
    // If wikidata_id exists, use it to generate the ID
    if (data.wikidata_id && data.wikidata_id.trim()) {
        return `wikidata_${data.wikidata_id.trim()}`;
    }
    
    // Fallback: generate ID based on entity type and name
    const entityTypeSingular = entityType.slice(0, -1); // Remove 's' from plural
    const baseName = data.name ? data.name.toLowerCase().replace(/[^a-z0-9]/g, '_') : 'unnamed';
    const timestamp = Date.now();
    
    return `${entityTypeSingular}_${baseName}_${timestamp}`;
}

// Validate data based on entity type requirements
export function validateData(data, entityType) {
    const fields = entityFields[entityType];
    const requiredFields = fields.filter(field => field.required);
    
    for (const field of requiredFields) {
        if (!data[field.name] || data[field.name] === '') {
            return {
                isValid: false,
                error: `Please fill in the required field: ${formatFieldName(field.name)}`
            };
        }
    }
    
    return { isValid: true };
}

// Escape HTML to prevent XSS
export function escapeHtml(text) {
    if (typeof text !== 'string') return text;
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}
