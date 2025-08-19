import { setupAuth } from './auth.js';
import * as firestoreService from './firestore-service.js';
import * as ui from './ui.js';

// --- DOM ELEMENTS ---
const domElements = {
    loginContainer: document.getElementById('login-container'),
    appContainer: document.getElementById('app-container'),
    userEmailEl: document.getElementById('user-email'),
    authErrorEl: document.getElementById('auth-error'),
    loginForm: document.getElementById('login-form'),
    registerForm: document.getElementById('register-form'),
    logoutButton: document.getElementById('logout-button'),
    showRegisterLink: document.getElementById('show-register-link'),
    showLoginLink: document.getElementById('show-login-link'),
    loginFormContainer: document.getElementById('login-form-container'),
    registerFormContainer: document.getElementById('register-form-container'),
    tabs: document.querySelectorAll('.tab-item'),
    tabContents: document.querySelectorAll('.tab-content'),
    conteoTab: document.getElementById('conteo-tab'),
    reporteTab: document.getElementById('reporte-tab'),
    showCreateAuditModalButton: document.getElementById('show-create-audit-modal-button'),
    auditsListEl: document.getElementById('audits-list'),
    selectedAuditInfoConteo: document.getElementById('selected-audit-info-conteo'),
    conteoWrapper: document.getElementById('conteo-wrapper'),
    subinventarioSelect: document.getElementById('subinventario-select'),
    conteoFormSection: document.getElementById('conteo-form-section'),
    conteoForm: document.getElementById('conteo-form'),
    itemNameInput: document.getElementById('item-name-input'),
    itemDatalist: document.getElementById('item-datalist'),
    itemDescriptionInput: document.getElementById('item-description'),
    conteoTableBody: document.querySelector('#conteo-table tbody'),
    confirmarConteoButton: document.getElementById('confirmar-conteo-button'),
    auditorNameInput: document.getElementById('auditor-name'),
    conteoStatusEl: document.getElementById('conteo-status'),
    selectedAuditInfoReporte: document.getElementById('selected-audit-info-reporte'),
    reporteWrapper: document.getElementById('reporte-wrapper'),
    exportButton: document.getElementById('export-button'),
    finalizeAuditButton: document.getElementById('finalize-audit-button'),
    reportStatusEl: document.getElementById('report-generation-status'),
    createAuditModal: document.getElementById('create-audit-modal'),
    closeModalButton: document.getElementById('close-modal-button'),
    createAuditForm: document.getElementById('create-audit-form'),
    auditNameInput: document.getElementById('audit-name-input'),
    excelFileInput: document.getElementById('excel-file-input'),
    fileNameEl: document.getElementById('file-name'),
    createAuditButton: document.getElementById('create-audit-button'),
    createAuditStatusEl: document.getElementById('create-audit-status'),
};

// --- STATE MANAGEMENT ---
let inventarioAudit = [];
let conteoFisico = [];
let auditsCache = [];
let selectedAuditId = null;
let currentSubinventario = null;

// --- APP INITIALIZATION ---
async function initializeAppState() {
    ui.showLoader();
    try {
        await loadAndRenderAudits();
        const storedAuditId = localStorage.getItem('selectedAuditId');
        if (storedAuditId && auditsCache.some(a => a.id === storedAuditId)) {
            selectAudit(storedAuditId);
        }
        else {
            clearSelectedAudit();
        }
    }
    finally {
        ui.hideLoader();
    }
}

// --- AUTHENTICATION ---
setupAuth(domElements, initializeAppState);

// --- TABNAVIGATION ---
domElements.tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        if (tab.disabled) return;
        domElements.tabs.forEach(item => item.classList.remove('active'));
        tab.classList.add('active');
        const target = document.getElementById(tab.dataset.tab);
        domElements.tabContents.forEach(content => content.classList.remove('active'));
        target.classList.add('active');
    });
});

// --- MODAL HANDLING ---
domElements.showCreateAuditModalButton.addEventListener('click', () => domElements.createAuditModal.classList.remove('hidden'));
domElements.closeModalButton.addEventListener('click', () => domElements.createAuditModal.classList.add('hidden'));
window.addEventListener('click', (e) => {
    if (e.target === domElements.createAuditModal)
        domElements.createAuditModal.classList.add('hidden');
});

// --- AUDIT MANAGEMENT ---
async function loadAndRenderAudits() {
    ui.showLoader();
    try {
        auditsCache = await firestoreService.loadAudits();
        const activeAudits = auditsCache.filter(audit => audit.status !== 'archived');
        ui.renderAudits(domElements.auditsListEl, activeAudits, selectAudit, handleArchiveAudit);
    }
    catch (error) {
        console.error("Error loading audits:", error);
        domElements.auditsListEl.innerHTML = `<p class="error">${error.message}</p>`;
    }
    finally {
        ui.hideLoader();
    }
}

async function handleArchiveAudit(auditId) {
    const auditToArchive = auditsCache.find(a => a.id === auditId);
    if (!auditToArchive)
        return;
    const confirmation = confirm(`¿Estás seguro de que quieres archivar la auditoría "${auditToArchive.name}"?\n\nNo podrás agregar más conteos, pero los datos no se eliminarán.`);
    if (!confirmation)
        return;
    ui.showLoader();
    try {
        await firestoreService.archiveAudit(auditId);
        if (selectedAuditId === auditId) {
            clearSelectedAudit();
        }
        await loadAndRenderAudits();
    }
    catch (error) {
        console.error("Error archiving audit:", error);
        alert(error.message);
    }
    finally {
        ui.hideLoader();
    }
}

domElements.createAuditForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const auditName = domElements.auditNameInput.value.trim();
    const file = domElements.excelFileInput.files[0];
    if (!auditName || !file) {
        ui.showFeedback(domElements.createAuditStatusEl, 'Por favor, completa todos los campos.', 'error');
        return;
    }
    domElements.createAuditButton.disabled = true;
    ui.showLoader();
    try {
        ui.showFeedback(domElements.createAuditStatusEl, 'Procesando archivo Excel...', 'info');
        const inventoryData = await parseExcel(file);
        if (inventoryData.length === 0)
            throw new Error("El archivo Excel está vacío o no tiene el formato correcto.");
        const subinventarios = [...new Set(inventoryData.map(item => item.subinventario))].sort();
        await firestoreService.createAudit(auditName, inventoryData, subinventarios, (message) => {
            ui.showFeedback(domElements.createAuditStatusEl, message, 'info');
        });
        ui.showFeedback(domElements.createAuditStatusEl, '¡Auditoría creada con éxito!', 'success');
        domElements.createAuditForm.reset();
        ui.updateFileName(domElements.fileNameEl, null);
        setTimeout(() => {
            domElements.createAuditModal.classList.add('hidden');
            ui.showFeedback(domElements.createAuditStatusEl, '', 'info');
            loadAndRenderAudits();
        }, 1500);
    }
    catch (error) {
        console.error("Error creating audit:", error);
        ui.showFeedback(domElements.createAuditStatusEl, `Error: ${error.message}`, 'error');
    }
    finally {
        domElements.createAuditButton.disabled = false;
        ui.hideLoader();
    }
});

domElements.excelFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    ui.updateFileName(domElements.fileNameEl, file);
});

function parseExcel(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                const rows = json.slice(1).filter(row => row.length > 0 && row[0]);
                const parsedData = rows.map(row => ({
                    nombre: row[0] || '',
                    descripcion: row[1] || '',
                    ubicacion: row[3] || '',
                    subinventario: row[4] || '',
                    cantidadSistema: parseFloat(row[7]) || 0
                }));
                resolve(parsedData);
            }
            catch (err) {
                reject(err);
            }
        };
        reader.onerror = (err) => reject(err);
        reader.readAsArrayBuffer(file);
    });
}

function selectAudit(auditId) {
    const audit = auditsCache.find(a => a.id === auditId);
    if (!audit) {
        console.error("Selected audit not found in cache");
        clearSelectedAudit();
        return;
    }
    localStorage.setItem('selectedAuditId', auditId);
    selectedAuditId = auditId;
    ui.selectAuditUI(audit, domElements.selectedAuditInfoConteo, domElements.selectedAuditInfoReporte, domElements.conteoWrapper, domElements.reporteWrapper, domElements.conteoTab, domElements.reporteTab, domElements.finalizeAuditButton, domElements.subinventarioSelect, domElements.conteoFormSection);
    resetConteoForm();
}

function clearSelectedAudit() {
    localStorage.removeItem('selectedAuditId');
    selectedAuditId = null;
    inventarioAudit = [];
    ui.clearSelectedAuditUI(domElements.selectedAuditInfoConteo, domElements.selectedAuditInfoReporte, domElements.conteoWrapper, domElements.reporteWrapper, domElements.conteoTab, domElements.reporteTab);
}

// --- PHYSICAL COUNT ---
domElements.subinventarioSelect.addEventListener('change', async (e) => {
    currentSubinventario = e.target.value;
    if (!currentSubinventario) {
        domElements.conteoFormSection.classList.add('hidden');
        return;
    }
    ui.showFeedback(domElements.conteoStatusEl, `Cargando artículos para ${currentSubinventario}...`, 'info');
    domElements.conteoFormSection.classList.remove('hidden');
    domElements.conteoForm.reset();
    ui.showLoader();
    try {
        inventarioAudit = await firestoreService.loadInventoryItemsBySubinventory(selectedAuditId, currentSubinventario);
        ui.showFeedback(domElements.conteoStatusEl, `${inventarioAudit.length} artículos cargados.`, 'success');
        prepareConteoForm();
    }
    catch (error) {
        console.error("Error loading inventory items by subinventory:", error);
        ui.showFeedback(domElements.conteoStatusEl, error.message, 'error');
    }
    finally {
        ui.hideLoader();
    }
});

function prepareConteoForm() {
    domElements.itemDatalist.innerHTML = '';
    inventarioAudit.forEach(item => {
        const option = document.createElement('option');
        option.value = item.nombre;
        domElements.itemDatalist.appendChild(option);
    });
    resetConteoForm();
}

function resetConteoForm() {
    conteoFisico = [];
    ui.renderConteoTable(domElements.conteoTableBody, conteoFisico, handleDeleteConteoItem);
    domElements.conteoForm.reset();
    domElements.auditorNameInput.value = '';
}

function handleDeleteConteoItem(index) {
    conteoFisico.splice(index, 1);
    ui.renderConteoTable(domElements.conteoTableBody, conteoFisico, handleDeleteConteoItem);
}

domElements.itemNameInput.addEventListener('change', () => {
    const selectedItemName = domElements.itemNameInput.value;
    const itemData = inventarioAudit.find(item => item.nombre === selectedItemName && item.subinventario === currentSubinventario);
    domElements.itemDescriptionInput.value = itemData ? itemData.descripcion : '';
});

domElements.conteoForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const newItem = {
        nombre: domElements.itemNameInput.value,
        descripcion: domElements.itemDescriptionInput.value,
        ubicacion: document.getElementById('item-location').value,
        cantidadFisica: parseInt(document.getElementById('item-quantity').value, 10)
    };
    if (!newItem.nombre || !newItem.ubicacion || isNaN(newItem.cantidadFisica)) {
        alert('Por favor, completa todos los campos del artículo.');
        return;
    }
    const itemExists = inventarioAudit.some(item => item.nombre === newItem.nombre && item.subinventario === currentSubinventario);
    if (!itemExists) {
        alert('El artículo ingresado no corresponde al subinventario seleccionado.');
        return;
    }
    conteoFisico.push(newItem);
    ui.renderConteoTable(domElements.conteoTableBody, conteoFisico, handleDeleteConteoItem);
    domElements.conteoForm.reset();
    domElements.itemNameInput.focus();
});

domElements.confirmarConteoButton.addEventListener('click', async () => {
    const auditor = domElements.auditorNameInput.value.trim();
    if (conteoFisico.length === 0) {
        ui.showFeedback(domElements.conteoStatusEl, 'No hay registros para guardar.', 'error');
        return;
    }
    if (!auditor) {
        ui.showFeedback(domElements.conteoStatusEl, 'Debes ingresar tu nombre para confirmar.', 'error');
        return;
    }
    if (!selectedAuditId) {
        ui.showFeedback(domElements.conteoStatusEl, 'Error: No hay auditoría seleccionada.', 'error');
        return;
    }
    ui.showFeedback(domElements.conteoStatusEl, 'Guardando conteo...', 'info');
    ui.showLoader();
    try {
        await firestoreService.savePhysicalCount(selectedAuditId, currentSubinventario, auditor, conteoFisico);
        ui.showFeedback(domElements.conteoStatusEl, `Conteo para ${currentSubinventario} guardado con éxito.`, 'success');
        resetConteoForm();
        domElements.conteoFormSection.classList.add('hidden');
        domElements.subinventarioSelect.value = '';
    }
    catch (error) {
        console.error("Error saving physical count:", error);
        ui.showFeedback(domElements.conteoStatusEl, error.message, 'error');
    }
    finally {
        ui.hideLoader();
    }
});

// --- REPORTING & FINALIZING ---
domElements.finalizeAuditButton.addEventListener('click', async () => {
    if (!selectedAuditId)
        return;
    const confirmation = confirm(`¿Estás seguro de que quieres finalizar esta auditoría? Una vez finalizada, no se podrán agregar más conteos. Esta acción es irreversible.`);
    if (!confirmation)
        return;
    ui.showLoader();
    try {
        await firestoreService.finalizeAudit(selectedAuditId);
        ui.showFeedback(domElements.reportStatusEl, 'Auditoría finalizada y archivada con éxito.', 'success');
        await loadAndRenderAudits();
        clearSelectedAudit();
    }
    catch (error) {
        console.error("Error finalizing audit:", error);
        ui.showFeedback(domElements.reportStatusEl, error.message, 'error');
    }
    finally {
        ui.hideLoader();
    }
});

domElements.exportButton.addEventListener('click', async () => {
    if (!selectedAuditId) {
        ui.showFeedback(domElements.reportStatusEl, 'No hay auditoría seleccionada.', 'error');
        return;
    }
    ui.showFeedback(domElements.reportStatusEl, 'Generando reporte...', 'info');
    ui.showLoader();
    try {
        // A more robust solution would fetch all items for the audit.
        // For now, we rely on the items loaded for the selected subinventories.
        if (inventarioAudit.length === 0) {
            ui.showFeedback(domElements.reportStatusEl, 'Por favor, carga al menos un subinventario para generar un reporte.', 'error');
            return;
        }
        const allPhysicalCounts = await firestoreService.getPhysicalCountsForReport(selectedAuditId);
        if (allPhysicalCounts.length === 0) {
            ui.showFeedback(domElements.reportStatusEl, 'No se han encontrado conteos físicos para esta auditoría.', 'error');
            return;
        }
        const reporte = generateReportData(inventarioAudit, allPhysicalCounts);
        const audit = auditsCache.find(a => a.id === selectedAuditId);
        const fileName = `Reporte_Auditoria_${audit.name.replace(/\s+/g, '_')}.xlsx`;
        const worksheet = XLSX.utils.json_to_sheet(reporte);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Reporte Auditoria");
        worksheet['!cols'] = [{ wch: 20 }, { wch: 30 }, { wch: 40 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
        XLSX.writeFile(workbook, fileName);
        ui.showFeedback(domElements.reportStatusEl, 'Reporte generado y descargado.', 'success');
    }
    catch (error) {
        console.error("Error generating report:", error);
        ui.showFeedback(domElements.reportStatusEl, error.message, 'error');
    }
    finally {
        ui.hideLoader();
    }
});

function generateReportData(systemInventory, physicalCounts) {
    const reporte = [];
    const physicalCountMap = physicalCounts.reduce((acc, item) => {
        const key = item.nombre.toLowerCase().trim();
        if (!acc[key]) {
            acc[key] = { cantidad: 0, desc: item.descripcion, sub: item.subinventario };
        }
        acc[key].cantidad += item.cantidadFisica;
        return acc;
    }, {});
    const processedKeys = new Set();
    systemInventory.forEach(itemSistema => {
        const key = itemSistema.nombre.toLowerCase().trim();
        const physicalCount = physicalCountMap[key];
        const cantidadFisica = physicalCount ? physicalCount.cantidad : 0;
        const diferencia = cantidadFisica - itemSistema.cantidadSistema;
        reporte.push({
            'Subinventario': itemSistema.subinventario,
            'Nombre de Artículo': itemSistema.nombre,
            'Descripción': itemSistema.descripcion,
            'Ubicación Sistema': itemSistema.ubicacion,
            'Cantidad Sistema': itemSistema.cantidadSistema,
            'Cantidad Física': cantidadFisica,
            'Diferencia': diferencia
        });
        if (physicalCount) {
            processedKeys.add(key);
        }
    });
    Object.keys(physicalCountMap).forEach(key => {
        if (!processedKeys.has(key)) {
            const itemFisico = physicalCountMap[key];
            reporte.push({
                'Subinventario': itemFisico.sub || 'N/A en Sistema',
                'Nombre de Artículo': key,
                'Descripción': itemFisico.desc,
                'Ubicación Sistema': 'N/A',
                'Cantidad Sistema': 0,
                'Cantidad Física': itemFisico.cantidad,
                'Diferencia': itemFisico.cantidad
            });
        }
    });
    return reporte;
}
