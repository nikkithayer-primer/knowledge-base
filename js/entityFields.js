// Entity field definitions for different entity types
export const entityFields = {
    events: [
        // Basic Event Information
        { name: 'actor', type: 'text', required: true, placeholder: 'LeBron James', group: 'basic' },
        { name: 'action', type: 'text', required: true, placeholder: 'scored', group: 'basic' },
        { name: 'target', type: 'text', placeholder: '30 points', group: 'basic' },
        { name: 'sentence', type: 'textarea', required: true, placeholder: 'Full sentence describing the event', group: 'basic' },
        
        // Date and Time Information
        { name: 'dateReceived', type: 'datetime-local', required: true, placeholder: 'Publication date', group: 'temporal' },
        { name: 'originalDatetime', type: 'text', required: true, placeholder: 'Tuesday night', group: 'temporal' },
        { name: 'resolvedDatetime', type: 'datetime-local', placeholder: 'Resolved datetime', group: 'temporal' },
        
        // Location Information
        { name: 'locations', type: 'array', placeholder: 'Los Angeles, San Francisco', group: 'location' },
        
        // Entity References
        { name: 'actorEntityId', type: 'text', placeholder: 'Entity ID for actor', group: 'references' },
        { name: 'actorEntityType', type: 'text', placeholder: 'Entity type for actor', group: 'references' },
        { name: 'targetEntityId', type: 'text', placeholder: 'Entity ID for target', group: 'references' },
        { name: 'targetEntityType', type: 'text', placeholder: 'Entity type for target', group: 'references' },
        { name: 'locationEntityIds', type: 'array', placeholder: 'Entity IDs for locations', group: 'references' },
        { name: 'locationEntityTypes', type: 'array', placeholder: 'Entity types for locations', group: 'references' },
        
        // Metadata
        { name: 'source', type: 'text', placeholder: 'Source of the event', group: 'metadata' },
        { name: 'confidence', type: 'select', options: ['high', 'medium', 'low'], group: 'metadata' }
    ],
    connections: [
        // Connection Information
        { name: 'fromEntityId', type: 'text', required: true, placeholder: 'Source entity ID', group: 'basic' },
        { name: 'fromEntityType', type: 'select', required: true, options: ['people', 'places', 'organizations'], group: 'basic' },
        { name: 'toEntityId', type: 'text', required: true, placeholder: 'Target entity ID', group: 'basic' },
        { name: 'toEntityType', type: 'select', required: true, options: ['people', 'places', 'organizations'], group: 'basic' },
        { name: 'relationshipType', type: 'text', required: true, placeholder: 'teacher_of', group: 'basic' },
        { name: 'relationshipLabel', type: 'text', required: true, placeholder: 'teacher of', group: 'basic' },
        { name: 'reverseRelationshipType', type: 'text', placeholder: 'student_of', group: 'basic' },
        { name: 'reverseRelationshipLabel', type: 'text', placeholder: 'student of', group: 'basic' },
        
        // Metadata
        { name: 'source', type: 'text', placeholder: 'Source of the connection', group: 'metadata' },
        { name: 'confidence', type: 'select', options: ['high', 'medium', 'low'], group: 'metadata' },
        { name: 'eventId', type: 'text', placeholder: 'Related event ID', group: 'metadata' }
    ],
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
        { name: 'category', type: 'select', options: ['city', 'university', 'building', 'region', 'country', 'state', 'island'], group: 'classification' },
        
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
        { name: 'name', type: 'text', required: true, placeholder: 'Golden State Warriors', group: 'basic' },
        { name: 'aliases', type: 'array', placeholder: 'Warriors, GSW, Dubs', group: 'basic' },
        { name: 'description', type: 'textarea', required: true, placeholder: 'Brief description of the organization or team', group: 'basic' },
        
        // Classification
        { name: 'category', type: 'select', options: ['company', 'research', 'university', 'non-profit', 'government', 'sports team'], group: 'classification' },
        { name: 'industry', type: 'text', placeholder: 'Technology', group: 'classification' },
        
        // Organization Details
        { name: 'founded', type: 'number', placeholder: '2010', group: 'details' },
        { name: 'location', type: 'text', placeholder: 'San Francisco, CA', group: 'details' },
        { name: 'employees', type: 'number', placeholder: '5000', group: 'details' },
        
        // Sports-specific fields (conditional based on category)
        { name: 'sport', type: 'text', placeholder: 'Basketball', group: 'sports' },
        { name: 'league', type: 'text', placeholder: 'NBA', group: 'sports' },
        { name: 'stadium', type: 'text', placeholder: 'Chase Center', group: 'sports' },
        { name: 'coach', type: 'text', placeholder: 'Steve Kerr', group: 'sports' },
        { name: 'conference', type: 'text', placeholder: 'Western Conference', group: 'sports' },
        { name: 'division', type: 'text', placeholder: 'Pacific Division', group: 'sports' }
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
