// Wikidata integration for entity enrichment
import { escapeHtml } from './dataProcessor.js';

// Wikidata SPARQL endpoint
const WIKIDATA_ENDPOINT = 'https://query.wikidata.org/sparql';
const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';

// Cache for Wikidata results to avoid duplicate requests
const wikidataCache = new Map();

// Extract unique entities from CSV data
export function extractEntitiesFromCSV(csvData) {
    if (!csvData || !csvData.data) return [];
    
    const entities = new Set();
    
    csvData.data.forEach(row => {
        // Extract from Actor column
        if (row.Actor && row.Actor.trim()) {
            entities.add(row.Actor.trim());
        }
        
        // Extract from Target column
        if (row.Target && row.Target.trim()) {
            entities.add(row.Target.trim());
        }
        
        // Extract from Locations column (may contain multiple locations)
        if (row.Locations && row.Locations.trim()) {
            const locations = row.Locations.split(',');
            locations.forEach(location => {
                const cleanLocation = location.trim();
                if (cleanLocation) {
                    entities.add(cleanLocation);
                }
            });
        }
    });
    
    return Array.from(entities).filter(entity => entity.length > 0);
}

// Search Wikidata for an entity
export async function searchWikidataEntity(entityName) {
    // Check cache first
    if (wikidataCache.has(entityName)) {
        return wikidataCache.get(entityName);
    }
    
    try {
        // First, search for the entity to get potential matches
        const searchUrl = `${WIKIDATA_API}?action=wbsearchentities&search=${encodeURIComponent(entityName)}&language=en&format=json&origin=*&limit=3`;
        
        const searchResponse = await fetch(searchUrl);
        const searchData = await searchResponse.json();
        
        if (!searchData.search || searchData.search.length === 0) {
            console.log(`No Wikidata results found for: ${entityName}`);
            wikidataCache.set(entityName, null);
            return null;
        }
        
        // Get detailed information for the best match
        const bestMatch = searchData.search[0];
        const entityId = bestMatch.id;
        
        const detailedInfo = await getWikidataEntityDetails(entityId, entityName);
        
        wikidataCache.set(entityName, detailedInfo);
        return detailedInfo;
        
    } catch (error) {
        console.error(`Error searching Wikidata for ${entityName}:`, error);
        wikidataCache.set(entityName, null);
        return null;
    }
}

// Get detailed information about a Wikidata entity
export async function getWikidataEntityDetails(entityId, originalName) {
    try {
        // SPARQL query to get comprehensive information including ALL instanceOf values
        const sparqlQuery = `
            SELECT DISTINCT ?item ?itemLabel ?itemDescription ?instanceOf ?instanceOfLabel 
                   ?countryLabel ?locationLabel ?occupationLabel ?employerLabel 
                   ?birthDate ?founded ?population ?coordinates ?wikidataId
            WHERE {
                VALUES ?item { wd:${entityId} }
                
                OPTIONAL { ?item wdt:P31 ?instanceOf . }
                OPTIONAL { ?item wdt:P17 ?country . }
                OPTIONAL { ?item wdt:P131 ?location . }
                OPTIONAL { ?item wdt:P106 ?occupation . }
                OPTIONAL { ?item wdt:P108 ?employer . }
                OPTIONAL { ?item wdt:P569 ?birthDate . }
                OPTIONAL { ?item wdt:P571 ?founded . }
                OPTIONAL { ?item wdt:P1082 ?population . }
                OPTIONAL { ?item wdt:P625 ?coordinates . }
                
                BIND(STRAFTER(STR(?item), "http://www.wikidata.org/entity/") AS ?wikidataId)
                
                SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
            }
        `;
        
        const sparqlUrl = `${WIKIDATA_ENDPOINT}?query=${encodeURIComponent(sparqlQuery)}&format=json`;
        
        const response = await fetch(sparqlUrl);
        const data = await response.json();
        
        if (!data.results || !data.results.bindings || data.results.bindings.length === 0) {
            return {
                originalName,
                wikidataId: entityId,
                found: false,
                entityType: 'unknown'
            };
        }
        
        // Process all bindings to collect all instanceOf values and other data
        return processWikidataResults(data.results.bindings, originalName);
        
    } catch (error) {
        console.error(`Error getting details for ${entityId}:`, error);
        return {
            originalName,
            wikidataId: entityId,
            found: false,
            entityType: 'unknown',
            error: error.message
        };
    }
}

// Process multiple Wikidata SPARQL results into our entity format
function processWikidataResults(bindings, originalName) {
    if (!bindings || bindings.length === 0) {
        return {
            originalName,
            found: false,
            entityType: 'unknown'
        };
    }
    
    // Collect all instanceOf values from all bindings
    const instanceOfValues = [];
    let primaryBinding = bindings[0]; // Use first binding for other properties
    
    bindings.forEach(binding => {
        if (binding.instanceOfLabel?.value) {
            instanceOfValues.push(binding.instanceOfLabel.value);
        }
    });
    
    console.log('🔍 All instanceOf values found:', instanceOfValues);
    
    // Determine entity type from all instance values
    const entityType = determineEntityTypeFromMultiple(instanceOfValues);
    
    return processWikidataResult(primaryBinding, originalName, entityType, instanceOfValues);
}

// Process single Wikidata SPARQL result with predetermined entity type
function processWikidataResult(binding, originalName, entityType = null, allInstanceOf = []) {
    // If entityType not provided, determine from single instanceOf value (legacy)
    if (!entityType) {
        const instanceOfValue = binding.instanceOfLabel?.value;
        entityType = determineEntityType(instanceOfValue);
    }
    
    console.log('🔍 Processing Wikidata result:');
    console.log('🔍 Original name:', originalName);
    console.log('🔍 All instance types:', allInstanceOf.length > 0 ? allInstanceOf : [binding.instanceOfLabel?.value]);
    console.log('🔍 Determined entity type:', entityType);
    
    const result = {
        originalName,
        wikidataId: binding.wikidataId?.value || '',
        found: true,
        name: binding.itemLabel?.value || originalName,
        description: binding.itemDescription?.value || '',
        entityType: entityType,
        instanceOf: allInstanceOf.length > 0 ? allInstanceOf.join('; ') : (binding.instanceOfLabel?.value || '')
    };
    
    // Add type-specific fields based on entity type
    if (result.entityType === 'person') {
        result.person = {
            id: `wikidata_${result.wikidataId}`,
            name: result.name,
            aliases: [originalName],
            type: 'person',
            occupation: binding.occupationLabel?.value || '',
            currentEmployer: binding.employerLabel?.value || '',
            dateOfBirth: binding.birthDate?.value || '',
            wikidata_id: result.wikidataId,
            description: result.description
        };
    } else if (result.entityType === 'place') {
        result.place = {
            id: `wikidata_${result.wikidataId}`,
            name: result.name,
            aliases: [originalName],
            type: 'place',
            category: binding.instanceOfLabel?.value || 'place',
            country: binding.countryLabel?.value || '',
            state: binding.locationLabel?.value || '',
            population: binding.population?.value ? parseInt(binding.population.value) : null,
            founded: binding.founded?.value ? new Date(binding.founded.value).getFullYear() : null,
            coordinates: parseCoordinates(binding.coordinates?.value),
            wikidata_id: result.wikidataId,
            description: result.description
        };
    } else if (result.entityType === 'organization') {
        result.organization = {
            id: `wikidata_${result.wikidataId}`,
            name: result.name,
            aliases: [originalName],
            type: 'organization',
            category: binding.instanceOfLabel?.value || 'organization',
            founded: binding.founded?.value ? new Date(binding.founded.value).getFullYear() : null,
            location: binding.locationLabel?.value || binding.countryLabel?.value || '',
            wikidata_id: result.wikidataId,
            description: result.description
        };
    }
    
    console.log('🔍 Final result structure:', {
        entityType: result.entityType,
        hasPerson: !!result.person,
        hasPlace: !!result.place,
        hasOrganization: !!result.organization,
        keys: Object.keys(result)
    });
    
    return result;
}

// Determine entity type from multiple Wikidata instance types
function determineEntityTypeFromMultiple(instanceOfValues) {
    if (!instanceOfValues || instanceOfValues.length === 0) return 'unknown';
    
    console.log('🔍 Determining entity type from multiple values:', instanceOfValues);
    
    // Combine all instanceOf values into a single string for analysis
    const combinedInstances = instanceOfValues.join(' ').toLowerCase();
    
    // Priority order: person > place > organization
    // This ensures that if something is both a person and has other types, person takes precedence
    
    // Person indicators (highest priority)
    if (combinedInstances.includes('human') || 
        combinedInstances.includes('person') || 
        combinedInstances.includes('politician') ||
        combinedInstances.includes('diplomat') ||
        combinedInstances.includes('minister') ||
        combinedInstances.includes('president') ||
        combinedInstances.includes('prime minister') ||
        combinedInstances.includes('spokesperson')) {
        console.log('🔍 Detected as PERSON based on:', instanceOfValues);
        return 'person';
    }
    
    // Place indicators (medium priority)
    if (combinedInstances.includes('city') || 
        combinedInstances.includes('country') || 
        combinedInstances.includes('state') ||
        combinedInstances.includes('capital') ||
        combinedInstances.includes('municipality') ||
        combinedInstances.includes('emirate') ||
        combinedInstances.includes('region') ||
        combinedInstances.includes('territory') ||
        combinedInstances.includes('place') ||
        combinedInstances.includes('location') ||
        combinedInstances.includes('building') ||
        combinedInstances.includes('university') ||
        combinedInstances.includes('office')) {
        console.log('🔍 Detected as PLACE based on:', instanceOfValues);
        return 'place';
    }
    
    // Organization indicators (lowest priority)
    if (combinedInstances.includes('organization') || 
        combinedInstances.includes('company') || 
        combinedInstances.includes('government') ||
        combinedInstances.includes('ministry') ||
        combinedInstances.includes('council') ||
        combinedInstances.includes('agency') ||
        combinedInstances.includes('institution') ||
        combinedInstances.includes('association') ||
        combinedInstances.includes('league') ||
        combinedInstances.includes('cooperation') ||
        combinedInstances.includes('summit')) {
        console.log('🔍 Detected as ORGANIZATION based on:', instanceOfValues);
        return 'organization';
    }
    
    console.log('🔍 Could not determine type from:', instanceOfValues);
    return 'unknown';
}

// Determine entity type from single Wikidata instance type (legacy function)
function determineEntityType(instanceOf) {
    if (!instanceOf) return 'unknown';
    
    // Use the new multiple-value function with a single value
    return determineEntityTypeFromMultiple([instanceOf]);
}

// Parse coordinates from Wikidata format
function parseCoordinates(coordinateString) {
    if (!coordinateString) return null;
    
    try {
        // Wikidata coordinates come in format "Point(longitude latitude)"
        const match = coordinateString.match(/Point\(([+-]?\d+\.?\d*)\s+([+-]?\d+\.?\d*)\)/);
        if (match) {
            return {
                lng: parseFloat(match[1]),
                lat: parseFloat(match[2])
            };
        }
    } catch (error) {
        console.warn('Error parsing coordinates:', coordinateString, error);
    }
    
    return null;
}

// Process all entities from CSV and enrich with Wikidata
export async function enrichCSVWithWikidata(csvData) {
    console.log('🔍 Starting Wikidata enrichment process...');
    
    const entities = extractEntitiesFromCSV(csvData);
    console.log(`📊 Extracted ${entities.length} unique entities from CSV:`, entities);
    
    const enrichedEntities = {
        people: [],
        places: [],
        organizations: [],
        unknown: [],
        notFound: []
    };
    
    // Process entities in batches to avoid overwhelming the API
    const batchSize = 5;
    for (let i = 0; i < entities.length; i += batchSize) {
        const batch = entities.slice(i, i + batchSize);
        console.log(`🔄 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(entities.length/batchSize)}: ${batch.join(', ')}`);
        
        const batchPromises = batch.map(entity => searchWikidataEntity(entity));
        const batchResults = await Promise.all(batchPromises);
        
        batchResults.forEach((result, index) => {
            const entityName = batch[index];
            
            if (!result || !result.found) {
                enrichedEntities.notFound.push({
                    originalName: entityName,
                    reason: result?.error || 'Not found in Wikidata'
                });
                console.log(`❌ Not found: ${entityName}`);
                return;
            }
            
            console.log(`✅ Found: ${entityName} → ${result.name} (${result.entityType})`);
            
            if (result.entityType === 'person' && result.person) {
                enrichedEntities.people.push(result.person);
            } else if (result.entityType === 'place' && result.place) {
                enrichedEntities.places.push(result.place);
            } else if (result.entityType === 'organization' && result.organization) {
                enrichedEntities.organizations.push(result.organization);
            } else {
                enrichedEntities.unknown.push({
                    originalName: entityName,
                    wikidataId: result.wikidataId,
                    name: result.name,
                    instanceOf: result.instanceOf,
                    description: result.description
                });
            }
        });
        
        // Small delay between batches to be respectful to the API
        if (i + batchSize < entities.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    // Log summary
    console.log('\n📋 WIKIDATA ENRICHMENT SUMMARY:');
    console.log(`👥 People found: ${enrichedEntities.people.length}`);
    console.log(`📍 Places found: ${enrichedEntities.places.length}`);
    console.log(`🏢 Organizations found: ${enrichedEntities.organizations.length}`);
    console.log(`❓ Unknown entities: ${enrichedEntities.unknown.length}`);
    console.log(`❌ Not found: ${enrichedEntities.notFound.length}`);
    
    // Log detailed results for Firebase-ready entities
    if (enrichedEntities.people.length > 0) {
        console.log('\n👥 PEOPLE (Firebase-ready format):');
        enrichedEntities.people.forEach(person => {
            console.log(`  • ${person.name}:`, person);
        });
    }
    
    if (enrichedEntities.places.length > 0) {
        console.log('\n📍 PLACES (Firebase-ready format):');
        enrichedEntities.places.forEach(place => {
            console.log(`  • ${place.name}:`, place);
        });
    }
    
    if (enrichedEntities.organizations.length > 0) {
        console.log('\n🏢 ORGANIZATIONS (Firebase-ready format):');
        enrichedEntities.organizations.forEach(org => {
            console.log(`  • ${org.name}:`, org);
        });
    }
    
    return enrichedEntities;
}

// Enrich a single entity with Wikidata information
export async function enrichEntityWithWikidata(entity) {
    try {
        if (!entity.wikidata_id) {
            throw new Error('No Wikidata ID provided');
        }
        
        console.log(`🔍 Enriching entity with Wikidata ID: ${entity.wikidata_id}`);
        
        // Get detailed information from Wikidata
        const wikidataResult = await getWikidataEntityDetails(entity.wikidata_id, entity.originalName);
        
        if (!wikidataResult || !wikidataResult.found) {
            throw new Error(`Failed to fetch data for Wikidata ID: ${entity.wikidata_id}`);
        }
        
        // Return the appropriate entity type based on the result
        if (wikidataResult.entityType === 'person' && wikidataResult.person) {
            return wikidataResult.person;
        } else if (wikidataResult.entityType === 'place' && wikidataResult.place) {
            return wikidataResult.place;
        } else if (wikidataResult.entityType === 'organization' && wikidataResult.organization) {
            return wikidataResult.organization;
        } else {
            // For unknown or other types, create a generic entity
            return {
                id: `wikidata_${wikidataResult.wikidataId}`,
                name: wikidataResult.name,
                aliases: [entity.originalName],
                type: wikidataResult.entityType,
                wikidata_id: wikidataResult.wikidataId,
                description: wikidataResult.description,
                instanceOf: wikidataResult.instanceOf
            };
        }
        
    } catch (error) {
        console.error(`Error enriching entity with Wikidata:`, error);
        throw error;
    }
}
