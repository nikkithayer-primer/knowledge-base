// 2-Step Approval Process Management
import { getKnowledgeBaseData } from './knowledgeBase.js';
import { saveEntityToFirebase } from './firebaseOperations.js';
import { saveEventToFirebase, saveConnectionToFirebase } from './eventManager.js';
import { escapeHtml } from './dataProcessor.js';

// Global state for the approval process
let approvalState = {
    currentStep: 1,
    csvData: null,
    uniqueEntities: [],
    approvedEntities: [],
    rejectedEntities: [],
    events: [],
    approvedEvents: [],
    proposedConnections: [],
    approvedConnections: []
};

// Initialize the 2-step approval process
function initializeApprovalProcess(csvData) {
    approvalState.csvData = csvData;
    approvalState.currentStep = 1;
    
    // Show the approval process UI
    const csvDataDisplay = document.getElementById('csvDataDisplay');
    const approvalProcess = document.getElementById('approvalProcess');
    
    if (csvDataDisplay) csvDataDisplay.style.display = 'none';
    if (approvalProcess) approvalProcess.style.display = 'block';
    
    // Process events from CSV data (skip entity identification step)
    processEventsFromCSV();
    
    // Initialize step navigation
    setupStepNavigation();
    
    // Start with step 1 (now events)
    showStep(1);
    renderStep1();
}

// Process events from CSV data (replaces entity identification step)
function processEventsFromCSV() {
    approvalState.events = [];
    
    approvalState.csvData.data.forEach((row, index) => {
        if (row.Actor && row.Action && row.Target) {
            approvalState.events.push({
                id: `event_${index}`,
                actor: row.Actor,
                action: row.Action,
                target: row.Target,
                sentence: row.Sentence || '',
                datetime: row.Datetime || '',
                location: row.Location || '',
                source: row.Source || '',
                approved: false
            });
        }
    });
}

// Extract unique entities from CSV data (kept for reference but not used in 2-step process)
function extractUniqueEntities() {
    const entitySet = new Set();
    const entities = [];
    
    approvalState.csvData.data.forEach(row => {
        // Extract Actor
        if (row.Actor && row.Actor.trim()) {
            const actor = row.Actor.trim();
            if (!entitySet.has(actor)) {
                entitySet.add(actor);
                entities.push({
                    name: actor,
                    type: inferEntityType(actor, 'actor'),
                    source: 'CSV Actor',
                    occurrences: 1
                });
            } else {
                const existing = entities.find(e => e.name === actor);
                if (existing) existing.occurrences++;
            }
        }
        
        // Extract Target
        if (row.Target && row.Target.trim()) {
            const target = row.Target.trim();
            if (!entitySet.has(target)) {
                entitySet.add(target);
                entities.push({
                    name: target,
                    type: inferEntityType(target, 'target'),
                    source: 'CSV Target',
                    occurrences: 1
                });
            } else {
                const existing = entities.find(e => e.name === target);
                if (existing) existing.occurrences++;
            }
        }
        
        // Extract Locations
        if (row.Locations && row.Locations.trim()) {
            const locations = row.Locations.split(',').map(loc => loc.trim()).filter(loc => loc);
            locations.forEach(location => {
                if (!entitySet.has(location)) {
                    entitySet.add(location);
                    entities.push({
                        name: location,
                        type: 'place',
                        source: 'CSV Location',
                        occurrences: 1
                    });
                } else {
                    const existing = entities.find(e => e.name === location);
                    if (existing) existing.occurrences++;
                }
            });
        }
    });
    
    approvalState.uniqueEntities = entities;
}

// Simple entity type inference
function inferEntityType(name, context) {
    // Basic heuristics for entity type detection
    const lowerName = name.toLowerCase();
    
    // Common place indicators
    if (lowerName.includes('city') || lowerName.includes('town') || 
        lowerName.includes('county') || lowerName.includes('state') ||
        lowerName.includes('country') || lowerName.includes('airport') ||
        lowerName.includes('station') || lowerName.includes('university') ||
        lowerName.includes('school') || lowerName.includes('hospital')) {
        return 'place';
    }
    
    // Common organization indicators
    if (lowerName.includes('company') || lowerName.includes('corp') ||
        lowerName.includes('inc') || lowerName.includes('llc') ||
        lowerName.includes('ltd') || lowerName.includes('organization') ||
        lowerName.includes('foundation') || lowerName.includes('institute')) {
        return 'organization';
    }
    
    // If context suggests it's a location, default to place
    if (context === 'location') {
        return 'place';
    }
    
    // Default to person for actors and most other cases
    return 'person';
}

// Setup step navigation
function setupStepNavigation() {
    // Step navigation buttons
    document.getElementById('proceedToStep2')?.addEventListener('click', () => {
        if (approvalState.approvedEvents.length > 0) {
            showStep(2);
            renderStep2();
        }
    });
    
    document.getElementById('backToStep1')?.addEventListener('click', () => {
        showStep(1);
        renderStep1();
    });
    
    document.getElementById('completeApproval')?.addEventListener('click', () => {
        completeApprovalProcess();
    });
}

// Show specific step
function showStep(stepNumber) {
    // Update step indicator
    document.querySelectorAll('.step').forEach(step => {
        step.classList.remove('active', 'completed');
        const stepNum = parseInt(step.dataset.step);
        if (stepNum === stepNumber) {
            step.classList.add('active');
        } else if (stepNum < stepNumber) {
            step.classList.add('completed');
        }
    });
    
    // Show/hide step content
    document.querySelectorAll('.approval-step').forEach(step => {
        step.classList.remove('active');
    });
    document.getElementById(`step${stepNumber}`)?.classList.add('active');
    
    approvalState.currentStep = stepNumber;
}

// Render Step 1: Event Approval
function renderStep1() {
    const content = document.getElementById('step1Content');
    if (!content) return;
    
    let html = `
        <div class="event-approval-list">
    `;
    
    approvalState.events.forEach((event, index) => {
        const isApproved = event.approved;
        
        html += `
            <div class="event-approval-card ${isApproved ? 'approved' : ''}" 
                 data-event-index="${index}">
                <div class="event-card-header">
                    <h4 class="event-card-sentence">${escapeHtml(event.sentence || `${event.actor} ${event.action} ${event.target}`)}</h4>
                </div>
                <div class="event-card-details">
                    <div class="event-detail">
                        <strong>Actor:</strong> <span class="entity-name">${escapeHtml(event.actor)}</span>
                    </div>
                    <div class="event-detail">
                        <strong>Action:</strong> ${escapeHtml(event.action)}
                    </div>
                    <div class="event-detail">
                        <strong>Target:</strong> <span class="entity-name">${escapeHtml(event.target)}</span>
                    </div>
                    ${event.location ? `<div class="event-detail"><strong>Location:</strong> <span class="entity-name">${escapeHtml(event.location)}</span></div>` : ''}
                    ${event.datetime ? `<div class="event-detail"><strong>Date/Time:</strong> ${escapeHtml(event.datetime)}</div>` : ''}
                    ${event.source ? `<div class="event-detail"><strong>Source:</strong> ${escapeHtml(event.source)}</div>` : ''}
                </div>
                <div class="event-card-actions">
                    <button type="button" class="action-btn success approve-event-btn" 
                            data-event-index="${index}" ${isApproved ? 'disabled' : ''}>
                        ✓ Approve Event
                    </button>
                </div>
            </div>
        `;
    });
    
    html += `</div>`;
    
    content.innerHTML = html;
    
    // Add event listeners for event approval
    setupEventApprovalListeners();
    
    // Update proceed button state
    updateProceedToStep2Button();
}

// Setup event approval event listeners
function setupEventApprovalListeners() {
    document.querySelectorAll('.approve-event-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.eventIndex);
            approveEvent(index);
        });
    });
}

// Setup entity approval event listeners (kept for reference but not used)
function setupEntityApprovalListeners() {
    document.querySelectorAll('.approve-entity-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.entityIndex);
            approveEntity(index);
        });
    });
    
    document.querySelectorAll('.reject-entity-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.entityIndex);
            rejectEntity(index);
        });
    });
}

// Approve event
function approveEvent(index) {
    const event = approvalState.events[index];
    if (!event) return;
    
    event.approved = true;
    approvalState.approvedEvents.push(event);
    
    // Re-render to update UI
    renderStep1();
}

// Approve entity (kept for reference but not used in 2-step process)
function approveEntity(index) {
    const entity = approvalState.uniqueEntities[index];
    
    // Remove from rejected if it was there
    approvalState.rejectedEntities = approvalState.rejectedEntities.filter(e => e.name !== entity.name);
    
    // Add to approved if not already there
    if (!approvalState.approvedEntities.some(e => e.name === entity.name)) {
        approvalState.approvedEntities.push(entity);
    }
    
    // Re-render step 1
    renderStep1();
}

// Reject entity
function rejectEntity(index) {
    const entity = approvalState.uniqueEntities[index];
    
    // Remove from approved if it was there
    approvalState.approvedEntities = approvalState.approvedEntities.filter(e => e.name !== entity.name);
    
    // Add to rejected if not already there
    if (!approvalState.rejectedEntities.some(e => e.name === entity.name)) {
        approvalState.rejectedEntities.push(entity);
    }
    
    // Re-render step 1
    renderStep1();
}

// Update proceed to step 2 button
function updateProceedToStep2Button() {
    const btn = document.getElementById('proceedToStep2');
    if (btn) {
        const hasApprovedEvents = approvalState.approvedEvents.length > 0;
        btn.disabled = !hasApprovedEvents;
        btn.textContent = hasApprovedEvents 
            ? `Proceed to Connections → (${approvalState.approvedEvents.length} events approved)`
            : 'Proceed to Connections → (approve events first)';
    }
}

// Render Step 2: Connection Analysis
function renderStep2() {
    const content = document.getElementById('step2Content');
    if (!content) return;
    
    // Generate proposed connections
    generateProposedConnections();
    
    let html = `
        <div class="connection-analysis-list">
    `;
    
    approvalState.proposedConnections.forEach((connectionGroup, groupIndex) => {
        html += `
            <div class="connection-proposal-card">
                <h4>From Event: "${escapeHtml(connectionGroup.event.sentence)}"</h4>
        `;
        
        connectionGroup.connections.forEach((connection, connIndex) => {
            html += `
                <div class="connection-proposal">
                    <div class="connection-entity">${escapeHtml(connection.fromEntity.name)}</div>
                    <div class="connection-relationship">
                        <input type="text" value="${escapeHtml(connection.proposedRelationship)}" 
                               data-group="${groupIndex}" data-conn="${connIndex}" 
                               class="relationship-input">
                    </div>
                    <div class="connection-entity">${escapeHtml(connection.toEntity.name)}</div>
                    <button type="button" class="add-connection-btn" 
                            data-group="${groupIndex}" data-conn="${connIndex}">
                        Add Connection
                    </button>
                </div>
            `;
            
            // Add reverse connection
            if (connection.reverseRelationship) {
                html += `
                    <div class="connection-proposal">
                        <div class="connection-entity">${escapeHtml(connection.toEntity.name)}</div>
                        <div class="connection-relationship">
                            <input type="text" value="${escapeHtml(connection.reverseRelationship)}" 
                                   data-group="${groupIndex}" data-conn="${connIndex}" data-reverse="true"
                                   class="relationship-input">
                        </div>
                        <div class="connection-entity">${escapeHtml(connection.fromEntity.name)}</div>
                        <button type="button" class="add-connection-btn" 
                                data-group="${groupIndex}" data-conn="${connIndex}" data-reverse="true">
                            Add Connection
                        </button>
                    </div>
                `;
            }
        });
        
        html += `</div>`;
    });
    
    html += `</div>`;
    
    content.innerHTML = html;
    
    // Add event listeners for connection creation
    setupConnectionCreationListeners();
}

// Generate events from CSV data
function generateEventsFromCSV() {
    approvalState.events = approvalState.csvData.data.map((row, index) => ({
        id: `event_${index}_${Date.now()}`,
        actor: row.Actor || '',
        action: row.Action || '',
        target: row.Target || '',
        sentence: row.Sentence || '',
        dateReceived: row['Date Received'] || '',
        locations: row.Locations || '',
        datetimes: row.Datetimes || row.Datetime || '',
        originalRow: row
    }));
}

// Approve event
function approveEvent(index) {
    const event = approvalState.events[index];
    
    if (!approvalState.approvedEvents.some(e => e.id === event.id)) {
        approvalState.approvedEvents.push(event);
    }
    
    // Re-render step 2
    renderStep2();
}

// Update proceed to step 3 button
function updateProceedToStep3Button() {
    const btn = document.getElementById('proceedToStep3');
    if (btn) {
        const hasApprovedEvents = approvalState.approvedEvents.length > 0;
        btn.disabled = !hasApprovedEvents;
        btn.textContent = hasApprovedEvents 
            ? `Proceed to Connections → (${approvalState.approvedEvents.length} events approved)`
            : 'Proceed to Connections → (approve events first)';
    }
}

// Render Step 3: Connection Analysis
function renderStep3() {
    const content = document.getElementById('step3Content');
    if (!content) return;
    
    // Generate proposed connections
    generateProposedConnections();
    
    let html = `
        <div class="connection-analysis-list">
    `;
    
    approvalState.proposedConnections.forEach((connectionGroup, groupIndex) => {
        html += `
            <div class="connection-proposal-card">
                <h4>From Event: "${escapeHtml(connectionGroup.event.sentence)}"</h4>
        `;
        
        connectionGroup.connections.forEach((connection, connIndex) => {
            html += `
                <div class="connection-proposal">
                    <div class="connection-entity">${escapeHtml(connection.fromEntity.name)}</div>
                    <div class="connection-relationship">
                        <input type="text" value="${escapeHtml(connection.proposedRelationship)}" 
                               data-group="${groupIndex}" data-conn="${connIndex}" 
                               class="relationship-input">
                    </div>
                    <div class="connection-entity">${escapeHtml(connection.toEntity.name)}</div>
                    <button type="button" class="add-connection-btn" 
                            data-group="${groupIndex}" data-conn="${connIndex}">
                        Add Connection
                    </button>
                </div>
            `;
            
            // Add reverse connection
            if (connection.reverseRelationship) {
                html += `
                    <div class="connection-proposal">
                        <div class="connection-entity">${escapeHtml(connection.toEntity.name)}</div>
                        <div class="connection-relationship">
                            <input type="text" value="${escapeHtml(connection.reverseRelationship)}" 
                                   data-group="${groupIndex}" data-conn="${connIndex}" data-reverse="true"
                                   class="relationship-input">
                        </div>
                        <div class="connection-entity">${escapeHtml(connection.fromEntity.name)}</div>
                        <button type="button" class="add-connection-btn" 
                                data-group="${groupIndex}" data-conn="${connIndex}" data-reverse="true">
                            Add Connection
                        </button>
                    </div>
                `;
            }
        });
        
        html += `</div>`;
    });
    
    html += `</div>`;
    
    content.innerHTML = html;
    
    // Add event listeners
    setupConnectionApprovalListeners();
}

// Generate proposed connections from approved events
function generateProposedConnections() {
    approvalState.proposedConnections = [];
    
    approvalState.approvedEvents.forEach(event => {
        const connections = [];
        
        // Find approved entities for this event
        const actorEntity = findApprovedEntity(event.actor);
        const targetEntity = findApprovedEntity(event.target);
        const locationEntities = event.locations ? 
            event.locations.split(',').map(loc => findApprovedEntity(loc.trim())).filter(e => e) : [];
        
        // Actor → Target connection
        if (actorEntity && targetEntity) {
            const relationship = inferRelationshipFromAction(event.action);
            connections.push({
                fromEntity: actorEntity,
                toEntity: targetEntity,
                proposedRelationship: relationship.label || 'related to',
                reverseRelationship: relationship.reverseLabel || 'related to'
            });
        }
        
        // Actor → Location connections
        locationEntities.forEach(locationEntity => {
            if (actorEntity && locationEntity) {
                connections.push({
                    fromEntity: actorEntity,
                    toEntity: locationEntity,
                    proposedRelationship: getLocationRelationship(event.action),
                    reverseRelationship: null
                });
            }
        });
        
        if (connections.length > 0) {
            approvalState.proposedConnections.push({
                event: event,
                connections: connections
            });
        }
    });
}

// Find approved entity by name
function findApprovedEntity(name) {
    if (!name || !name.trim()) return null;
    
    // Get knowledge base data
    const kbData = getKnowledgeBaseData();
    
    // Search in all entity types (people, places, organizations)
    for (const [entityType, entities] of Object.entries(kbData)) {
        if (!Array.isArray(entities)) continue;
        
        for (const entity of entities) {
            // Check exact name match
            if (entity.name && entity.name.toLowerCase() === name.toLowerCase().trim()) {
                return { ...entity, type: entityType.slice(0, -1) }; // Remove 's' from plural
            }
            
            // Check aliases
            if (entity.aliases && Array.isArray(entity.aliases)) {
                for (const alias of entity.aliases) {
                    if (alias.toLowerCase() === name.toLowerCase().trim()) {
                        return { ...entity, type: entityType.slice(0, -1) }; // Remove 's' from plural
                    }
                }
            }
        }
    }
    
    return null;
}

// Infer relationship from action (simplified version)
function inferRelationshipFromAction(action) {
    const actionLower = action.toLowerCase();
    
    const relationships = {
        'departed': { label: 'departed from', reverseLabel: 'departure of' },
        'arrived': { label: 'arrived at', reverseLabel: 'arrival of' },
        'taught': { label: 'teacher of', reverseLabel: 'student of' },
        'hired': { label: 'employer of', reverseLabel: 'employee of' },
        'met': { label: 'met with', reverseLabel: 'met with' },
        'visited': { label: 'visited', reverseLabel: 'visited by' }
    };
    
    for (const [key, relationship] of Object.entries(relationships)) {
        if (actionLower.includes(key)) {
            return relationship;
        }
    }
    
    return { label: 'related to', reverseLabel: 'related to' };
}

// Get location-specific relationship
function getLocationRelationship(action) {
    const actionLower = action.toLowerCase();
    
    if (actionLower.includes('departed') || actionLower.includes('left')) {
        return 'departed from';
    } else if (actionLower.includes('arrived') || actionLower.includes('reached')) {
        return 'arrived at';
    } else if (actionLower.includes('visited')) {
        return 'visited';
    } else if (actionLower.includes('traveled') || actionLower.includes('went')) {
        return 'traveled to';
    }
    
    return 'was at';
}

// Setup connection approval listeners
function setupConnectionApprovalListeners() {
    document.querySelectorAll('.add-connection-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const groupIndex = parseInt(e.target.dataset.group);
            const connIndex = parseInt(e.target.dataset.conn);
            const isReverse = e.target.dataset.reverse === 'true';
            
            addConnection(groupIndex, connIndex, isReverse, e.target);
        });
    });
}

// Add connection
async function addConnection(groupIndex, connIndex, isReverse, buttonElement) {
    const connectionGroup = approvalState.proposedConnections[groupIndex];
    const connection = connectionGroup.connections[connIndex];
    
    // Get the relationship text from the input
    const relationshipInput = buttonElement.parentElement.querySelector('.relationship-input');
    const relationshipText = relationshipInput.value.trim();
    
    if (!relationshipText) {
        alert('Please enter a relationship');
        return;
    }
    
    try {
        // Create connection data
        const connectionData = {
            fromEntityId: isReverse ? connection.toEntity.id : connection.fromEntity.id,
            fromEntityType: isReverse ? connection.toEntity.type : connection.fromEntity.type,
            toEntityId: isReverse ? connection.fromEntity.id : connection.toEntity.id,
            toEntityType: isReverse ? connection.fromEntity.type : connection.toEntity.type,
            relationshipType: relationshipText.toLowerCase().replace(/\s+/g, '_'),
            relationshipLabel: relationshipText,
            source: 'CSV Analysis',
            confidence: 'medium',
            sourceEvent: connectionGroup.event.id
        };
        
        // Save connection
        await saveConnectionToFirebase(connectionData);
        
        // Update button to show success
        buttonElement.textContent = '✓ Added';
        buttonElement.disabled = true;
        buttonElement.classList.add('success');
        
        // Track approved connection
        approvalState.approvedConnections.push(connectionData);
        
    } catch (error) {
        console.error('Error adding connection:', error);
        buttonElement.textContent = '✗ Error';
        buttonElement.classList.add('error');
    }
}

// Complete the approval process
async function completeApprovalProcess() {
    try {
        // Save all approved entities
        for (const entity of approvalState.approvedEntities) {
            const entityData = {
                name: entity.name,
                type: entity.type,
                source: entity.source,
                confidence: 'high'
            };
            const docRef = await saveEntityToFirebase(entityData, entity.type + 's'); // pluralize
            entityData.id = docRef.id; // Set the Firebase-generated ID
        }
        
        // Save all approved events
        for (const event of approvalState.approvedEvents) {
            await saveEventToFirebase(event);
        }
        
        // Show success message
        alert(`Approval process completed successfully!\n\n` +
              `✓ ${approvalState.approvedEntities.length} entities approved\n` +
              `✓ ${approvalState.approvedEvents.length} events approved\n` +
              `✓ ${approvalState.approvedConnections.length} connections created`);
        
        // Reset and hide approval process
        resetApprovalProcess();
        
    } catch (error) {
        console.error('Error completing approval process:', error);
        alert('Error completing approval process: ' + error.message);
    }
}

// Reset approval process
function resetApprovalProcess() {
    approvalState = {
        currentStep: 1,
        csvData: null,
        uniqueEntities: [],
        approvedEntities: [],
        rejectedEntities: [],
        events: [],
        approvedEvents: [],
        proposedConnections: [],
        approvedConnections: []
    };
    
    // Hide approval process and show CSV data
    const csvDataDisplay = document.getElementById('csvDataDisplay');
    const approvalProcess = document.getElementById('approvalProcess');
    
    if (csvDataDisplay) csvDataDisplay.style.display = 'block';
    if (approvalProcess) approvalProcess.style.display = 'none';
}

// Export the main initialization function
export { initializeApprovalProcess, resetApprovalProcess };
