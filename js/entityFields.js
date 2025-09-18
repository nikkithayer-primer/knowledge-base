// Entity field definitions for different entity types
export const entityFields = {
    people: [
        { name: 'name', type: 'text', required: true, placeholder: 'John Smith' },
        { name: 'aliases', type: 'array', placeholder: 'J. Smith, Johnny Smith' },
        { name: 'occupation', type: 'text', placeholder: 'Software Engineer' },
        { name: 'jobTitle', type: 'text', placeholder: 'Senior Software Engineer' },
        { name: 'currentEmployer', type: 'text', placeholder: 'Tech Corp' },
        { name: 'previousEmployers', type: 'array', placeholder: 'StartupXYZ, Microsoft' },
        { name: 'educatedAt', type: 'array', placeholder: 'MIT, Stanford University' },
        { name: 'currentResidence', type: 'text', placeholder: 'San Francisco, CA' },
        { name: 'previousResidences', type: 'array', placeholder: 'Boston, MA, Seattle, WA' },
        { name: 'dateOfBirth', type: 'date', placeholder: '1985-03-15' },
        { name: 'gender', type: 'select', options: ['male', 'female', 'other', 'prefer not to say'] },
        { name: 'expertise', type: 'array', placeholder: 'JavaScript, Machine Learning' },
        { name: 'wikidata_id', type: 'text', placeholder: 'Q123456 (optional)' },
        { name: 'description', type: 'textarea', required: true, placeholder: 'Brief description of the person' }
    ],
    places: [
        { name: 'name', type: 'text', required: true, placeholder: 'San Francisco' },
        { name: 'aliases', type: 'array', placeholder: 'SF, San Fran, The City' },
        { name: 'category', type: 'select', options: ['city', 'university', 'building', 'region', 'country'] },
        { name: 'country', type: 'text', placeholder: 'United States' },
        { name: 'state', type: 'text', placeholder: 'California' },
        { name: 'population', type: 'number', placeholder: '873965' },
        { name: 'founded', type: 'number', placeholder: '1776' },
        { name: 'coordinates_lat', type: 'number', placeholder: '37.7749', step: 'any' },
        { name: 'coordinates_lng', type: 'number', placeholder: '-122.4194', step: 'any' },
        { name: 'wikidata_id', type: 'text', placeholder: 'Q62 (optional)' },
        { name: 'description', type: 'textarea', required: true, placeholder: 'Brief description of the place' }
    ],
    organizations: [
        { name: 'name', type: 'text', required: true, placeholder: 'Tech Corp' },
        { name: 'aliases', type: 'array', placeholder: 'TechCorp, TC' },
        { name: 'category', type: 'select', options: ['company', 'research', 'university', 'non-profit', 'government'] },
        { name: 'industry', type: 'text', placeholder: 'Technology' },
        { name: 'founded', type: 'number', placeholder: '2010' },
        { name: 'location', type: 'text', placeholder: 'San Francisco, CA' },
        { name: 'employees', type: 'number', placeholder: '5000' },
        { name: 'wikidata_id', type: 'text', placeholder: 'Q123456 (optional)' },
        { name: 'description', type: 'textarea', required: true, placeholder: 'Brief description of the organization' }
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
