// Event and Connection Management functionality
import { saveEntityToFirebase, loadEntitiesFromFirebase, deleteEntityFromFirebase } from './firebaseOperations.js';
import { getFirebaseCollectionName } from './collectionMapping.js';

// Global events and connections state
let eventsData = [];
let connectionsData = [];

// Date/time processing for relative dates
export function processRelativeDateTime(originalDatetime, publicationDate) {
    if (!originalDatetime || !publicationDate) {
        return null;
    }
    
    const pubDate = new Date(publicationDate);
    const originalLower = originalDatetime.toLowerCase().trim();
    
    // Handle common relative date patterns
    const patterns = {
        'today': 0,
        'yesterday': -1,
        'tomorrow': 1,
        'day before yesterday': -2,
        'day after tomorrow': 2,
        'last night': -1,
        'tonight': 0,
        'this morning': 0,
        'this afternoon': 0,
        'this evening': 0,
        'last week': -7,
        'next week': 7,
        'last month': -30,
        'next month': 30
    };
    
    // Check for exact matches first
    if (patterns.hasOwnProperty(originalLower)) {
        const dayOffset = patterns[originalLower];
        const resolvedDate = new Date(pubDate);
        resolvedDate.setDate(resolvedDate.getDate() + dayOffset);
        return resolvedDate.toISOString();
    }
    
    // Handle day of week patterns (e.g., "Tuesday night", "last Friday")
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayRegex = new RegExp(`(last\\s+)?(${dayNames.join('|')})(\\s+(morning|afternoon|evening|night))?`, 'i');
    const dayMatch = originalLower.match(dayRegex);
    
    if (dayMatch) {
        const isLast = !!dayMatch[1];
        const dayName = dayMatch[2];
        const timeOfDay = dayMatch[4];
        
        const targetDayIndex = dayNames.indexOf(dayName);
        const currentDayIndex = pubDate.getDay();
        
        let dayDifference = targetDayIndex - currentDayIndex;
        
        if (isLast) {
            // "last Tuesday" means the most recent Tuesday before today
            if (dayDifference >= 0) {
                dayDifference -= 7;
            }
        } else {
            // "Tuesday" could mean this week's Tuesday or last week's Tuesday
            // If the day has already passed this week, assume it's next week
            if (dayDifference < 0) {
                dayDifference += 7;
            }
        }
        
        const resolvedDate = new Date(pubDate);
        resolvedDate.setDate(resolvedDate.getDate() + dayDifference);
        
        // Set approximate time based on time of day
        if (timeOfDay) {
            const timeMap = {
                'morning': { hour: 9, minute: 0 },
                'afternoon': { hour: 15, minute: 0 },
                'evening': { hour: 19, minute: 0 },
                'night': { hour: 21, minute: 0 }
            };
            
            const time = timeMap[timeOfDay];
            if (time) {
                resolvedDate.setHours(time.hour, time.minute, 0, 0);
            }
        }
        
        return resolvedDate.toISOString();
    }
    
    // Try to parse as a regular date
    try {
        const parsed = new Date(originalDatetime);
        if (!isNaN(parsed.getTime())) {
            return parsed.toISOString();
        }
    } catch (e) {
        // Ignore parsing errors
    }
    
    // If no pattern matches, return null
    return null;
}

// Save event to Firebase
export async function saveEventToFirebase(eventData) {
    try {
        // Process the datetime if needed
        if (eventData.originalDatetime && eventData.dateReceived && !eventData.resolvedDatetime) {
            eventData.resolvedDatetime = processRelativeDateTime(eventData.originalDatetime, eventData.dateReceived);
        }
        
        // Generate event ID
        eventData.id = `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const collectionName = getFirebaseCollectionName('events');
        const docRef = await saveEntityToFirebase(eventData, collectionName);
        
        console.log('✅ Event saved successfully:', eventData.id);
        return docRef;
    } catch (error) {
        console.error('❌ Error saving event:', error);
        throw error;
    }
}

// Load events from Firebase
export async function loadEventsFromFirebase(limitCount = 100) {
    try {
        const collectionName = getFirebaseCollectionName('events');
        eventsData = await loadEntitiesFromFirebase(collectionName, limitCount);
        
        console.log(`📥 Loaded ${eventsData.length} events`);
        return eventsData;
    } catch (error) {
        console.error('❌ Error loading events:', error);
        throw error;
    }
}

// Save connection to Firebase
export async function saveConnectionToFirebase(connectionData) {
    try {
        // Generate connection ID
        connectionData.id = `connection_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const collectionName = getFirebaseCollectionName('connections');
        const docRef = await saveEntityToFirebase(connectionData, collectionName);
        
        console.log('✅ Connection saved successfully:', connectionData.id);
        return docRef;
    } catch (error) {
        console.error('❌ Error saving connection:', error);
        throw error;
    }
}

// Load connections from Firebase
export async function loadConnectionsFromFirebase(limitCount = 100) {
    try {
        const collectionName = getFirebaseCollectionName('connections');
        connectionsData = await loadEntitiesFromFirebase(collectionName, limitCount);
        
        console.log(`📥 Loaded ${connectionsData.length} connections`);
        return connectionsData;
    } catch (error) {
        console.error('❌ Error loading connections:', error);
        throw error;
    }
}

// Get connections for a specific entity
export function getEntityConnections(entityId, entityType, knowledgeBaseData = null) {
    // Use provided knowledge base data if available, otherwise fall back to local data
    const connectionsToSearch = knowledgeBaseData?.connections || connectionsData;
    
    return connectionsToSearch.filter(connection => 
        (connection.fromEntityId === entityId && connection.fromEntityType === entityType) ||
        (connection.toEntityId === entityId && connection.toEntityType === entityType)
    );
}

// Process CSV row as event
export function processCSVRowAsEvent(csvRow) {
    const event = {
        actor: csvRow.Actor || '',
        action: csvRow.Action || '',
        target: csvRow.Target || '',
        sentence: csvRow.Sentence || '',
        dateReceived: csvRow['Date Received'] || '',
        originalDatetime: csvRow.Datetimes || '',
        locations: csvRow.Locations ? csvRow.Locations.split(',').map(l => l.trim()) : [],
        source: 'CSV Import',
        confidence: 'medium'
    };
    
    // Process the datetime
    if (event.originalDatetime && event.dateReceived) {
        event.resolvedDatetime = processRelativeDateTime(event.originalDatetime, event.dateReceived);
    }
    
    return event;
}

// Infer connections from event data
export function inferConnectionsFromEvent(event, knowledgeBaseData) {
    const connections = [];
    
    if (!event.actor || !event.action) {
        return connections;
    }
    
    // Find entities in knowledge base
    const findEntity = (name, type) => {
        const entities = knowledgeBaseData[type] || [];
        return entities.find(entity => 
            entity.name.toLowerCase() === name.toLowerCase() ||
            (entity.aliases && entity.aliases.some(alias => alias.toLowerCase() === name.toLowerCase()))
        );
    };
    
    const actorEntity = findEntity(event.actor, 'people') || 
                       findEntity(event.actor, 'organizations') ||
                       findEntity(event.actor, 'places');
    
    const targetEntity = event.target ? (
        findEntity(event.target, 'people') || 
        findEntity(event.target, 'organizations') ||
        findEntity(event.target, 'places')
    ) : null;
    
    // Infer relationship based on action
    const relationshipMappings = {
        'taught': { type: 'teacher_of', label: 'teacher of', reverse: 'student_of', reverseLabel: 'student of' },
        'hired': { type: 'employer_of', label: 'employer of', reverse: 'employee_of', reverseLabel: 'employee of' },
        'visited': { type: 'visitor_of', label: 'visited', reverse: 'visited_by', reverseLabel: 'visited by' },
        'scored': { type: 'scored_against', label: 'scored against', reverse: 'scored_on_by', reverseLabel: 'scored on by' },
        'played': { type: 'played_for', label: 'played for', reverse: 'had_player', reverseLabel: 'had player' },
        'coached': { type: 'coach_of', label: 'coach of', reverse: 'coached_by', reverseLabel: 'coached by' }
    };
    
    const relationship = relationshipMappings[event.action.toLowerCase()];
    
    if (actorEntity && targetEntity && relationship) {
        const connection = {
            fromEntityId: actorEntity.id,
            fromEntityType: getEntityTypeFromEntity(actorEntity),
            toEntityId: targetEntity.id,
            toEntityType: getEntityTypeFromEntity(targetEntity),
            relationshipType: relationship.type,
            relationshipLabel: relationship.label,
            reverseRelationshipType: relationship.reverse,
            reverseRelationshipLabel: relationship.reverseLabel,
            source: 'Event Inference',
            confidence: 'medium',
            eventId: event.id
        };
        
        connections.push(connection);
    }
    
    return connections;
}

// Helper function to determine entity type from entity data
function getEntityTypeFromEntity(entity) {
    if (entity.type) {
        return entity.type + 's'; // Convert singular to plural
    }
    
    // Fallback: try to infer from entity structure
    if (entity.occupation || entity.dateOfBirth) return 'people';
    if (entity.category === 'city' || entity.coordinates) return 'places';
    if (entity.industry || entity.founded) return 'organizations';
    
    return 'people'; // Default fallback
}

// Batch process CSV data as events
export async function batchProcessCSVAsEvents(csvData) {
    const events = [];
    const connections = [];
    
    for (const row of csvData.data) {
        try {
            // Process as event
            const event = processCSVRowAsEvent(row);
            events.push(event);
            
            // Infer connections (you would pass in the current knowledge base data)
            // const eventConnections = inferConnectionsFromEvent(event, knowledgeBaseData);
            // connections.push(...eventConnections);
            
        } catch (error) {
            console.error('Error processing CSV row as event:', error, row);
        }
    }
    
    return { events, connections };
}

// Get available relationship types for connection UI
export function getAvailableRelationships(fromEntityType, toEntityType) {
    const relationships = [];
    
    // Person to Person relationships
    if (fromEntityType === 'people' && toEntityType === 'people') {
        relationships.push(
            { type: 'teacher_of', label: 'teacher of' },
            { type: 'student_of', label: 'student of' },
            { type: 'colleague_of', label: 'colleague of' },
            { type: 'friend_of', label: 'friend of' },
            { type: 'spouse_of', label: 'spouse of' },
            { type: 'parent_of', label: 'parent of' },
            { type: 'child_of', label: 'child of' },
            { type: 'sibling_of', label: 'sibling of' }
        );
    }
    
    // Person to Organization relationships
    if (fromEntityType === 'people' && toEntityType === 'organizations') {
        relationships.push(
            { type: 'employee_of', label: 'employee of' },
            { type: 'ceo_of', label: 'CEO of' },
            { type: 'founder_of', label: 'founder of' },
            { type: 'member_of', label: 'member of' },
            { type: 'player_for', label: 'player for' },
            { type: 'coach_of', label: 'coach of' }
        );
    }
    
    // Organization to Person relationships
    if (fromEntityType === 'organizations' && toEntityType === 'people') {
        relationships.push(
            { type: 'employer_of', label: 'employer of' },
            { type: 'founded_by', label: 'founded by' },
            { type: 'has_member', label: 'has member' },
            { type: 'has_player', label: 'has player' },
            { type: 'coached_by', label: 'coached by' }
        );
    }
    
    // Person to Place relationships
    if (fromEntityType === 'people' && toEntityType === 'places') {
        relationships.push(
            { type: 'lives_in', label: 'lives in' },
            { type: 'born_in', label: 'born in' },
            { type: 'works_in', label: 'works in' },
            { type: 'studied_at', label: 'studied at' },
            { type: 'visited', label: 'visited' }
        );
    }
    
    // Place to Person relationships
    if (fromEntityType === 'places' && toEntityType === 'people') {
        relationships.push(
            { type: 'home_to', label: 'home to' },
            { type: 'birthplace_of', label: 'birthplace of' },
            { type: 'workplace_of', label: 'workplace of' },
            { type: 'alma_mater_of', label: 'alma mater of' },
            { type: 'visited_by', label: 'visited by' }
        );
    }
    
    // Organization to Place relationships
    if (fromEntityType === 'organizations' && toEntityType === 'places') {
        relationships.push(
            { type: 'located_in', label: 'located in' },
            { type: 'headquartered_in', label: 'headquartered in' },
            { type: 'operates_in', label: 'operates in' }
        );
    }
    
    // Place to Organization relationships
    if (fromEntityType === 'places' && toEntityType === 'organizations') {
        relationships.push(
            { type: 'hosts', label: 'hosts' },
            { type: 'headquarters_of', label: 'headquarters of' },
            { type: 'home_to', label: 'home to' }
        );
    }
    
    return relationships;
}

// Export state getters
export function getEventsData() {
    return eventsData;
}

export function getConnectionsData() {
    return connectionsData;
}
