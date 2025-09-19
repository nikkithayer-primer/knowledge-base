// Approval queue functionality for entity review and Firebase integration
import { saveEntityToFirebase } from './firebaseOperations.js';
import { escapeHtml } from './dataProcessor.js';
import { getFirebaseCollectionName } from './collectionMapping.js';

// Global approval queue state
let approvalQueue = [];
let approvalStats = {
    pending: 0,
    approved: 0,
    rejected: 0
};

// Initialize approval queue with enriched entities
export function initializeApprovalQueue(enrichedData) {
    approvalQueue = [];
    approvalStats = { pending: 0, approved: 0, rejected: 0 };
    
    // Add all entities to approval queue
    [...enrichedData.people, ...enrichedData.places, ...enrichedData.organizations].forEach((entity, index) => {
        approvalQueue.push({
            id: `approval_${index}`,
            entity: entity,
            entityType: entity.type,
            status: 'pending',
            originalName: getOriginalName(entity),
            wikidataInfo: entity
        });
    });
    
    // Add unknown entities for manual review
    enrichedData.unknown.forEach((unknownEntity, index) => {
        approvalQueue.push({
            id: `unknown_${index}`,
            entity: null,
            entityType: 'unknown',
            status: 'pending',
            originalName: unknownEntity.originalName,
            wikidataInfo: unknownEntity
        });
    });
    
    // Add notFound entities for manual review - these should also be available for knowledge base
    if (enrichedData.notFound) {
        enrichedData.notFound.forEach((notFoundEntity, index) => {
            approvalQueue.push({
                id: `notfound_${index}`,
                entity: null,
                entityType: 'unknown',
                status: 'pending',
                originalName: notFoundEntity.originalName,
                wikidataInfo: {
                    originalName: notFoundEntity.originalName,
                    reason: notFoundEntity.reason || 'Not found in Wikidata',
                    found: false
                }
            });
        });
    }
    
    approvalStats.pending = approvalQueue.length;
    
    console.log(`📋 Approval queue initialized with ${approvalQueue.length} entities`);
    return approvalQueue;
}

// Get original name from entity
function getOriginalName(entity) {
    if (entity.aliases && entity.aliases.length > 0) {
        return entity.aliases[0];
    }
    return entity.name;
}

// Render approval queue UI
export function renderApprovalQueue() {
    const approvalQueueContainer = document.getElementById('approvalQueue');
    const approvalEmptyState = document.getElementById('approvalEmptyState');
    const approvalTab = document.getElementById('approvalTab');
    
    // Check if there are any pending items
    const pendingItems = approvalQueue.filter(item => item.status === 'pending');
    
    if (pendingItems.length === 0) {
        approvalQueueContainer.innerHTML = '';
        approvalEmptyState.style.display = 'block';
        approvalTab.textContent = 'Approval Queue';
        updateApprovalControls();
        return;
    }
    
    approvalEmptyState.style.display = 'none';
    
    // Update tab with count
    approvalTab.textContent = `Approval Queue (${approvalStats.pending})`;
    approvalTab.setAttribute('data-has-data', approvalStats.pending > 0 ? 'true' : 'false');
    
    // Render entity cards (only show pending items)
    approvalQueueContainer.innerHTML = pendingItems.map(item => createEntityCard(item)).join('');
    
    // Update controls
    updateApprovalControls();
    
    // Add event listeners
    addApprovalEventListeners();
}

// Create entity approval card
function createEntityCard(item) {
    const entity = item.entity;
    const wikidataInfo = item.wikidataInfo;
    
    if (!entity) {
        // Handle unknown entities
        return `
            <div class="entity-card ${item.status}" data-id="${item.id}">
                <div class="status-badge ${item.status}">${item.status}</div>
                <div class="entity-header">
                    <div class="entity-info">
                        <div class="entity-type unknown">Unknown Entity</div>
                        <h3>${escapeHtml(item.originalName)}</h3>
                        <div class="original-name">Not found in Wikidata</div>
                    </div>
                    <div class="entity-actions">
                        <button class="map-btn" data-action="map" data-id="${item.id}">🔗 Map to Wikidata</button>
                        <button class="reject-btn" data-action="reject" data-id="${item.id}">✗ Reject</button>
                    </div>
                </div>
                <div class="entity-details">
                    <div class="detail-group">
                        <div class="detail-item">
                            <div class="detail-label">Reason</div>
                            <div class="detail-value">${wikidataInfo.reason || 'Not found in Wikidata'}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    return `
        <div class="entity-card ${item.status}" data-id="${item.id}">
            <div class="status-badge ${item.status}">${item.status}</div>
            <div class="entity-header">
                <div class="entity-info">
                    <div class="entity-type ${entity.type}">${entity.type}</div>
                    <h3>${escapeHtml(entity.name)}</h3>
                    <div class="original-name">Originally: "${escapeHtml(item.originalName)}"</div>
                </div>
                <div class="entity-actions">
                    <button class="approve-btn" data-action="approve" data-id="${item.id}">✓ Approve</button>
                    <button class="reject-btn" data-action="reject" data-id="${item.id}">✗ Reject</button>
                </div>
            </div>
            <div class="entity-details">
                ${createEntityDetails(entity, wikidataInfo)}
            </div>
        </div>
    `;
}

// Create entity details based on type
function createEntityDetails(entity, wikidataInfo) {
    const commonDetails = `
        <div class="detail-group">
            <div class="detail-item">
                <div class="detail-label">Wikidata ID</div>
                <div class="detail-value">
                    ${entity.wikidata_id ? 
                        `<a href="https://www.wikidata.org/wiki/${entity.wikidata_id}" target="_blank" class="wikidata-link">${entity.wikidata_id}</a>` : 
                        '<span class="empty">Not available</span>'
                    }
                </div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Description</div>
                <div class="detail-value ${entity.description ? '' : 'empty'}">
                    ${entity.description || 'No description available'}
                </div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Aliases</div>
                <div class="detail-value">
                    ${entity.aliases && entity.aliases.length > 0 ? 
                        entity.aliases.map(alias => escapeHtml(alias)).join(', ') : 
                        '<span class="empty">None</span>'
                    }
                </div>
            </div>
        </div>
    `;
    
    if (entity.type === 'person') {
        return commonDetails + `
            <div class="detail-group">
                <div class="detail-item">
                    <div class="detail-label">Occupation</div>
                    <div class="detail-value ${entity.occupation ? '' : 'empty'}">
                        ${entity.occupation || 'Not specified'}
                    </div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Current Employer</div>
                    <div class="detail-value ${entity.currentEmployer ? '' : 'empty'}">
                        ${entity.currentEmployer || 'Not specified'}
                    </div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Date of Birth</div>
                    <div class="detail-value ${entity.dateOfBirth ? '' : 'empty'}">
                        ${entity.dateOfBirth || 'Not specified'}
                    </div>
                </div>
            </div>
        `;
    } else if (entity.type === 'place') {
        return commonDetails + `
            <div class="detail-group">
                <div class="detail-item">
                    <div class="detail-label">Category</div>
                    <div class="detail-value ${entity.category ? '' : 'empty'}">
                        ${entity.category || 'Not specified'}
                    </div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Country</div>
                    <div class="detail-value ${entity.country ? '' : 'empty'}">
                        ${entity.country || 'Not specified'}
                    </div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Population</div>
                    <div class="detail-value ${entity.population ? '' : 'empty'}">
                        ${entity.population ? entity.population.toLocaleString() : 'Not specified'}
                    </div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Coordinates</div>
                    <div class="detail-value ${entity.coordinates ? '' : 'empty'}">
                        ${entity.coordinates ? 
                            `${entity.coordinates.lat.toFixed(4)}, ${entity.coordinates.lng.toFixed(4)}` : 
                            'Not specified'
                        }
                    </div>
                </div>
            </div>
        `;
    } else if (entity.type === 'organization') {
        return commonDetails + `
            <div class="detail-group">
                <div class="detail-item">
                    <div class="detail-label">Category</div>
                    <div class="detail-value ${entity.category ? '' : 'empty'}">
                        ${entity.category || 'Not specified'}
                    </div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Industry</div>
                    <div class="detail-value ${entity.industry ? '' : 'empty'}">
                        ${entity.industry || 'Not specified'}
                    </div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Founded</div>
                    <div class="detail-value ${entity.founded ? '' : 'empty'}">
                        ${entity.founded || 'Not specified'}
                    </div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Location</div>
                    <div class="detail-value ${entity.location ? '' : 'empty'}">
                        ${entity.location || 'Not specified'}
                    </div>
                </div>
            </div>
        `;
    }
    
    return commonDetails;
}

// Add event listeners for approval actions
function addApprovalEventListeners() {
    // Individual approve/reject/map buttons
    document.querySelectorAll('.approve-btn, .reject-btn, .map-btn').forEach(button => {
        button.addEventListener('click', handleEntityAction);
    });
}

// Handle mapping unknown entity to Wikidata
async function handleMapToWikidata(item) {
    const wikidataId = prompt(
        `Enter Wikidata ID to map "${item.originalName}" to:\n\n` +
        `Example: Q62 for San Francisco\n` +
        `You can find Wikidata IDs by searching on wikidata.org`
    );
    
    if (!wikidataId) return; // User cancelled
    
    // Validate Wikidata ID format
    if (!/^Q\d+$/i.test(wikidataId.trim())) {
        alert('Invalid Wikidata ID format. Please enter an ID like Q123456');
        return;
    }
    
    const cleanId = wikidataId.trim().toUpperCase();
    
    try {
        console.log(`🔗 Mapping "${item.originalName}" to Wikidata ID: ${cleanId}`);
        
        // Import the Wikidata integration function
        const { enrichEntityWithWikidata } = await import('./wikidataIntegration.js');
        
        // Create a temporary entity object for enrichment
        const tempEntity = {
            originalName: item.originalName,
            wikidata_id: cleanId
        };
        
        // Enrich with Wikidata
        const enrichedEntity = await enrichEntityWithWikidata(tempEntity);
        
        if (!enrichedEntity || !enrichedEntity.name) {
            alert(`Failed to fetch data for Wikidata ID: ${cleanId}`);
            return;
        }
        
        // Check if the original name matches the Wikidata name
        const originalName = item.originalName.toLowerCase().trim();
        const wikidataName = enrichedEntity.name.toLowerCase().trim();
        
        // Add original name as alias if it's different from the Wikidata name
        if (originalName !== wikidataName) {
            if (!enrichedEntity.aliases) {
                enrichedEntity.aliases = [];
            }
            
            // Check if the original name is already in aliases
            const aliasExists = enrichedEntity.aliases.some(alias => 
                alias.toLowerCase().trim() === originalName
            );
            
            if (!aliasExists) {
                enrichedEntity.aliases.push(item.originalName);
                console.log(`📝 Added "${item.originalName}" as alias to "${enrichedEntity.name}"`);
            }
        }
        
        // Update the approval queue item
        item.entity = enrichedEntity;
        item.entityType = enrichedEntity.type;
        item.wikidataInfo = {
            ...item.wikidataInfo,
            wikidata_id: cleanId,
            mapped: true,
            mappedBy: 'user'
        };
        
        console.log(`✅ Successfully mapped "${item.originalName}" to "${enrichedEntity.name}" (${cleanId})`);
        
        // Re-render the approval queue to show the updated entity
        renderApprovalQueue();
        
    } catch (error) {
        console.error(`Error mapping to Wikidata ID ${cleanId}:`, error);
        alert(`Error fetching Wikidata entity: ${error.message}`);
    }
}

// Handle individual entity approval/rejection
async function handleEntityAction(event) {
    const action = event.target.dataset.action;
    const entityId = event.target.dataset.id;
    
    const item = approvalQueue.find(item => item.id === entityId);
    if (!item) return;
    
    if (action === 'approve' && item.entity) {
        try {
            // Save to Firebase using proper collection name
            const collectionName = getFirebaseCollectionName(item.entity.type + 's');
            await saveEntityToFirebase(item.entity, collectionName);
            
            item.status = 'approved';
            approvalStats.pending--;
            approvalStats.approved++;
            
            console.log(`✅ Approved and saved to Firebase: ${item.entity.name}`);
            
        } catch (error) {
            console.error(`Error saving ${item.entity.name} to Firebase:`, error);
            alert(`Error saving to Firebase: ${error.message}`);
            return;
        }
    } else if (action === 'reject') {
        item.status = 'rejected';
        approvalStats.pending--;
        approvalStats.rejected++;
        
        console.log(`❌ Rejected: ${item.originalName}`);
    } else if (action === 'map') {
        // Handle mapping unknown entity to Wikidata
        await handleMapToWikidata(item);
        return; // Don't re-render yet, let the mapping function handle it
    }
    
    // Update UI
    renderApprovalQueue();
}

// Handle approve all action
export async function handleApproveAll() {
    const pendingItems = approvalQueue.filter(item => item.status === 'pending' && item.entity);
    
    if (pendingItems.length === 0) return;
    
    const confirmMessage = `Are you sure you want to approve and save ${pendingItems.length} entities to Firebase?`;
    if (!confirm(confirmMessage)) return;
    
    console.log(`🚀 Bulk approving ${pendingItems.length} entities...`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const item of pendingItems) {
        try {
            const collectionName = getFirebaseCollectionName(item.entity.type + 's');
            await saveEntityToFirebase(item.entity, collectionName);
            
            item.status = 'approved';
            approvalStats.pending--;
            approvalStats.approved++;
            successCount++;
            
            console.log(`✅ Approved: ${item.entity.name}`);
            
        } catch (error) {
            console.error(`Error saving ${item.entity.name}:`, error);
            errorCount++;
        }
    }
    
    console.log(`📊 Bulk approval complete: ${successCount} saved, ${errorCount} errors`);
    
    if (errorCount > 0) {
        alert(`${successCount} entities saved successfully. ${errorCount} entities failed to save.`);
    } else {
        alert(`All ${successCount} entities approved and saved to Firebase!`);
    }
    
    renderApprovalQueue();
}

// Handle reject all action
export function handleRejectAll() {
    const pendingItems = approvalQueue.filter(item => item.status === 'pending');
    
    if (pendingItems.length === 0) return;
    
    const confirmMessage = `Are you sure you want to reject ${pendingItems.length} entities?`;
    if (!confirm(confirmMessage)) return;
    
    pendingItems.forEach(item => {
        item.status = 'rejected';
        approvalStats.pending--;
        approvalStats.rejected++;
    });
    
    console.log(`❌ Rejected ${pendingItems.length} entities`);
    
    renderApprovalQueue();
}

// Update approval controls
function updateApprovalControls() {
    const approveAllBtn = document.getElementById('approveAllBtn');
    const rejectAllBtn = document.getElementById('rejectAllBtn');
    const approvalStatsSpan = document.getElementById('approvalStats');
    
    const hasPending = approvalStats.pending > 0;
    const hasApproveableEntities = approvalQueue.some(item => item.status === 'pending' && item.entity);
    
    // Update buttons
    approveAllBtn.disabled = !hasApproveableEntities;
    rejectAllBtn.disabled = !hasPending;
    
    // Update stats
    if (approvalQueue.length === 0) {
        approvalStatsSpan.textContent = 'No entities to review';
    } else {
        approvalStatsSpan.textContent = `${approvalStats.pending} pending, ${approvalStats.approved} approved, ${approvalStats.rejected} rejected`;
    }
    
    // Update approval tab state based on pending items
    // This function will be available globally from main.js
    if (typeof window.updateApprovalTabState === 'function') {
        window.updateApprovalTabState(hasPending);
    }
}

// Get approval queue statistics
export function getApprovalStats() {
    return { ...approvalStats };
}
