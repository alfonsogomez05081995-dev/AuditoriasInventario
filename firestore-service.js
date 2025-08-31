import {
    doc,
    collection,
    addDoc,
    query,
    where,
    getDocs,
    Timestamp,
    orderBy,
    updateDoc,
    writeBatch,
    onSnapshot,
    limit,
    startAfter,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db, auth } from './firebase-config.js';

export async function loadAudits() {
    try {
        const q = query(collection(db, "audits"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error loading audits:", error);
        throw new Error("Error al cargar las auditorías.");
    }
}

export async function archiveAudit(auditId) {
    try {
        const auditRef = doc(db, "audits", auditId);
        await updateDoc(auditRef, { status: 'archived' });
    } catch (error) {
        console.error("Error archiving audit:", error);
        throw new Error("Ocurrió un error al archivar la auditoría.");
    }
}

export async function createAudit(auditName, inventoryData, subinventarios, progressCallback) {
    const auditMeta = {
        name: auditName,
        itemCount: inventoryData.length,
        subinventarios: subinventarios,
        createdAt: Timestamp.now(),
        createdBy: auth.currentUser.email,
        status: 'in-progress'
    };

    progressCallback('Creando registro de auditoría...');
    const auditDocRef = await addDoc(collection(db, "audits"), auditMeta);
    const auditId = auditDocRef.id;

    const batchSize = 500;
    const totalBatches = Math.ceil(inventoryData.length / batchSize);
    for (let i = 0; i < inventoryData.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = inventoryData.slice(i, i + batchSize);
        progressCallback(`Subiendo artículos... Lote ${Math.ceil((i + 1) / batchSize)} de ${totalBatches}`);
        chunk.forEach(item => {
            const itemDocRef = doc(collection(db, `audits/${auditId}/inventoryItems`));
            batch.set(itemDocRef, item);
        });
        await batch.commit();
    }
    return auditId;
}

export async function loadInventoryItemsBySubinventory(auditId, subinventario, pageSize, lastVisible) {
    try {
        const itemCollection = collection(db, `audits/${auditId}/inventoryItems`);
        let q;

        if (lastVisible) {
            q = query(
                itemCollection,
                where("subinventario", "==", subinventario),
                orderBy("nombre"), // Se necesita un orderBy para usar startAfter
                startAfter(lastVisible),
                limit(pageSize)
            );
        } else {
            q = query(
                itemCollection,
                where("subinventario", "==", subinventario),
                orderBy("nombre"),
                limit(pageSize)
            );
        }

        const querySnapshot = await getDocs(q);
        
        const items = querySnapshot.docs.map(doc => doc.data());
        const newLastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];

        return { items, lastVisible: newLastVisible };

    } catch (error) {
        console.error("Error loading inventory items by subinventory:", error);
        // Firestore requiere un índice para consultas compuestas. Si falla, es probable que sea por eso.
        throw new Error("Error al cargar artículos. Es posible que necesites crear un índice en Firestore. Revisa la consola de errores del navegador para ver el enlace de creación del índice.");
    }
}

export async function savePhysicalCount(auditId, subinventario, auditor, conteoFisico) {
    try {
        const conteoData = {
            subinventario: subinventario,
            auditor: auditor,
            items: conteoFisico,
            conteoDate: Timestamp.now(),
            auditId: auditId
        };
        await addDoc(collection(db, "physicalCounts"), conteoData);
    } catch (error) {
        console.error("Error saving physical count:", error);
        throw new Error("Error al guardar el conteo.");
    }
}

export async function finalizeAudit(auditId) {
    try {
        const auditRef = doc(db, "audits", auditId);
        await updateDoc(auditRef, { status: 'completed' });
    } catch (error) {
        console.error("Error finalizing audit:", error);
        throw new Error("Error al finalizar la auditoría.");
    }
}

export async function getPhysicalCountsForReport(auditId) {
    try {
        const q = query(collection(db, "physicalCounts"), where("auditId", "==", auditId));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            return [];
        }
        // Return the full documents, including their ID
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error getting physical counts for report:", error);
        throw new Error("Ocurrió un error al obtener los conteos para el reporte.");
    }
}

export function listenToPhysicalCounts(auditId, callback) {
    const q = query(
        collection(db, "physicalCounts"),
        where("auditId", "==", auditId),
        orderBy("conteoDate", "desc"),
        limit(100) // Limit to the last 100 counts for dashboard performance
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const counts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(counts);
    }, (error) => {
        console.error("Error listening to physical counts:", error);
        callback([]); // Send empty array on error
    });

    return unsubscribe;
}

// --- Costs Management ---

export function listenToCosts(callback) {
    const costsCollection = collection(db, "valoresReferencias");
    const q = query(costsCollection);

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const costs = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        callback(costs);
    }, (error) => {
        console.error("Error listening to costs:", error);
        callback([]);
    });

    return unsubscribe;
}

export async function getAllCosts() {
    try {
        const querySnapshot = await getDocs(collection(db, "valoresReferencias"));
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error getting all costs:", error);
        throw new Error("No se pudieron cargar los costos para el reporte.");
    }
}

export async function replaceCosts(costsData, progressCallback) {
    // Step 1: Delete all existing documents in the collection
    progressCallback('Eliminando costos antiguos...');
    const costsCollectionRef = collection(db, "valoresReferencias");
    const existingDocsSnapshot = await getDocs(costsCollectionRef);
    if (!existingDocsSnapshot.empty) {
        const deletePromises = [];
        for (let i = 0; i < existingDocsSnapshot.docs.length; i += 500) {
            const chunk = existingDocsSnapshot.docs.slice(i, i + 500);
            const deleteBatch = writeBatch(db);
            chunk.forEach(doc => deleteBatch.delete(doc.ref));
            deletePromises.push(deleteBatch.commit());
        }
        await Promise.all(deletePromises);
    }

    // Step 2: Add new documents from the parsed data in batches
    const batchSize = 500;
    const totalBatches = Math.ceil(costsData.length / batchSize);
    for (let i = 0; i < costsData.length; i += batchSize) {
        progressCallback(`Subiendo nuevos costos... Lote ${Math.ceil((i + 1) / batchSize)} de ${totalBatches}`);
        const batch = writeBatch(db);
        const chunk = costsData.slice(i, i + batchSize);
        chunk.forEach(costItem => {
            if (costItem.referencia) {
                const docRef = doc(db, "valoresReferencias", costItem.referencia);
                batch.set(docRef, {
                    costo: costItem.costo || 0,
                    tecnologia: costItem.tecnologia || '',
                    naturaleza: costItem.naturaleza || ''
                });
            }
        });
        await batch.commit();
    }
}

export async function updateCostItem(referencia, dataToUpdate) {
    try {
        const costRef = doc(db, "valoresReferencias", referencia);
        await updateDoc(costRef, dataToUpdate);
    } catch (error) {
        console.error("Error updating cost item:", error);
        throw new Error("No se pudo actualizar el artículo de costo.");
    }
}

export async function deleteCost(referencia) {
    try {
        const costRef = doc(db, "valoresReferencias", referencia);
        await deleteDoc(costRef);
    } catch (error) {
        console.error("Error deleting cost:", error);
        throw new Error("No se pudo eliminar el costo.");
    }
}

export async function loadAllInventoryItems(auditId) {
    try {
        const itemCollection = collection(db, `audits/${auditId}/inventoryItems`);
        const querySnapshot = await getDocs(itemCollection);
        return querySnapshot.docs.map(doc => doc.data());
    } catch (error) {
        console.error("Error loading all inventory items:", error);
        throw new Error("Error al cargar el inventario completo del sistema.");
    }
}