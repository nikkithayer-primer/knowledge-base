// Knowledge Base Explorer - Entity search, profiles, and network visualization
import { loadEntitiesFromFirebase } from './firebaseOperations.js';
import { getFirebaseCollectionName } from './collectionMapping.js';
import { escapeHtml } from './dataProcessor.js';

// Global state
let knowledgeBaseData = {
    people: [],
    places: [],
    organizations: [],
    events: [],
    connections: []
};

let currentEntity = null;
let networkGraph = null;
let showLabels = true;

// Initialize the explorer
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await loadKnowledgeBase();
        initializeSearch();
        initializeNetworkControls();
        
        console.log('✅ Knowledge Base Explorer initialized');
        console.log('📊 Loaded data:', {
            people: knowledgeBaseData.people.length,
            places: knowledgeBaseData.places.length,
            organizations: knowledgeBaseData.organizations.length,
            events: knowledgeBaseData.events.length,
            connections: knowledgeBaseData.connections.length
        });
        
    } catch (error) {
        console.error('❌ Error initializing explorer:', error);
    }
});

// Load knowledge base data
async function loadKnowledgeBase() {
    try {
        const peopleCollection = getFirebaseCollectionName('people');
        const placesCollection = getFirebaseCollectionName('places');
        const organizationsCollection = getFirebaseCollectionName('organizations');
        const eventsCollection = getFirebaseCollectionName('events');
        const connectionsCollection = getFirebaseCollectionName('connections');
        
        const [people, places, organizations, events, connections] = await Promise.all([
            loadEntitiesFromFirebase(peopleCollection, 1000),
            loadEntitiesFromFirebase(placesCollection, 1000),
            loadEntitiesFromFirebase(organizationsCollection, 1000),
            loadEntitiesFromFirebase(eventsCollection, 1000),
            loadEntitiesFromFirebase(connectionsCollection, 1000)
        ]);
        
        knowledgeBaseData = {
            people,
            places,
            organizations,
            events,
            connections
        };
        
    } catch (error) {
        console.error('Error loading knowledge base:', error);
        throw error;
    }
}

// Initialize search functionality
function initializeSearch() {
    const searchInput = document.getElementById('entitySearch');
    const searchDropdown = document.getElementById('searchDropdown');
    let highlightedIndex = -1;
    
    if (!searchInput || !searchDropdown) return;
    
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        highlightedIndex = -1;
        
        if (query.length < 2) {
            hideSearchDropdown();
            return;
        }
        
        const results = searchEntities(query);
        displaySearchResults(results);
    });
    
    searchInput.addEventListener('keydown', (e) => {
        const items = searchDropdown.querySelectorAll('.search-item');
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            highlightedIndex = Math.min(highlightedIndex + 1, items.length - 1);
            updateSearchHighlight(items, highlightedIndex);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            highlightedIndex = Math.max(highlightedIndex - 1, -1);
            updateSearchHighlight(items, highlightedIndex);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightedIndex >= 0 && items[highlightedIndex]) {
                selectSearchResult(items[highlightedIndex]);
            }
        } else if (e.key === 'Escape') {
            hideSearchDropdown();
        }
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !searchDropdown.contains(e.target)) {
            hideSearchDropdown();
        }
    });
}

// Search entities across all types
function searchEntities(query) {
    const results = [];
    const queryLower = query.toLowerCase();
    
    // Search people
    knowledgeBaseData.people.forEach(entity => {
        if (entityMatchesQuery(entity, queryLower)) {
            results.push({ ...entity, type: 'person', collection: 'people' });
        }
    });
    
    // Search places
    knowledgeBaseData.places.forEach(entity => {
        if (entityMatchesQuery(entity, queryLower)) {
            results.push({ ...entity, type: 'place', collection: 'places' });
        }
    });
    
    // Search organizations
    knowledgeBaseData.organizations.forEach(entity => {
        if (entityMatchesQuery(entity, queryLower)) {
            results.push({ ...entity, type: 'organization', collection: 'organizations' });
        }
    });
    
    // Search events
    knowledgeBaseData.events.forEach(entity => {
        if (eventMatchesQuery(entity, queryLower)) {
            results.push({ ...entity, type: 'event', collection: 'events' });
        }
    });
    
    // Sort by relevance (exact matches first, then partial matches)
    results.sort((a, b) => {
        const aExact = (a.name || a.sentence || '').toLowerCase() === queryLower;
        const bExact = (b.name || b.sentence || '').toLowerCase() === queryLower;
        
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        
        return (a.name || a.sentence || '').localeCompare(b.name || b.sentence || '');
    });
    
    return results.slice(0, 10); // Limit to top 10 results
}

// Check if entity matches query
function entityMatchesQuery(entity, queryLower) {
    // Check name
    if (entity.name && entity.name.toLowerCase().includes(queryLower)) {
        return true;
    }
    
    // Check aliases
    if (entity.aliases && Array.isArray(entity.aliases)) {
        return entity.aliases.some(alias => 
            alias.toLowerCase().includes(queryLower)
        );
    }
    
    // Check description
    if (entity.description && entity.description.toLowerCase().includes(queryLower)) {
        return true;
    }
    
    return false;
}

// Check if event matches query
function eventMatchesQuery(event, queryLower) {
    const fields = ['actor', 'action', 'target', 'sentence'];
    return fields.some(field => 
        event[field] && event[field].toLowerCase().includes(queryLower)
    );
}

// Display search results
function displaySearchResults(results) {
    const searchDropdown = document.getElementById('searchDropdown');
    if (!searchDropdown) return;
    
    if (results.length === 0) {
        searchDropdown.innerHTML = '<div class="search-item"><div class="search-item-name">No results found</div></div>';
        showSearchDropdown();
        return;
    }
    
    const html = results.map((result, index) => {
        const name = result.name || result.sentence || 'Unnamed';
        const type = result.type;
        const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
        
        let metaInfo = `Type: ${typeLabel}`;
        if (result.wikidata_id) {
            metaInfo += ` • Wikidata: ${result.wikidata_id}`;
        }
        
        return `
            <div class="search-item" data-index="${index}">
                <div class="search-item-name">${escapeHtml(name)}</div>
                <div class="search-item-meta">
                    <span class="search-item-type">${typeLabel}</span>
                    <span>${metaInfo}</span>
                </div>
            </div>
        `;
    }).join('');
    
    searchDropdown.innerHTML = html;
    
    // Add click listeners
    searchDropdown.querySelectorAll('.search-item').forEach((item, index) => {
        item.addEventListener('click', () => {
            selectSearchResult(item, results[index]);
        });
    });
    
    showSearchDropdown();
}

// Show search dropdown
function showSearchDropdown() {
    const searchDropdown = document.getElementById('searchDropdown');
    if (searchDropdown) {
        searchDropdown.classList.add('show');
    }
}

// Hide search dropdown
function hideSearchDropdown() {
    const searchDropdown = document.getElementById('searchDropdown');
    if (searchDropdown) {
        searchDropdown.classList.remove('show');
    }
}

// Update search highlight
function updateSearchHighlight(items, highlightedIndex) {
    items.forEach((item, index) => {
        if (index === highlightedIndex) {
            item.classList.add('highlighted');
        } else {
            item.classList.remove('highlighted');
        }
    });
}

// Select search result
function selectSearchResult(item, entity = null) {
    if (!entity) {
        const index = parseInt(item.dataset.index);
        const query = document.getElementById('entitySearch').value.trim();
        const results = searchEntities(query);
        entity = results[index];
    }
    
    if (entity) {
        displayEntityProfile(entity);
        hideSearchDropdown();
        
        // Update search input
        const searchInput = document.getElementById('entitySearch');
        if (searchInput) {
            searchInput.value = entity.name || entity.sentence || '';
        }
    }
}

// Display entity profile
function displayEntityProfile(entity) {
    currentEntity = entity;
    
    // Show profile section
    const profileSection = document.getElementById('profileSection');
    const noResults = document.getElementById('noResults');
    
    if (profileSection) profileSection.classList.add('show');
    if (noResults) noResults.style.display = 'none';
    
    // Update profile header
    updateProfileHeader(entity);
    
    // Update profile fields
    updateProfileFields(entity);
    
    // Update network visualization
    updateNetworkVisualization(entity);
    
    // Update connections list
    updateConnectionsList(entity);
}

// Update profile header
function updateProfileHeader(entity) {
    const profileName = document.getElementById('profileName');
    const profileType = document.getElementById('profileType');
    const profileConnections = document.getElementById('profileConnections');
    const profileEvents = document.getElementById('profileEvents');
    const profileSource = document.getElementById('profileSource');
    
    if (profileName) {
        profileName.textContent = entity.name || entity.sentence || 'Unnamed Entity';
    }
    
    if (profileType) {
        const typeLabel = entity.type.charAt(0).toUpperCase() + entity.type.slice(1);
        profileType.textContent = typeLabel;
        profileType.className = `profile-type ${entity.type}`;
    }
    
    // Count connections and events
    const connections = getEntityConnections(entity);
    const events = getEntityEvents(entity);
    
    if (profileConnections) {
        profileConnections.textContent = `${connections.length} connections`;
    }
    
    if (profileEvents) {
        profileEvents.textContent = `${events.length} events`;
    }
    
    if (profileSource) {
        profileSource.textContent = `Source: ${entity.source || 'Knowledge Base'}`;
    }
}

// Update profile fields
function updateProfileFields(entity) {
    const profileFields = document.getElementById('profileFields');
    if (!profileFields) return;
    
    let fieldsHtml = '';
    
    // Common fields for all entity types
    if (entity.name && entity.type !== 'event') {
        fieldsHtml += createProfileField('Name', entity.name);
    }
    
    if (entity.description) {
        fieldsHtml += createProfileField('Description', entity.description);
    }
    
    if (entity.wikidata_id) {
        const wikidataLink = `<a href="https://www.wikidata.org/wiki/${entity.wikidata_id}" target="_blank">${entity.wikidata_id}</a>`;
        fieldsHtml += createProfileField('Wikidata ID', wikidataLink);
    }
    
    // Type-specific fields
    if (entity.type === 'person') {
        if (entity.birth_date) fieldsHtml += createProfileField('Birth Date', entity.birth_date);
        if (entity.death_date) fieldsHtml += createProfileField('Death Date', entity.death_date);
        if (entity.nationality) fieldsHtml += createProfileField('Nationality', entity.nationality);
        if (entity.occupation) fieldsHtml += createProfileField('Occupation', entity.occupation);
    } else if (entity.type === 'place') {
        if (entity.country) fieldsHtml += createProfileField('Country', entity.country);
        if (entity.region) fieldsHtml += createProfileField('Region', entity.region);
        if (entity.population) fieldsHtml += createProfileField('Population', entity.population);
        if (entity.coordinates) fieldsHtml += createProfileField('Coordinates', entity.coordinates);
    } else if (entity.type === 'organization') {
        if (entity.founded_date) fieldsHtml += createProfileField('Founded', entity.founded_date);
        if (entity.headquarters) fieldsHtml += createProfileField('Headquarters', entity.headquarters);
        if (entity.industry) fieldsHtml += createProfileField('Industry', entity.industry);
        if (entity.website) {
            const websiteLink = `<a href="${entity.website}" target="_blank">${entity.website}</a>`;
            fieldsHtml += createProfileField('Website', websiteLink);
        }
    } else if (entity.type === 'event') {
        if (entity.actor) fieldsHtml += createProfileField('Actor', entity.actor);
        if (entity.action) fieldsHtml += createProfileField('Action', entity.action);
        if (entity.target) fieldsHtml += createProfileField('Target', entity.target);
        if (entity.sentence) fieldsHtml += createProfileField('Sentence', entity.sentence);
        if (entity.dateReceived) fieldsHtml += createProfileField('Date Received', entity.dateReceived);
        if (entity.locations) fieldsHtml += createProfileField('Locations', entity.locations);
    }
    
    // Additional fields
    if (entity.aliases && entity.aliases.length > 0) {
        fieldsHtml += createProfileField('Aliases', entity.aliases.join(', '));
    }
    
    if (entity.confidence) {
        fieldsHtml += createProfileField('Confidence', entity.confidence);
    }
    
    profileFields.innerHTML = fieldsHtml || '<p>No additional details available.</p>';
}

// Create profile field HTML
function createProfileField(label, value) {
    return `
        <div class="profile-field">
            <div class="profile-field-label">${escapeHtml(label)}:</div>
            <div class="profile-field-value">${value}</div>
        </div>
    `;
}

// Get entity connections
function getEntityConnections(entity) {
    return knowledgeBaseData.connections.filter(connection => {
        // For events, match by event ID if available
        if (entity.type === 'event' && entity.id) {
            return connection.sourceEvent === entity.id;
        }
        
        // For other entities, match by name or ID
        const entityId = entity.id || entity.name;
        return (connection.fromEntityId === entityId || 
                connection.toEntityId === entityId ||
                connection.fromEntityId === entity.name ||
                connection.toEntityId === entity.name);
    });
}

// Get entity events
function getEntityEvents(entity) {
    if (entity.type === 'event') {
        return [entity];
    }
    
    const entityName = entity.name;
    return knowledgeBaseData.events.filter(event => {
        return event.actor === entityName || 
               event.target === entityName ||
               (event.locations && event.locations.includes(entityName));
    });
}

// Update network visualization
function updateNetworkVisualization(entity) {
    const svg = d3.select('#networkGraph');
    svg.selectAll('*').remove(); // Clear previous graph
    
    // Get network data
    const networkData = buildNetworkData(entity);
    
    if (networkData.nodes.length === 0) {
        svg.append('text')
            .attr('x', '50%')
            .attr('y', '50%')
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .style('fill', '#6b7280')
            .style('font-size', '16px')
            .text('No connections to display');
        return;
    }
    
    const width = 600;
    const height = 500;
    
    // Create force simulation
    const simulation = d3.forceSimulation(networkData.nodes)
        .force('link', d3.forceLink(networkData.links).id(d => d.id).distance(100))
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(30));
    
    // Create links
    const link = svg.selectAll('.link')
        .data(networkData.links)
        .enter().append('line')
        .attr('class', d => `link ${d.isMainConnection ? 'main-connection' : ''}`)
        .style('stroke', d => d.isMainConnection ? '#2563eb' : '#9ca3af')
        .style('stroke-width', d => d.isMainConnection ? 3 : 2);
    
    // Create nodes
    const node = svg.selectAll('.node')
        .data(networkData.nodes)
        .enter().append('circle')
        .attr('class', d => `node ${d.isMain ? 'main' : 'connected'}`)
        .attr('r', d => d.isMain ? 20 : 15)
        .style('fill', d => d.isMain ? '#dbeafe' : '#f3f4f6')
        .style('stroke', d => d.isMain ? '#2563eb' : '#9ca3af')
        .style('stroke-width', 2)
        .call(d3.drag()
            .on('start', dragStarted)
            .on('drag', dragged)
            .on('end', dragEnded))
        .on('click', (event, d) => {
            if (!d.isMain) {
                // Find and display the clicked entity
                const clickedEntity = findEntityByNameAndType(d.name, d.type);
                if (clickedEntity) {
                    displayEntityProfile(clickedEntity);
                }
            }
        });
    
    // Add node labels
    const nodeLabels = svg.selectAll('.node-label')
        .data(networkData.nodes)
        .enter().append('text')
        .attr('class', 'node-label')
        .style('display', showLabels ? 'block' : 'none')
        .text(d => d.name.length > 15 ? d.name.substring(0, 15) + '...' : d.name);
    
    // Add link labels
    const linkLabels = svg.selectAll('.link-label')
        .data(networkData.links)
        .enter().append('text')
        .attr('class', 'link-label')
        .style('display', showLabels ? 'block' : 'none')
        .text(d => d.relationship);
    
    // Update positions on tick
    simulation.on('tick', () => {
        link
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);
        
        node
            .attr('cx', d => d.x)
            .attr('cy', d => d.y);
        
        nodeLabels
            .attr('x', d => d.x)
            .attr('y', d => d.y + 30);
        
        linkLabels
            .attr('x', d => (d.source.x + d.target.x) / 2)
            .attr('y', d => (d.source.y + d.target.y) / 2);
    });
    
    // Store simulation for controls
    networkGraph = { simulation, svg, nodeLabels, linkLabels };
    
    // Drag functions
    function dragStarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }
    
    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }
    
    function dragEnded(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }
}

// Build network data for visualization
function buildNetworkData(mainEntity) {
    const nodes = [];
    const links = [];
    const nodeMap = new Map();
    
    // Add main entity node
    const mainNode = {
        id: mainEntity.id || mainEntity.name,
        name: mainEntity.name || mainEntity.sentence || 'Unnamed',
        type: mainEntity.type,
        isMain: true
    };
    nodes.push(mainNode);
    nodeMap.set(mainNode.id, mainNode);
    
    // Get direct connections
    const directConnections = getEntityConnections(mainEntity);
    
    // Add connected entities
    directConnections.forEach(connection => {
        const isFromMain = (connection.fromEntityId === mainNode.id || connection.fromEntityId === mainEntity.name);
        const connectedEntityId = isFromMain ? connection.toEntityId : connection.fromEntityId;
        const connectedEntityType = isFromMain ? connection.toEntityType : connection.fromEntityType;
        
        if (!nodeMap.has(connectedEntityId)) {
            const connectedEntity = findEntityByNameAndType(connectedEntityId, connectedEntityType);
            const connectedNode = {
                id: connectedEntityId,
                name: connectedEntity ? (connectedEntity.name || connectedEntity.sentence || connectedEntityId) : connectedEntityId,
                type: connectedEntityType,
                isMain: false
            };
            nodes.push(connectedNode);
            nodeMap.set(connectedEntityId, connectedNode);
        }
        
        // Add link
        links.push({
            source: isFromMain ? mainNode.id : connectedEntityId,
            target: isFromMain ? connectedEntityId : mainNode.id,
            relationship: connection.relationshipLabel || 'connected to',
            isMainConnection: true
        });
    });
    
    // Add second-degree connections (connections between connected entities)
    const connectedEntityIds = Array.from(nodeMap.keys()).filter(id => id !== mainNode.id);
    
    knowledgeBaseData.connections.forEach(connection => {
        const fromInNetwork = connectedEntityIds.includes(connection.fromEntityId);
        const toInNetwork = connectedEntityIds.includes(connection.toEntityId);
        
        if (fromInNetwork && toInNetwork) {
            // Both entities are already in the network, add the connection
            const existingLink = links.find(link => 
                (link.source === connection.fromEntityId && link.target === connection.toEntityId) ||
                (link.source === connection.toEntityId && link.target === connection.fromEntityId)
            );
            
            if (!existingLink) {
                links.push({
                    source: connection.fromEntityId,
                    target: connection.toEntityId,
                    relationship: connection.relationshipLabel || 'connected to',
                    isMainConnection: false
                });
            }
        }
    });
    
    return { nodes, links };
}

// Find entity by name and type
function findEntityByNameAndType(name, type) {
    const collection = type === 'person' ? 'people' : 
                      type === 'place' ? 'places' :
                      type === 'organization' ? 'organizations' :
                      type === 'event' ? 'events' : null;
    
    if (!collection || !knowledgeBaseData[collection]) return null;
    
    return knowledgeBaseData[collection].find(entity => 
        entity.name === name || entity.id === name || 
        (entity.sentence && entity.sentence === name)
    );
}

// Update connections list
function updateConnectionsList(entity) {
    const connectionsList = document.getElementById('connectionsList');
    if (!connectionsList) return;
    
    const connections = getEntityConnections(entity);
    
    if (connections.length === 0) {
        connectionsList.innerHTML = '<div class="no-results">No connections found for this entity.</div>';
        return;
    }
    
    const html = connections.map(connection => {
        const isFromEntity = (connection.fromEntityId === entity.id || 
                             connection.fromEntityId === entity.name);
        
        const fromName = isFromEntity ? (entity.name || 'This entity') : connection.fromEntityId;
        const toName = isFromEntity ? connection.toEntityId : (entity.name || 'This entity');
        const relationship = connection.relationshipLabel || 'connected to';
        
        return `
            <div class="connection-item">
                <div class="connection-entity">${escapeHtml(fromName)}</div>
                <div class="connection-relationship">${escapeHtml(relationship)}</div>
                <div class="connection-entity">${escapeHtml(toName)}</div>
            </div>
        `;
    }).join('');
    
    connectionsList.innerHTML = html;
}

// Initialize network controls
function initializeNetworkControls() {
    const resetZoom = document.getElementById('resetZoom');
    const centerGraph = document.getElementById('centerGraph');
    const toggleLabels = document.getElementById('toggleLabels');
    
    if (resetZoom) {
        resetZoom.addEventListener('click', () => {
            if (networkGraph && networkGraph.simulation) {
                networkGraph.simulation.alpha(1).restart();
            }
        });
    }
    
    if (centerGraph) {
        centerGraph.addEventListener('click', () => {
            if (networkGraph && networkGraph.simulation) {
                networkGraph.simulation
                    .force('center', d3.forceCenter(300, 250))
                    .alpha(1)
                    .restart();
            }
        });
    }
    
    if (toggleLabels) {
        toggleLabels.addEventListener('click', () => {
            showLabels = !showLabels;
            toggleLabels.textContent = showLabels ? 'Hide Labels' : 'Show Labels';
            toggleLabels.classList.toggle('active', showLabels);
            
            if (networkGraph) {
                networkGraph.nodeLabels.style('display', showLabels ? 'block' : 'none');
                networkGraph.linkLabels.style('display', showLabels ? 'block' : 'none');
            }
        });
    }
}

