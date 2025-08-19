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
    writeBatch
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

export async function loadInventoryItemsBySubinventory(auditId, subinventario) {
    try {
        const q = query(
            collection(db, `audits/${auditId}/inventoryItems`),
            where("subinventario", "==", subinventario)
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => doc.data());
    } catch (error) {
        console.error("Error loading inventory items by subinventory:", error);
        throw new Error("Error al cargar artículos. ¿Creaste el índice en Firestore?");
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
        let allPhysicalCounts = [];
        querySnapshot.forEach((doc) => {
            allPhysicalCounts = allPhysicalCounts.concat(doc.data().items);
        });
        return allPhysicalCounts;
    } catch (error) {
        console.error("Error getting physical counts for report:", error);
        throw new Error("Ocurrió un error al obtener los conteos para el reporte.");
    }
}
