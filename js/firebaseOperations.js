// Firebase database operations
import { 
    collection, 
    addDoc, 
    getDocs, 
    deleteDoc,
    doc,
    writeBatch,
    orderBy, 
    query, 
    limit,
    serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { db } from './config.js';

// Save entity data to Firebase
export async function saveEntityToFirebase(data, entityType) {
    if (!db) {
        throw new Error('Firebase is not initialized. Please check your configuration.');
    }
    
    // Add metadata
    const entityData = {
        ...data,
        type: entityType.slice(0, -1), // Remove 's' from plural
        timestamp: serverTimestamp(),
        created: new Date().toISOString(),
        createdAt: serverTimestamp() // Additional timestamp field for reliable querying
    };
    
    console.log(`💾 Saving ${entityType} entity:`, data.name || data.id);
    
    // Add document to Firestore
    const docRef = await addDoc(collection(db, entityType), entityData);
    
    console.log(`✅ Successfully saved to Firebase with ID: ${docRef.id}`);
    return docRef;
}

// Load entities from Firebase
export async function loadEntitiesFromFirebase(entityType, limitCount = 10) {
    if (!db) {
        throw new Error('Firebase is not initialized. Please check your configuration.');
    }
    
    console.log(`📥 Loading ${entityType} entities (limit: ${limitCount})`);
    
    try {
        // Try to query with createdAt first (for new entities)
        let q = query(
            collection(db, entityType), 
            orderBy('created', 'desc'), 
            limit(limitCount)
        );
        
        let querySnapshot = await getDocs(q);
        
        // If no results with createdAt, try with timestamp (fallback)
        if (querySnapshot.empty) {
            console.log(`📥 No entities found with 'createdAt', trying 'timestamp' field...`);
            q = query(
                collection(db, entityType), 
                orderBy('timestamp', 'desc'), 
                limit(limitCount)
            );
            querySnapshot = await getDocs(q);
        }
        
        // If still no results, try with created (ISO string)
        if (querySnapshot.empty) {
            console.log(`📥 No entities found with 'timestamp', trying 'created' field...`);
            q = query(
                collection(db, entityType), 
                orderBy('created', 'desc'), 
                limit(limitCount)
            );
            querySnapshot = await getDocs(q);
        }
        
        // If still no results, get all documents without ordering
        if (querySnapshot.empty) {
            console.log(`📥 No entities found with any timestamp field, loading all documents...`);
            q = query(collection(db, entityType), limit(limitCount));
            querySnapshot = await getDocs(q);
        }
        
        const entities = [];
        querySnapshot.forEach((doc) => {
            entities.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        console.log(`📥 Successfully loaded ${entities.length} ${entityType} entities`);
        return entities;
        
    } catch (error) {
        console.error(`Error loading ${entityType} entities:`, error);
        throw error;
    }
}

// Delete entity from Firebase
export async function deleteEntityFromFirebase(entityType, entityId) {
    if (!db) {
        throw new Error('Firebase is not initialized. Please check your configuration.');
    }
    
    try {
        const entityRef = doc(db, entityType, entityId);
        await deleteDoc(entityRef);
        
        console.log(`🗑️ Deleted ${entityType} entity: ${entityId}`);
        return { success: true };
        
    } catch (error) {
        console.error(`Error deleting ${entityType} entity ${entityId}:`, error);
        throw error;
    }
}

// Delete multiple entities from Firebase (batch operation)
export async function deleteMultipleEntitiesFromFirebase(deletions) {
    if (!db) {
        throw new Error('Firebase is not initialized. Please check your configuration.');
    }
    
    try {
        const batch = writeBatch(db);
        
        deletions.forEach(({ entityType, entityId }) => {
            const entityRef = doc(db, entityType, entityId);
            batch.delete(entityRef);
        });
        
        await batch.commit();
        
        console.log(`🗑️ Batch deleted ${deletions.length} entities`);
        return { success: true, deletedCount: deletions.length };
        
    } catch (error) {
        console.error('Error batch deleting entities:', error);
        throw error;
    }
}
