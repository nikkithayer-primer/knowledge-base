// Entity connection and relationship management
import { saveEntityToFirebase, deleteEntityFromFirebase, loadEntitiesFromFirebase } from './firebaseOperations.js';

// Define relationship types and their reciprocals
export const RELATIONSHIP_TYPES = {
    // People to People relationships
    people: {
        people: [
            { type: 'spouse', reciprocal: 'spouse', label: 'Spouse of' },
            { type: 'parent', reciprocal: 'child', label: 'Parent of' },
            { type: 'child', reciprocal: 'parent', label: 'Child of' },
            { type: 'sibling', reciprocal: 'sibling', label: 'Sibling of' },
            { type: 'colleague', reciprocal: 'colleague', label: 'Colleague of' },
            { type: 'friend', reciprocal: 'friend', label: 'Friend of' },
            { type: 'mentor', reciprocal: 'mentee', label: 'Mentor of' },
            { type: 'mentee', reciprocal: 'mentor', label: 'Mentee of' },
            { type: 'business_partner', reciprocal: 'business_partner', label: 'Business partner of' }
        ],
        places: [
            { type: 'born_in', reciprocal: 'birthplace_of', label: 'Born in' },
            { type: 'lives_in', reciprocal: 'resident', label: 'Lives in' },
            { type: 'works_in', reciprocal: 'workplace_of', label: 'Works in' },
            { type: 'studied_in', reciprocal: 'alma_mater_of', label: 'Studied in' },
            { type: 'visited', reciprocal: 'visited_by', label: 'Visited' }
        ],
        organizations: [
            { type: 'employee_of', reciprocal: 'employs', label: 'Employee of' },
            { type: 'founder_of', reciprocal: 'founded_by', label: 'Founder of' },
            { type: 'ceo_of', reciprocal: 'led_by', label: 'CEO of' },
            { type: 'board_member_of', reciprocal: 'board_includes', label: 'Board member of' },
            { type: 'advisor_to', reciprocal: 'advised_by', label: 'Advisor to' },
            { type: 'member_of', reciprocal: 'member', label: 'Member of' },
            { type: 'investor_in', reciprocal: 'invested_by', label: 'Investor in' }
        ]
    },
    
    // Places to other entity relationships
    places: {
        people: [
            { type: 'birthplace_of', reciprocal: 'born_in', label: 'Birthplace of' },
            { type: 'resident', reciprocal: 'lives_in', label: 'Home to' },
            { type: 'workplace_of', reciprocal: 'works_in', label: 'Workplace of' },
            { type: 'alma_mater_of', reciprocal: 'studied_in', label: 'Alma mater of' },
            { type: 'visited_by', reciprocal: 'visited', label: 'Visited by' }
        ],
        places: [
            { type: 'located_in', reciprocal: 'contains', label: 'Located in' },
            { type: 'contains', reciprocal: 'located_in', label: 'Contains' },
            { type: 'neighbor_of', reciprocal: 'neighbor_of', label: 'Neighbor of' },
            { type: 'capital_of', reciprocal: 'capital', label: 'Capital of' },
            { type: 'capital', reciprocal: 'capital_of', label: 'Capital is' }
        ],
        organizations: [
            { type: 'headquarters_of', reciprocal: 'headquartered_in', label: 'Headquarters of' },
            { type: 'branch_location_of', reciprocal: 'has_branch_in', label: 'Branch location of' },
            { type: 'founded_in', reciprocal: 'founding_location_of', label: 'Founded in' }
        ]
    },
    
    // Organizations to other entity relationships
    organizations: {
        people: [
            { type: 'employs', reciprocal: 'employee_of', label: 'Employs' },
            { type: 'founded_by', reciprocal: 'founder_of', label: 'Founded by' },
            { type: 'led_by', reciprocal: 'ceo_of', label: 'Led by' },
            { type: 'board_includes', reciprocal: 'board_member_of', label: 'Board includes' },
            { type: 'advised_by', reciprocal: 'advisor_to', label: 'Advised by' },
            { type: 'member', reciprocal: 'member_of', label: 'Has member' },
            { type: 'invested_by', reciprocal: 'investor_in', label: 'Invested by' }
        ],
        places: [
            { type: 'headquartered_in', reciprocal: 'headquarters_of', label: 'Headquartered in' },
            { type: 'has_branch_in', reciprocal: 'branch_location_of', label: 'Has branch in' },
            { type: 'founding_location_of', reciprocal: 'founded_in', label: 'Founded in' }
        ],
        organizations: [
            { type: 'parent_company_of', reciprocal: 'subsidiary_of', label: 'Parent company of' },
            { type: 'subsidiary_of', reciprocal: 'parent_company_of', label: 'Subsidiary of' },
            { type: 'partner_with', reciprocal: 'partner_with', label: 'Partner with' },
            { type: 'competitor_of', reciprocal: 'competitor_of', label: 'Competitor of' },
            { type: 'supplier_to', reciprocal: 'supplied_by', label: 'Supplier to' },
            { type: 'supplied_by', reciprocal: 'supplier_to', label: 'Supplied by' },
            { type: 'acquired_by', reciprocal: 'acquired', label: 'Acquired by' },
            { type: 'acquired', reciprocal: 'acquired_by', label: 'Acquired' }
        ]
    }
};

// Get available relationships for entity type to target type
export function getAvailableRelationships(fromEntityType, toEntityType) {
    const fromType = mapEntityType(fromEntityType);
    const toType = mapEntityType(toEntityType);
    
    return RELATIONSHIP_TYPES[fromType]?.[toType] || [];
}

// Map plural entity types to singular for relationship lookup
function mapEntityType(entityType) {
    const mapping = {
        'people': 'people',
        'places': 'places',
        'organizations': 'organizations',
        'person': 'people',
        'place': 'places',
        'organization': 'organizations'
    };
    return mapping[entityType] || entityType;
}

// Get the reciprocal relationship type
export function getReciprocalRelationship(relationshipType, fromEntityType, toEntityType) {
    const relationships = getAvailableRelationships(fromEntityType, toEntityType);
    const relationship = relationships.find(r => r.type === relationshipType);
    return relationship?.reciprocal;
}

// Connection data structure
export class Connection {
    constructor(fromEntityId, fromEntityType, toEntityId, toEntityType, relationshipType, metadata = {}) {
        this.id = generateConnectionId();
        this.fromEntityId = fromEntityId;
        this.fromEntityType = fromEntityType;
        this.toEntityId = toEntityId;
        this.toEntityType = toEntityType;
        this.relationshipType = relationshipType;
        this.metadata = metadata;
        this.createdAt = new Date().toISOString();
        this.updatedAt = new Date().toISOString();
    }
}

// Generate unique connection ID
function generateConnectionId() {
    return 'conn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// In-memory connection storage (will be replaced with Firebase)
let connections = [];

// Add a bidirectional connection
export async function addConnection(fromEntityId, fromEntityType, toEntityId, toEntityType, relationshipType, metadata = {}) {
    try {
        // Create the primary connection
        const primaryConnection = new Connection(fromEntityId, fromEntityType, toEntityId, toEntityType, relationshipType, metadata);
        
        // Get reciprocal relationship type
        const reciprocalType = getReciprocalRelationship(relationshipType, fromEntityType, toEntityType);
        
        // Create reciprocal connection if different from primary
        let reciprocalConnection = null;
        if (reciprocalType && reciprocalType !== relationshipType) {
            reciprocalConnection = new Connection(toEntityId, toEntityType, fromEntityId, fromEntityType, reciprocalType, metadata);
        }
        
        // Save to Firebase (placeholder for now)
        await saveConnectionToFirebase(primaryConnection);
        if (reciprocalConnection) {
            await saveConnectionToFirebase(reciprocalConnection);
        }
        
        // Add to local storage
        connections.push(primaryConnection);
        if (reciprocalConnection) {
            connections.push(reciprocalConnection);
        }
        
        console.log('✅ Connection added:', primaryConnection);
        if (reciprocalConnection) {
            console.log('✅ Reciprocal connection added:', reciprocalConnection);
        }
        
        return { primary: primaryConnection, reciprocal: reciprocalConnection };
        
    } catch (error) {
        console.error('❌ Error adding connection:', error);
        throw error;
    }
}

// Get connections for an entity
export function getEntityConnections(entityId, entityType) {
    return connections.filter(conn => 
        (conn.fromEntityId === entityId && conn.fromEntityType === entityType) ||
        (conn.toEntityId === entityId && conn.toEntityType === entityType)
    );
}

// Delete a connection and its reciprocal
export async function deleteConnection(connectionId) {
    try {
        const connection = connections.find(c => c.id === connectionId);
        if (!connection) {
            throw new Error('Connection not found');
        }
        
        // Find reciprocal connection
        const reciprocal = connections.find(c => 
            c.fromEntityId === connection.toEntityId &&
            c.toEntityId === connection.fromEntityId &&
            c.id !== connectionId
        );
        
        // Delete from Firebase
        await deleteConnectionFromFirebase(connectionId);
        if (reciprocal) {
            await deleteConnectionFromFirebase(reciprocal.id);
        }
        
        // Remove from local storage
        connections = connections.filter(c => c.id !== connectionId);
        if (reciprocal) {
            connections = connections.filter(c => c.id !== reciprocal.id);
        }
        
        console.log('✅ Connection deleted:', connectionId);
        
    } catch (error) {
        console.error('❌ Error deleting connection:', error);
        throw error;
    }
}

// Firebase operations for connections
async function saveConnectionToFirebase(connection) {
    try {
        console.log('💾 Saving connection to Firebase:', connection);
        
        // Save to the 'connections' collection
        const docRef = await saveEntityToFirebase(connection, 'connections');
        console.log('✅ Connection saved to Firebase with ID:', docRef.id);
        
        return docRef;
    } catch (error) {
        console.error('❌ Error saving connection to Firebase:', error);
        throw error;
    }
}

async function deleteConnectionFromFirebase(connectionId) {
    try {
        console.log('🗑️ Deleting connection from Firebase:', connectionId);
        
        await deleteEntityFromFirebase(connectionId, 'connections');
        console.log('✅ Connection deleted from Firebase');
        
    } catch (error) {
        console.error('❌ Error deleting connection from Firebase:', error);
        throw error;
    }
}

// Load connections from Firebase
export async function loadConnectionsFromFirebase() {
    try {
        console.log('📥 Loading connections from Firebase');
        
        const connectionsData = await loadEntitiesFromFirebase('connections');
        connections = connectionsData || [];
        
        console.log(`✅ Loaded ${connections.length} connections from Firebase`);
        return connections;
        
    } catch (error) {
        console.error('❌ Error loading connections from Firebase:', error);
        return [];
    }
}
