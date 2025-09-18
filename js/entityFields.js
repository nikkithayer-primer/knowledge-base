// Entity field definitions for different entity types
export const entityFields = {
    people: [
        // Basic Information
        { name: 'wikidata_id', type: 'text', placeholder: 'Q123456 (optional)', group: 'basic' },
        { name: 'name', type: 'text', required: true, placeholder: 'John Smith', group: 'basic' },
        { name: 'aliases', type: 'array', placeholder: 'J. Smith, Johnny Smith', group: 'basic' },
        { name: 'description', type: 'textarea', required: true, placeholder: 'Brief description of the person', group: 'basic' },
        
        // Personal Information
        { name: 'dateOfBirth', type: 'date', placeholder: '1985-03-15', group: 'personal' },
        { name: 'gender', type: 'select', options: ['male', 'female', 'other', 'prefer not to say'], group: 'personal' },
        
        // Professional Information
        { name: 'occupation', type: 'text', placeholder: 'Software Engineer', group: 'professional' },
        { name: 'jobTitle', type: 'text', placeholder: 'Senior Software Engineer', group: 'professional' },
        { name: 'currentEmployer', type: 'text', placeholder: 'Tech Corp', group: 'professional' },
        { name: 'previousEmployers', type: 'array', placeholder: 'StartupXYZ, Microsoft', group: 'professional' },
        { name: 'expertise', type: 'array', placeholder: 'JavaScript, Machine Learning', group: 'professional' },
        
        // Education
        { name: 'educatedAt', type: 'array', placeholder: 'MIT, Stanford University', group: 'education' },
        
        // Location Information
        { name: 'currentResidence', type: 'text', placeholder: 'San Francisco, CA', group: 'location' },
        { name: 'previousResidences', type: 'array', placeholder: 'Boston, MA, Seattle, WA', group: 'location' },
        
        // Legacy fields (for backward compatibility)
        { name: 'location', type: 'text', placeholder: 'San Francisco, CA (legacy)', group: 'legacy' },
        { name: 'organization', type: 'text', placeholder: 'Tech Corp (legacy)', group: 'legacy' }
    ],
    places: [
        // Basic Information
        { name: 'wikidata_id', type: 'text', placeholder: 'Q62 (optional)', group: 'basic' },
        { name: 'name', type: 'text', required: true, placeholder: 'San Francisco', group: 'basic' },
        { name: 'aliases', type: 'array', placeholder: 'SF, San Fran, The City', group: 'basic' },
        { name: 'description', type: 'textarea', required: true, placeholder: 'Brief description of the place', group: 'basic' },
        
        // Classification
        { name: 'category', type: 'select', options: ['city', 'university', 'building', 'region', 'country', 'state'], group: 'classification' },
        
        // Geographic Information
        { name: 'country', type: 'text', placeholder: 'United States', group: 'geographic' },
        { name: 'state', type: 'text', placeholder: 'California', group: 'geographic' },
        { name: 'coordinates_lat', type: 'number', placeholder: '37.7749', step: 'any', group: 'geographic' },
        { name: 'coordinates_lng', type: 'number', placeholder: '-122.4194', step: 'any', group: 'geographic' },
        
        // Demographics & History
        { name: 'population', type: 'number', placeholder: '873965', group: 'demographics' },
        { name: 'founded', type: 'number', placeholder: '1776', group: 'demographics' }
    ],
    organizations: [
        // Basic Information
        { name: 'wikidata_id', type: 'text', placeholder: 'Q123456 (optional)', group: 'basic' },
        { name: 'name', type: 'text', required: true, placeholder: 'Tech Corp', group: 'basic' },
        { name: 'aliases', type: 'array', placeholder: 'TechCorp, TC', group: 'basic' },
        { name: 'description', type: 'textarea', required: true, placeholder: 'Brief description of the organization', group: 'basic' },
        
        // Classification
        { name: 'category', type: 'select', options: ['company', 'research', 'university', 'non-profit', 'government'], group: 'classification' },
        { name: 'industry', type: 'text', placeholder: 'Technology', group: 'classification' },
        
        // Organization Details
        { name: 'founded', type: 'number', placeholder: '2010', group: 'details' },
        { name: 'location', type: 'text', placeholder: 'San Francisco, CA', group: 'details' },
        { name: 'employees', type: 'number', placeholder: '5000', group: 'details' }
    ]
};

// Utility function to format field names for display
export function formatFieldName(name) {
    return name
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())
        .replace('_', ' ')
        .replace('Coordinates Lat', 'Latitude')
        .replace('Coordinates Lng', 'Longitude');
}
