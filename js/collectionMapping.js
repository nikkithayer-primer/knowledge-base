// Firebase collection name mapping utilities
// This ensures consistent collection names across the entire application

// Map entity types to Firebase collection names
export const COLLECTION_MAPPING = {
    'people': 'persons',           // UI: people -> Firebase: persons
    'places': 'places',            // UI: places -> Firebase: places
    'organizations': 'organizations', // UI: organizations -> Firebase: organizations
    'events': 'events',            // UI: events -> Firebase: events
    'connections': 'connections'   // UI: connections -> Firebase: connections
};

// Map Firebase collection names back to entity types
export const REVERSE_COLLECTION_MAPPING = {
    'persons': 'people',
    'places': 'places', 
    'organizations': 'organizations',
    'events': 'events',
    'connections': 'connections'
};

// Get Firebase collection name from entity type
export function getFirebaseCollectionName(entityType) {
    return COLLECTION_MAPPING[entityType] || entityType;
}

// Get entity type from Firebase collection name
export function getEntityTypeFromCollection(collectionName) {
    return REVERSE_COLLECTION_MAPPING[collectionName] || collectionName;
}

// Get all Firebase collection names
export function getAllFirebaseCollections() {
    return Object.values(COLLECTION_MAPPING);
}

// Get all entity types
export function getAllEntityTypes() {
    return Object.keys(COLLECTION_MAPPING);
}

// Validate that an entity type is supported
export function isValidEntityType(entityType) {
    return entityType in COLLECTION_MAPPING;
}

// Validate that a collection name is supported
export function isValidCollectionName(collectionName) {
    return collectionName in REVERSE_COLLECTION_MAPPING;
}
