// Main application entry point
import { generateDynamicFields } from './formBuilder.js';
import { processFormData, validateData } from './dataProcessor.js';
import { saveEntityToFirebase, loadEntitiesFromFirebase } from './firebaseOperations.js';
import { showStatus, createDataItem, setButtonLoading, clearDataDisplay, showDataDisplay } from './ui.js';
import { handleCSVUpload, createCSVTable, initializeDuplicateHandlers } from './csvHandler.js';
import { enrichCSVWithWikidata } from './wikidataIntegration.js';
// Approval queue functionality now integrated into CSV table
import { loadKnowledgeBase, initializeKnowledgeBase, initializeKnowledgeBaseListeners, getKnowledgeBaseData } from './knowledgeBase.js';

// DOM elements
const form = document.getElementById('dataForm');
const entityTypeInput = document.getElementById('entityType');
const dynamicFields = document.getElementById('dynamicFields');
const submitBtn = document.getElementById('submitBtn');
const statusDiv = document.getElementById('status');

// Auto-detection elements
const wikidataIdDetection = document.getElementById('wikidataIdDetection');
const entityTypeIndicator = document.getElementById('entityTypeIndicator');
const detectedType = document.getElementById('detectedType');
const manualTypeSelection = document.getElementById('manualTypeSelection');

// Tab elements
const csvTab = document.getElementById('csvTab');
const knowledgeBaseTab = document.getElementById('knowledgeBaseTab');
const csvSection = document.getElementById('csvSection');
const knowledgeBaseSection = document.getElementById('knowledgeBaseSection');

// Modal elements
const createEntryBtn = document.getElementById('createEntryBtn');
const manualEntryModal = document.getElementById('manualEntryModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const uploadZone = document.getElementById('uploadZone');
const csvFileInput = document.getElementById('csvFileInput');
const csvStatus = document.getElementById('csvStatus');
const csvDataDisplay = document.getElementById('csvDataDisplay');
const csvTableContainer = document.getElementById('csvTableContainer');
const csvEmptyState = document.getElementById('csvEmptyState');
const csvUploadArea = document.querySelector('.csv-upload-area');

// Approval queue functionality removed - now integrated into CSV table

// Global state
let currentCSVData = null;

// Check if an entity already exists in the knowledge base
function checkForDuplicateInKB(entityName, entityType, wikidataId = null) {
    
    const kbData = getKnowledgeBaseData();
    
    // Map entity types to knowledge base data keys
    const entityTypeMapping = {
        'person': 'people',
        'place': 'places', 
        'organization': 'organizations'
    };
    
    const kbKey = entityTypeMapping[entityType] || entityType + 's';
    const entities = kbData[kbKey] || [];
    
    
    // Check for exact name match
    const exactMatch = entities.find(entity => 
        entity.name && entity.name.toLowerCase() === entityName.toLowerCase()
    );
    
    if (exactMatch) {
        return { type: 'exact', entity: exactMatch };
    }
    
    // Check for alias match
    const aliasMatch = entities.find(entity => 
        entity.aliases && entity.aliases.some(alias => 
            alias.toLowerCase() === entityName.toLowerCase()
        )
    );
    
    if (aliasMatch) {
        return { type: 'alias', entity: aliasMatch };
    }
    
    // Check for Wikidata ID match (ONLY if we have a Wikidata ID to compare)
    if (wikidataId) {
        const wikidataMatch = entities.find(entity => 
            entity.wikidata_id && entity.wikidata_id === wikidataId
        );
        
        if (wikidataMatch) {
            return { type: 'wikidata', entity: wikidataMatch };
        }
    }
    
    return null;
}

// Filter out duplicates from enriched data
function filterOutDuplicates(enrichedData) {
    const filteredData = {
        people: [],
        places: [],
        organizations: [],
        unknown: [...enrichedData.unknown] // Keep unknown entities as-is
    };
    
    const duplicates = [];
    
    // Check each entity type
    ['people', 'places', 'organizations'].forEach(entityType => {
        const entities = enrichedData[entityType] || [];
        
        entities.forEach(entity => {
            const entityName = entity.name || entity.originalName;
            const wikidataId = entity.wikidata_id || null;
            
            // Map plural entity types to singular
            const pluralToSingular = {
                'people': 'person',
                'places': 'place',
                'organizations': 'organization'
            };
            const singularType = pluralToSingular[entityType] || entityType.slice(0, -1);
            
            
            const duplicate = checkForDuplicateInKB(entityName, singularType, wikidataId);
            
            if (duplicate) {
                duplicates.push({
                    csvEntity: entity,
                    kbEntity: duplicate.entity,
                    matchType: duplicate.type,
                    entityType: singularType,
                    originalName: entityName
                });
            } else {
                // No duplicate, add to approval queue
                filteredData[entityType].push(entity);
            }
        });
    });
    
    
    return { filteredData, duplicates };
}

// Update CSV table to highlight duplicates and new entities
function updateCSVTableWithEntities(csvData, duplicates, newEntities) {
    // Create a map of entity names to duplicate info for quick lookup
    const duplicateMap = new Map();
    duplicates.forEach(dup => {
        duplicateMap.set(dup.originalName.toLowerCase(), dup);
    });
    
    // Create a map of entity names to new entity info for quick lookup
    const newEntityMap = new Map();
    newEntities.forEach(entity => {
        const originalName = getOriginalEntityName(entity);
        newEntityMap.set(originalName.toLowerCase(), {
            entity: entity.entity || entity,
            originalName: originalName,
            entityType: entity.entityType || entity.type
        });
    });
    
    // Store entity info for CSV table rendering
    csvData.duplicates = duplicateMap;
    csvData.newEntities = newEntityMap;
    
    // Re-render the CSV table with entity highlighting
    displayCSVData(csvData);
}

// Get original name from entity (for backwards compatibility)
function getOriginalEntityName(entity) {
    if (entity.originalName) return entity.originalName;
    if (entity.entity && entity.entity.aliases && entity.entity.aliases.length > 0) {
        return entity.entity.aliases[0];
    }
    return entity.entity ? entity.entity.name : entity.name || 'Unknown';
}

// Event handlers - removed old entity type tab handling

// Auto-detect entity type from Wikidata ID
async function handleWikidataDetection() {
    const wikidataId = wikidataIdDetection.value.trim();
    
    if (!wikidataId) {
        // Clear form if no Wikidata ID and show manual selection
        clearDynamicFields();
        hideEntityTypeIndicator();
        showManualTypeSelection();
        return;
    }
    
    // Validate Wikidata ID format (should be Q followed by numbers)
    if (!/^Q\d+$/i.test(wikidataId)) {
        showEntityTypeIndicator('Invalid Wikidata ID format', 'error');
        return;
    }
    
    try {
        showEntityTypeIndicator('Detecting entity type...', 'loading');
        
        // Import the function we need
        const { getWikidataEntityDetails } = await import('./wikidataIntegration.js');
        
        // Get entity details from Wikidata
        const entityDetails = await getWikidataEntityDetails(wikidataId.toUpperCase(), '');
        
        if (!entityDetails || !entityDetails.found) {
            showEntityTypeIndicator('Entity not found on Wikidata', 'error');
            clearDynamicFields();
            return;
        }
        
        const detectedEntityType = entityDetails.entityType;
        
        // Update the form based on detected type
        if (detectedEntityType && ['person', 'place', 'organization'].includes(detectedEntityType)) {
            const entityTypeMapping = {
                'person': 'people',
                'place': 'places', 
                'organization': 'organizations'
            };
            
            const formEntityType = entityTypeMapping[detectedEntityType];
            entityTypeInput.value = formEntityType;
            
            // Show detected type
            const typeLabels = {
                'people': '👤 Person',
                'places': '📍 Place',
                'organizations': '🏢 Organization'
            };
            
            showEntityTypeIndicator(`Detected: ${typeLabels[formEntityType]}`, 'success');
            hideManualTypeSelection();
            
            // Generate form fields for the detected type
            generateDynamicFields(formEntityType, dynamicFields);
            
            // Auto-fill the form with Wikidata data
            setTimeout(() => {
                const wikidataInput = document.getElementById('wikidata_id');
                if (wikidataInput) {
                    wikidataInput.value = wikidataId.toUpperCase();
                    // Trigger the autofill
                    wikidataInput.dispatchEvent(new Event('blur'));
                }
            }, 100);
            
        } else {
            showEntityTypeIndicator('Could not determine entity type', 'error');
            clearDynamicFields();
        }
        
    } catch (error) {
        console.error('Error detecting entity type:', error);
        showEntityTypeIndicator('Error detecting entity type', 'error');
        clearDynamicFields();
    }
}

// Helper functions for entity type indicator
function showEntityTypeIndicator(message, type) {
    if (entityTypeIndicator && detectedType) {
        detectedType.textContent = message;
        entityTypeIndicator.className = `entity-type-indicator ${type}`;
        entityTypeIndicator.classList.remove('hidden');
    }
}

function hideEntityTypeIndicator() {
    if (entityTypeIndicator) {
        entityTypeIndicator.classList.add('hidden');
    }
}

function clearDynamicFields() {
    if (dynamicFields) {
        dynamicFields.innerHTML = '';
    }
    entityTypeInput.value = '';
}

function showManualTypeSelection() {
    if (manualTypeSelection) {
        manualTypeSelection.classList.remove('hidden');
    }
}

function hideManualTypeSelection() {
    if (manualTypeSelection) {
        manualTypeSelection.classList.add('hidden');
    }
}

// Handle manual entity type selection
function handleManualTypeSelection(entityType) {
    entityTypeInput.value = entityType;
    
    const typeLabels = {
        'people': '👤 Person',
        'places': '📍 Place',
        'organizations': '🏢 Organization'
    };
    
    showEntityTypeIndicator(`Selected: ${typeLabels[entityType]}`, 'success');
    hideManualTypeSelection();
    
    // Generate form fields for the selected type
    generateDynamicFields(entityType, dynamicFields);
}

async function handleSubmit(e) {
    e.preventDefault();
    
    const entityType = entityTypeInput.value;
    if (!entityType) {
        showStatus('Please enter a Wikidata ID to detect entity type, or manually enter entity information.', 'error', statusDiv);
        return;
    }
    
    try {
        setButtonLoading(submitBtn, true, 'Save Entry', 'Saving...');
        
        const formData = new FormData(form);
        const data = processFormData(formData, entityType);
        
        // Validate data
        const validation = validateData(data, entityType);
        if (!validation.isValid) {
            showStatus(validation.error, 'error', statusDiv);
            return;
        }
        
        // Save to Firebase
        const docRef = await saveEntityToFirebase(data, entityType);
        
        console.log('Document written with ID: ', docRef.id);
        showStatus(`Successfully saved ${data.type}. Document ID: ${docRef.id}`, 'success', statusDiv);
        
        // Reset form after successful submission
        form.reset();
        clearDynamicFields();
        hideEntityTypeIndicator();
        showManualTypeSelection();
        
        // Close modal after successful submission
        setTimeout(() => {
            closeModal();
            // Switch to knowledge base tab to show the new entry
            switchToKnowledgeBaseTab();
        }, 1500);
        
    } catch (error) {
        console.error('Error adding document: ', error);
        showStatus(`Error saving to Firebase: ${error.message}`, 'error', statusDiv);
    } finally {
        setButtonLoading(submitBtn, false, 'Save Entry', 'Saving...');
    }
}


// Modal functions
function openModal() {
    if (manualEntryModal) {
        manualEntryModal.classList.add('show');
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
        
        // Reset form state when opening
        clearDynamicFields();
        hideEntityTypeIndicator();
        showManualTypeSelection();
        
    } else {
        console.error('❌ Modal element not found!');
    }
}

function closeModal() {
    manualEntryModal.classList.remove('show');
    document.body.style.overflow = ''; // Restore scrolling
}

// Tab switching handlers
function switchToCSVTab() {
    // Update tab states
    csvTab.classList.add('active');
    knowledgeBaseTab.classList.remove('active');
    
    // Update section visibility
    csvSection.classList.add('active');
    knowledgeBaseSection.classList.remove('active');
}


function switchToKnowledgeBaseTab() {
    // Update tab states
    knowledgeBaseTab.classList.add('active');
    csvTab.classList.remove('active');
    
    // Update section visibility
    knowledgeBaseSection.classList.add('active');
    csvSection.classList.remove('active');
    
    // Load knowledge base data when switching to this tab
    loadKnowledgeBase();
}


// Make modal functions available globally for debugging
window.openModal = openModal;
window.closeModal = closeModal;

// CSV upload handlers
function handleUploadZoneClick() {
    csvFileInput.click();
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        processCSVFile(file);
    }
}

function handleDragOver(event) {
    event.preventDefault();
    uploadZone.classList.add('dragover');
}

function handleDragLeave(event) {
    event.preventDefault();
    uploadZone.classList.remove('dragover');
}

function handleDrop(event) {
    event.preventDefault();
    uploadZone.classList.remove('dragover');
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
        processCSVFile(files[0]);
    }
}

async function processCSVFile(file) {
    try {
        csvStatus.style.display = 'none';
        
        const result = await handleCSVUpload(file, csvStatus);
        
        if (result.success) {
            currentCSVData = result;
            displayCSVData(result);
            showStatus(`Successfully loaded ${result.totalRows} rows from ${file.name}`, 'success', csvStatus);
            
            // Load knowledge base first to check for duplicates
            await loadKnowledgeBase();
            
            // Start Wikidata enrichment process
            showStatus(`Processing Wikidata enrichment for ${result.totalRows} rows...`, 'success', csvStatus);
            
            try {
                const enrichedData = await enrichCSVWithWikidata(result);
                
                // Check for duplicates in knowledge base 
                const { filteredData, duplicates } = filterOutDuplicates(enrichedData);
                
                // Prepare new entities for inline approval in CSV table
                const newEntitiesList = [
                    ...filteredData.people.map(entity => ({ entity, entityType: 'person', originalName: getOriginalEntityName({ entity }) })),
                    ...filteredData.places.map(entity => ({ entity, entityType: 'place', originalName: getOriginalEntityName({ entity }) })),
                    ...filteredData.organizations.map(entity => ({ entity, entityType: 'organization', originalName: getOriginalEntityName({ entity }) })),
                    ...enrichedData.unknown.map(entity => ({ entity: null, entityType: 'unknown', originalName: entity.originalName })),
                    ...(enrichedData.notFound || []).map(entity => ({ entity: null, entityType: 'unknown', originalName: entity.originalName }))
                ];
                
                // Update CSV table to show both duplicates and new entities inline
                updateCSVTableWithEntities(result, duplicates, newEntitiesList);
                
                // Update status with enrichment results
                const totalFound = enrichedData.people.length + enrichedData.places.length + enrichedData.organizations.length;
                const totalUnknown = enrichedData.unknown.length;
                const totalNotFound = (enrichedData.notFound || []).length;
                const newEntitiesCount = newEntitiesList.length;
                const duplicateCount = duplicates.length;
                
                let statusMessage = `✅ CSV loaded with ${result.totalRows} rows. Found ${totalFound} entities in Wikidata`;
                if (totalUnknown > 0 || totalNotFound > 0) {
                    statusMessage += `, ${totalUnknown + totalNotFound} entities need manual review`;
                }
                statusMessage += `.`;
                if (duplicateCount > 0 || newEntitiesCount > 0) {
                    statusMessage += ` ${duplicateCount} duplicates found, ${newEntitiesCount} new entities ready for review.`;
                }
                showStatus(statusMessage, 'success', csvStatus);
                
                
            } catch (enrichmentError) {
                console.error('Wikidata enrichment error:', enrichmentError);
                showStatus(`CSV loaded successfully, but Wikidata enrichment failed: ${enrichmentError.message}`, 'error', csvStatus);
            }
        }
    } catch (error) {
        console.error('CSV processing error:', error);
        showStatus(`Error processing CSV: ${error.message}`, 'error', csvStatus);
        currentCSVData = null;
    }
}

function displayCSVData(csvData) {
    if (!csvData || !csvData.data || csvData.data.length === 0) {
        csvTableContainer.innerHTML = '';
        csvEmptyState.style.display = 'block';
        return;
    }
    
    const tableHTML = createCSVTable(csvData);
    csvTableContainer.innerHTML = tableHTML;
    
    // Initialize duplicate entity click handlers
    initializeDuplicateHandlers();
    
    // Hide empty state - data is now shown in the same CSV tab
    csvEmptyState.style.display = 'none';
    
    // Hide upload area after successful CSV upload
    if (csvUploadArea) {
        csvUploadArea.style.display = 'none';
    }
    
    // Show the data display section
    const csvDataDisplay = document.getElementById('csvDataDisplay');
    if (csvDataDisplay) {
        csvDataDisplay.style.display = 'block';
    }
}


// Initialize event listeners
function initializeEventListeners() {
    
    // Modal listeners
    if (createEntryBtn) {
        createEntryBtn.addEventListener('click', openModal);
    } else {
        console.error('❌ Create Entry button not found!');
    }
    
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeModal);
    } else {
        console.error('❌ Close Modal button not found!');
    }
    
    // Close modal when clicking outside
    if (manualEntryModal) {
        manualEntryModal.addEventListener('click', (e) => {
            if (e.target === manualEntryModal) {
                closeModal();
            }
        });
    }
    
    // Close modal with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && manualEntryModal && manualEntryModal.classList.contains('show')) {
            closeModal();
        }
    });
    
    // Manual form listeners
    if (wikidataIdDetection) {
        wikidataIdDetection.addEventListener('input', handleWikidataDetection);
        wikidataIdDetection.addEventListener('blur', handleWikidataDetection);
    }
    
    // Manual type selection listeners
    document.querySelectorAll('.manual-type-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const entityType = e.target.getAttribute('data-type');
            if (entityType) {
                handleManualTypeSelection(entityType);
            }
        });
    });
    
    form.addEventListener('submit', handleSubmit);
    
    // Tab listeners
    csvTab.addEventListener('click', switchToCSVTab);
    knowledgeBaseTab.addEventListener('click', switchToKnowledgeBaseTab);
    
    // CSV upload listeners
    uploadZone.addEventListener('click', handleUploadZoneClick);
    csvFileInput.addEventListener('change', handleFileSelect);
    uploadZone.addEventListener('dragover', handleDragOver);
    uploadZone.addEventListener('dragleave', handleDragLeave);
    uploadZone.addEventListener('drop', handleDrop);
    
    // Approval queue functionality removed - now handled inline in CSV table
    
    // Initialize knowledge base listeners
    initializeKnowledgeBaseListeners();
}

// Initialize the application
function initializeApp() {
    initializeEventListeners();
    
    // Start with CSV tab active
    switchToCSVTab();
    
    showStatus('Ready to upload CSV files and create knowledge base entries!', 'success', document.getElementById('csvStatus'));
}

// Start the app when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApp);
