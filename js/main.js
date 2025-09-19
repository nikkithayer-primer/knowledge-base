// Main application entry point
import { generateDynamicFields } from './formBuilder.js';
import { processFormData, validateData } from './dataProcessor.js';
import { saveEntityToFirebase, loadEntitiesFromFirebase } from './firebaseOperations.js';
import { showStatus, createDataItem, setButtonLoading, clearDataDisplay, showDataDisplay } from './ui.js';
import { handleCSVUpload, createCSVTable, initializeDuplicateHandlers } from './csvHandler.js';
import { enrichCSVWithWikidata } from './wikidataIntegration.js';
import { initializeApprovalQueue, renderApprovalQueue, handleApproveAll, handleRejectAll } from './approvalQueue.js';
import { loadKnowledgeBase, initializeKnowledgeBaseListeners, getKnowledgeBaseData } from './knowledgeBase.js';

// DOM elements
const form = document.getElementById('dataForm');
const entityTypeInput = document.getElementById('entityType');
const dynamicFields = document.getElementById('dynamicFields');
const submitBtn = document.getElementById('submitBtn');
const loadBtn = document.getElementById('loadBtn');
const resetBtn = document.getElementById('resetBtn');
const statusDiv = document.getElementById('status');

// Entity type tabs
const peopleEntityTab = document.getElementById('peopleEntityTab');
const placesEntityTab = document.getElementById('placesEntityTab');
const organizationsEntityTab = document.getElementById('organizationsEntityTab');

// CSV elements
const manualTab = document.getElementById('manualTab');
const csvTab = document.getElementById('csvTab');
const approvalTab = document.getElementById('approvalTab');
const knowledgeBaseTab = document.getElementById('knowledgeBaseTab');
const manualSection = document.getElementById('manualSection');
const csvSection = document.getElementById('csvSection');
const approvalSection = document.getElementById('approvalSection');
const knowledgeBaseSection = document.getElementById('knowledgeBaseSection');
const uploadZone = document.getElementById('uploadZone');
const csvFileInput = document.getElementById('csvFileInput');
const csvStatus = document.getElementById('csvStatus');
const csvDataDisplay = document.getElementById('csvDataDisplay');
const csvTableContainer = document.getElementById('csvTableContainer');
const csvEmptyState = document.getElementById('csvEmptyState');
const clearCsvBtn = document.getElementById('clearCsvBtn');

// Approval queue elements
const approveAllBtn = document.getElementById('approveAllBtn');
const rejectAllBtn = document.getElementById('rejectAllBtn');

// Global state
let currentCSVData = null;

// Check if an entity already exists in the knowledge base
function checkForDuplicateInKB(entityName, entityType) {
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
    
    // Check for Wikidata ID match (if available)
    const wikidataMatch = entities.find(entity => 
        entity.wikidata_id && entity.id && entity.id.includes('wikidata_')
    );
    
    if (wikidataMatch) {
        return { type: 'wikidata', entity: wikidataMatch };
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
            
            // Map plural entity types to singular
            const pluralToSingular = {
                'people': 'person',
                'places': 'place',
                'organizations': 'organization'
            };
            const singularType = pluralToSingular[entityType] || entityType.slice(0, -1);
            
            const duplicate = checkForDuplicateInKB(entityName, singularType);
            
            if (duplicate) {
                duplicates.push({
                    csvEntity: entity,
                    kbEntity: duplicate.entity,
                    matchType: duplicate.type,
                    entityType: singularType,
                    originalName: entityName
                });
                console.log(`🔍 Duplicate found: ${entityName} (${duplicate.type} match)`);
            } else {
                // No duplicate, add to approval queue
                filteredData[entityType].push(entity);
            }
        });
    });
    
    console.log(`📋 Duplicate check complete: ${duplicates.length} duplicates found, ${filteredData.people.length + filteredData.places.length + filteredData.organizations.length} entities for approval`);
    
    return { filteredData, duplicates };
}

// Update CSV table to highlight duplicates
function updateCSVTableWithDuplicates(csvData, duplicates) {
    // Create a map of entity names to duplicate info for quick lookup
    const duplicateMap = new Map();
    duplicates.forEach(dup => {
        duplicateMap.set(dup.originalName.toLowerCase(), dup);
    });
    
    // Store duplicate info for CSV table rendering
    csvData.duplicates = duplicateMap;
    
    // Re-render the CSV table with duplicate highlighting
    displayCSVData(csvData);
}

// Event handlers
function handleEntityTypeChange(newEntityType) {
    // Update hidden input
    entityTypeInput.value = newEntityType;
    
    // Update tab states
    document.querySelectorAll('.entity-tab-button').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-entity-type="${newEntityType}"]`).classList.add('active');
    
    // Generate new fields
    generateDynamicFields(newEntityType, dynamicFields);
}

function handleEntityTabClick(event) {
    const entityType = event.target.getAttribute('data-entity-type');
    if (entityType) {
        handleEntityTypeChange(entityType);
    }
}

async function handleSubmit(e) {
    e.preventDefault();
    
    const entityType = entityTypeInput.value;
    if (!entityType) {
        showStatus('Please select an entity type.', 'error', statusDiv);
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
        generateDynamicFields(entityType, dynamicFields);
        
        // Auto-load data to show the new entry
        setTimeout(() => handleLoadData(), 1000);
        
    } catch (error) {
        console.error('Error adding document: ', error);
        showStatus(`Error saving to Firebase: ${error.message}`, 'error', statusDiv);
    } finally {
        setButtonLoading(submitBtn, false, 'Save Entry', 'Saving...');
    }
}

async function handleLoadData() {
    const entityType = entityTypeInput.value;
    if (!entityType) {
        showStatus('Please select an entity type to load data.', 'error', statusDiv);
        return;
    }
    
    try {
        setButtonLoading(loadBtn, true, 'Load Data', 'Loading...');
        
        const entities = await loadEntitiesFromFirebase(entityType);
        
        if (entities.length === 0) {
            showStatus(`No ${entityType} found in the database.`, 'error', statusDiv);
            return;
        }
        
        showStatus(`Loaded ${entities.length} ${entityType} from the database.`, 'success', statusDiv);
        
    } catch (error) {
        console.error('Error loading data: ', error);
        showStatus(`Error loading data: ${error.message}`, 'error', statusDiv);
    } finally {
        setButtonLoading(loadBtn, false, 'Load Data', 'Loading...');
    }
}

function handleReset() {
    form.reset();
    dynamicFields.innerHTML = '';
    statusDiv.style.display = 'none';
    showStatus('Form reset successfully.', 'success', statusDiv);
}

// Tab switching handlers
function switchToManualTab() {
    // Update tab states
    manualTab.classList.add('active');
    csvTab.classList.remove('active');
    approvalTab.classList.remove('active');
    knowledgeBaseTab.classList.remove('active');
    
    // Update section visibility
    manualSection.classList.add('active');
    csvSection.classList.remove('active');
    approvalSection.classList.remove('active');
    knowledgeBaseSection.classList.remove('active');
}

function switchToCSVTab() {
    // Update tab states
    csvTab.classList.add('active');
    manualTab.classList.remove('active');
    approvalTab.classList.remove('active');
    knowledgeBaseTab.classList.remove('active');
    
    // Update section visibility
    csvSection.classList.add('active');
    manualSection.classList.remove('active');
    approvalSection.classList.remove('active');
    knowledgeBaseSection.classList.remove('active');
}

function switchToApprovalTab() {
    // Check if approval tab is disabled
    if (approvalTab.classList.contains('disabled')) {
        return; // Don't switch to disabled tab
    }
    
    // Update tab states
    approvalTab.classList.add('active');
    manualTab.classList.remove('active');
    csvTab.classList.remove('active');
    knowledgeBaseTab.classList.remove('active');
    
    // Update section visibility
    approvalSection.classList.add('active');
    manualSection.classList.remove('active');
    csvSection.classList.remove('active');
    knowledgeBaseSection.classList.remove('active');
}

function switchToKnowledgeBaseTab() {
    // Update tab states
    knowledgeBaseTab.classList.add('active');
    manualTab.classList.remove('active');
    csvTab.classList.remove('active');
    approvalTab.classList.remove('active');
    
    // Update section visibility
    knowledgeBaseSection.classList.add('active');
    manualSection.classList.remove('active');
    csvSection.classList.remove('active');
    approvalSection.classList.remove('active');
    
    // Load knowledge base data when switching to this tab
    loadKnowledgeBase();
}

// Update approval tab state based on content availability
function updateApprovalTabState(hasContent) {
    if (hasContent) {
        // Enable the approval tab
        approvalTab.classList.remove('disabled');
        approvalTab.style.opacity = '1';
        approvalTab.style.cursor = 'pointer';
        approvalTab.title = '';
    } else {
        // Disable the approval tab
        approvalTab.classList.add('disabled');
        approvalTab.style.opacity = '0.5';
        approvalTab.style.cursor = 'not-allowed';
        approvalTab.title = 'Upload a CSV file to populate the approval queue';
        
        // If currently on approval tab, switch to CSV tab
        if (approvalTab.classList.contains('active')) {
            switchToCSVTab();
        }
    }
}

// Make updateApprovalTabState available globally for approvalQueue.js
window.updateApprovalTabState = updateApprovalTabState;

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
            console.log('\n🔍 Loading knowledge base for duplicate checking...');
            await loadKnowledgeBase();
            
            // Start Wikidata enrichment process
            console.log('\n🚀 Starting Wikidata enrichment for uploaded CSV...');
            showStatus(`Processing Wikidata enrichment for ${result.totalRows} rows...`, 'success', csvStatus);
            
            try {
                const enrichedData = await enrichCSVWithWikidata(result);
                
                // Check for duplicates in knowledge base before adding to approval queue
                const { filteredData, duplicates } = filterOutDuplicates(enrichedData);
                
                // Initialize approval queue with filtered data (no duplicates)
                const approvalQueue = initializeApprovalQueue(filteredData);
                renderApprovalQueue();
                
                // Update CSV table to show duplicates differently
                if (duplicates.length > 0) {
                    updateCSVTableWithDuplicates(result, duplicates);
                }
                
                // Update status with enrichment results
                const totalFound = enrichedData.people.length + enrichedData.places.length + enrichedData.organizations.length;
                const newEntities = filteredData.people.length + filteredData.places.length + filteredData.organizations.length;
                const duplicateCount = duplicates.length;
                
                let statusMessage = `✅ CSV loaded with ${result.totalRows} rows. Found ${totalFound} entities.`;
                if (duplicateCount > 0) {
                    statusMessage += ` ${duplicateCount} duplicates found, ${newEntities} new entities for review.`;
                } else {
                    statusMessage += ` ${newEntities} entities for review in Approval Queue.`;
                }
                showStatus(statusMessage, 'success', csvStatus);
                
                // Update approval tab state based on content
                updateApprovalTabState(newEntities > 0);
                
                console.log(`🎉 Wikidata enrichment complete! ${totalFound} entities ready for approval.`);
                
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
    
    // Show the data display section
    const csvDataDisplay = document.getElementById('csvDataDisplay');
    if (csvDataDisplay) {
        csvDataDisplay.style.display = 'block';
    }
}

// Clear CSV data
function clearCSVData() {
    currentCSVData = null;
    csvTableContainer.innerHTML = '';
    csvDataDisplay.style.display = 'none';
    csvEmptyState.style.display = 'block';
    csvStatus.style.display = 'none';
    
    // Reset file input
    csvFileInput.value = '';
    
    // Disable approval tab since no data is available
    updateApprovalTabState(false);
    
    console.log('📄 CSV data cleared');
}

// Initialize event listeners
function initializeEventListeners() {
    // Manual form listeners
    peopleEntityTab.addEventListener('click', handleEntityTabClick);
    placesEntityTab.addEventListener('click', handleEntityTabClick);
    organizationsEntityTab.addEventListener('click', handleEntityTabClick);
    form.addEventListener('submit', handleSubmit);
    loadBtn.addEventListener('click', handleLoadData);
    resetBtn.addEventListener('click', handleReset);
    
    // Tab listeners
    manualTab.addEventListener('click', switchToManualTab);
    csvTab.addEventListener('click', switchToCSVTab);
    approvalTab.addEventListener('click', switchToApprovalTab);
    knowledgeBaseTab.addEventListener('click', switchToKnowledgeBaseTab);
    
    // CSV upload listeners
    uploadZone.addEventListener('click', handleUploadZoneClick);
    csvFileInput.addEventListener('change', handleFileSelect);
    uploadZone.addEventListener('dragover', handleDragOver);
    uploadZone.addEventListener('dragleave', handleDragLeave);
    uploadZone.addEventListener('drop', handleDrop);
    
    // CSV clear button
    if (clearCsvBtn) {
        clearCsvBtn.addEventListener('click', clearCSVData);
    }
    
    // Approval queue listeners
    approveAllBtn.addEventListener('click', handleApproveAll);
    rejectAllBtn.addEventListener('click', handleRejectAll);
    
    // Initialize knowledge base listeners
    initializeKnowledgeBaseListeners();
}

// Initialize the application
function initializeApp() {
    console.log('Knowledge Base Firebase Writer loaded');
    initializeEventListeners();
    
    // Initialize with default entity type (people)
    handleEntityTypeChange('people');
    
    // Initialize approval tab as disabled
    updateApprovalTabState(false);
    
    showStatus('Ready to create knowledge base entries!', 'success', statusDiv);
}

// Start the app when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApp);
