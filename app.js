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
    itemLocationInput: document.getElementById('item-location'),
    locationWarning: document.getElementById('location-warning'),
    manualLocationInput: document.getElementById('manual-location-input'),
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
    sobranteModal: document.getElementById('sobrante-modal'),
    closeSobranteModalButton: document.getElementById('close-sobrante-modal-button'),
    sobranteForm: document.getElementById('sobrante-form'),
    sobranteItemName: document.getElementById('sobrante-item-name'),
    // Report Filters
    includeDetailed: document.getElementById('include-detailed'),
    includeNationalConsolidated: document.getElementById('include-national-consolidated'),
    includeSubinventoryConsolidated: document.getElementById('include-subinventory-consolidated'),
    filterSobrantes: document.getElementById('filter-sobrantes'),
    filterFaltantes: document.getElementById('filter-faltantes'),
    filterSinDiferencia: document.getElementById('filter-sin-diferencia'),
    filterReferencia: document.getElementById('filter-referencia'),
    filterLocalizador: document.getElementById('filter-localizador'),
    filterSubinventario: document.getElementById('filter-subinventario'),
    loadMoreButtonContainer: document.getElementById('load-more-container'),
    // Costs Management Elements
    costsUploadForm: document.getElementById('costs-upload-form'),
    costsFileInput: document.getElementById('costs-file-input'),
    costsFileName: document.getElementById('costs-file-name'),
    costsSearchInput: document.getElementById('costs-search-input'),
    costsTableBody: document.querySelector('#costs-table tbody'),
};

// --- STATE MANAGEMENT ---
let inventarioAudit = [];
let conteoFisico = [];
let auditsCache = [];
let costsCache = [];
let selectedAuditId = null;
let currentSubinventario = null;
let unsubscribeDashboard = null;
let unsubscribeCosts = null;
let lastVisibleItem = null; // For pagination
let isLoadingMore = false;
const PAGE_SIZE = 100; // Load 100 items per page

// --- APP INITIALIZATION ---
async function initializeAppState() {
    ui.showLoader();
    try {
        await loadAndRenderAudits();
        const storedAuditId = localStorage.getItem('selectedAuditId');
        if (storedAuditId && auditsCache.some(a => a.id === storedAuditId)) {
            await selectAudit(storedAuditId);
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
        const targetContent = document.getElementById(tab.dataset.tab);
        domElements.tabContents.forEach(content => content.classList.remove('active'));
        targetContent.classList.add('active');

        // Special actions for specific tabs
        if (tab.dataset.tab === 'costos') {
            handleCostsTabSelected();
        }
    });
});

// --- MODAL HANDLING ---
domElements.showCreateAuditModalButton.addEventListener('click', () => domElements.createAuditModal.classList.remove('hidden'));
domElements.closeModalButton.addEventListener('click', () => domElements.createAuditModal.classList.add('hidden'));
domElements.closeSobranteModalButton.addEventListener('click', () => domElements.sobranteModal.classList.add('hidden'));
window.addEventListener('click', (e) => {
    if (e.target === domElements.createAuditModal) domElements.createAuditModal.classList.add('hidden');
    if (e.target === domElements.sobranteModal) domElements.sobranteModal.classList.add('hidden');
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

function parseCostsFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                const rows = json.slice(1).filter(row => row && row[0] && typeof row[13] !== 'undefined');
                const parsedData = rows.map(row => ({
                    referencia: String(row[0]).trim(),
                    tecnologia: String(row[4] || '').trim(), // Column E
                    naturaleza: String(row[5] || '').trim(), // Column F
                    costo: parseFloat(row[13]) || 0      // Column N
                })).filter(item => item.referencia);

                if (parsedData.length === 0) {
                    return reject(new Error("No se encontraron datos válidos en el archivo. Asegúrate de que las columnas A, E, F y N contengan datos."));
                }
                resolve(parsedData);
            } catch (err) {
                console.error("Error parsing costs file:", err);
                reject(new Error("Error al leer el formato del archivo de costos."));
            }
        };
        reader.onerror = (err) => reject(err);
        reader.readAsArrayBuffer(file);
    });
}

async function selectAudit(auditId) {
    if (unsubscribeDashboard) {
        unsubscribeDashboard();
        unsubscribeDashboard = null;
    }

    const audit = auditsCache.find(a => a.id === auditId);
    if (!audit) {
        console.error("Selected audit not found in cache");
        clearSelectedAudit();
        return;
    }

    localStorage.setItem('selectedAuditId', auditId);
    selectedAuditId = auditId;
    inventarioAudit = []; // Reset inventory on new audit selection. 

    ui.selectAuditUI(audit, domElements.selectedAuditInfoConteo, domElements.selectedAuditInfoReporte, domElements.conteoWrapper, domElements.reporteWrapper, domElements.conteoTab, domElements.reporteTab, domElements.finalizeAuditButton, domElements.subinventarioSelect, domElements.conteoFormSection);

    document.getElementById('dashboard-container').classList.remove('hidden');
    unsubscribeDashboard = firestoreService.listenToPhysicalCounts(auditId, handleDashboardUpdate);

    resetConteoForm();
}

function clearSelectedAudit() {
    if (unsubscribeDashboard) {
        unsubscribeDashboard();
        unsubscribeDashboard = null;
    }
    localStorage.removeItem('selectedAuditId');
    selectedAuditId = null;
    inventarioAudit = [];
    ui.clearSelectedAuditUI(domElements.selectedAuditInfoConteo, domElements.selectedAuditInfoReporte, domElements.conteoWrapper, domElements.reporteWrapper, domElements.conteoTab, domElements.reporteTab);
    document.getElementById('dashboard-container').classList.add('hidden');
}

function handleDashboardUpdate(counts) {
    if (!counts) return;

    const totalUnits = counts.flatMap(c => c.items).reduce((sum, item) => sum + item.cantidadFisica, 0);
    const uniqueReferences = new Set(counts.flatMap(c => c.items).map(item => item.nombre)).size;
    const activeSubinventories = new Set(counts.map(c => c.subinventario)).size;

    const stats = {
        sessions: counts.length,
        units: totalUnits,
        references: uniqueReferences,
        subinventaries: activeSubinventories
    };

    ui.updateDashboard(stats, counts);
}

// --- PHYSICAL COUNT ---
domElements.subinventarioSelect.addEventListener('change', async (e) => {
    currentSubinventario = e.target.value;
    inventarioAudit = [];
    lastVisibleItem = null;
    domElements.itemDatalist.innerHTML = '';

    if (!currentSubinventario) {
        domElements.conteoFormSection.classList.add('hidden');
        return;
    }
    domElements.conteoFormSection.classList.remove('hidden');
    domElements.conteoForm.reset();
    await loadMoreItems();
});

async function loadMoreItems() {
    if (isLoadingMore || !selectedAuditId || !currentSubinventario) return;

    isLoadingMore = true;
    ui.showLoader();
    ui.showFeedback(domElements.conteoStatusEl, `Cargando más artículos para ${currentSubinventario}...`, 'info');

    try {
        const { items, lastVisible } = await firestoreService.loadInventoryItemsBySubinventory(
            selectedAuditId,
            currentSubinventario,
            PAGE_SIZE,
            lastVisibleItem
        );

        inventarioAudit.push(...items);
        lastVisibleItem = lastVisible;

        ui.showFeedback(domElements.conteoStatusEl, `${inventarioAudit.length} artículos cargados.`, 'success');
        prepareConteoForm(items);

        ui.manageLoadMoreButton(domElements.loadMoreButtonContainer, lastVisible, loadMoreItems);

    } catch (error) {
        console.error("Error loading more inventory items:", error);
        ui.showFeedback(domElements.conteoStatusEl, error.message, 'error');
    } finally {
        isLoadingMore = false;
        ui.hideLoader();
    }
}

function prepareConteoForm(newItems) {
    newItems.forEach(item => {
        const option = document.createElement('option');
        option.value = item.nombre;
        domElements.itemDatalist.appendChild(option);
    });
}

function resetConteoForm() {
    conteoFisico = [];
    ui.renderConteoTable(domElements.conteoTableBody, conteoFisico, handleDeleteConteoItem);
    domElements.conteoForm.reset();
    domElements.auditorNameInput.value = '';
    domElements.itemLocationInput.disabled = true;
}

function handleDeleteConteoItem(index) {
    conteoFisico.splice(index, 1);
    ui.renderConteoTable(domElements.conteoTableBody, conteoFisico, handleDeleteConteoItem);
}

domElements.itemNameInput.addEventListener('change', () => {
    const selectedItemName = domElements.itemNameInput.value;
    const items = inventarioAudit.filter(item => item.nombre === selectedItemName && item.subinventario === currentSubinventario);

    domElements.itemLocationInput.innerHTML = '';
    domElements.itemDescriptionInput.value = '';
    domElements.manualLocationInput.value = '';
    domElements.locationWarning.classList.add('hidden');

    if (items.length > 0) {
        domElements.itemDescriptionInput.value = items[0].descripcion;
        
        items.forEach(item => {
            const option = document.createElement('option');
            option.value = item.ubicacion;
            option.textContent = item.ubicacion;
            domElements.itemLocationInput.appendChild(option);
        });

        domElements.itemLocationInput.disabled = false;

        if (items.length > 1) {
            domElements.locationWarning.textContent = '¡Atención! Esta referencia existe en múltiples ubicaciones. Por favor, valida el localizador correcto.';
            domElements.locationWarning.classList.remove('hidden');
        }
    } else {
        domElements.itemLocationInput.disabled = true;
    }
});

domElements.conteoForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const nombre = domElements.itemNameInput.value;
    const ubicacionOriginal = domElements.itemLocationInput.value;
    const ubicacionFisica = domElements.manualLocationInput.value;

    const newItem = {
        nombre: nombre,
        descripcion: domElements.itemDescriptionInput.value,
        ubicacion: ubicacionFisica,
        ubicacionOriginal: ubicacionOriginal,
        cantidadFisica: parseInt(document.getElementById('item-quantity').value, 10),
        localizadorForzado: true
    };

    if (!newItem.nombre || !newItem.ubicacion || isNaN(newItem.cantidadFisica)) {
        alert('Por favor, completa todos los campos del artículo.');
        return;
    }

    const itemExists = inventarioAudit.some(item => item.nombre === newItem.nombre && item.subinventario === currentSubinventario);
    if (!itemExists) {
        domElements.sobranteItemName.textContent = newItem.nombre;
        domElements.sobranteModal.classList.remove('hidden');
        return;
    }

    conteoFisico.push(newItem);
    ui.renderConteoTable(domElements.conteoTableBody, conteoFisico, handleDeleteConteoItem);
    domElements.conteoForm.reset();
    domElements.itemNameInput.focus();
    resetLocationInputs();
});

function resetLocationInputs() {
    domElements.itemLocationInput.value = '';
    domElements.manualLocationInput.value = '';
}

domElements.sobranteForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const newItem = {
        nombre: domElements.sobranteItemName.textContent,
        descripcion: document.getElementById('sobrante-description').value,
        ubicacion: document.getElementById('sobrante-location').value,
        cantidadFisica: parseInt(document.getElementById('sobrante-quantity').value, 10),
        isSobrante: true
    };

    if (!newItem.ubicacion || isNaN(newItem.cantidadFisica)) {
        alert('Por favor, completa la ubicación y la cantidad.');
        return;
    }

    conteoFisico.push(newItem);
    ui.renderConteoTable(domElements.conteoTableBody, conteoFisico, handleDeleteConteoItem);
    domElements.sobranteModal.classList.add('hidden');
    domElements.sobranteForm.reset();
    domElements.conteoForm.reset();
    domElements.itemNameInput.focus();
    resetLocationInputs();
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

// --- COSTS MANAGEMENT ---
function handleCostsTabSelected() {
    if (unsubscribeCosts) {
        unsubscribeCosts();
    }
    unsubscribeCosts = firestoreService.listenToCosts((costs) => {
        costsCache = costs;
        ui.renderCostsTable(domElements.costsTableBody, costsCache, handleDeleteCost, handleUpdateCostItem);
        ui.filterCostsTable(domElements.costsSearchInput, domElements.costsTableBody);
    });
}

domElements.costsFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    ui.updateCostsFileName(file ? file.name : null);
});

domElements.costsUploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const file = domElements.costsFileInput.files[0];
    if (!file) {
        ui.showCostsUploadStatus('Por favor, selecciona un archivo Excel.', 'error');
        return;
    }

    const confirmation = confirm("Atención: Esta acción reemplazará TODOS los costos existentes con los datos del archivo. ¿Deseas continuar?");
    if (!confirmation) return;

    ui.showLoader();
    
    try {
        ui.showCostsUploadStatus('Procesando archivo...', 'info');
        const parsedData = await parseCostsFile(file);
        
        await firestoreService.replaceCosts(parsedData, (message) => {
            ui.showCostsUploadStatus(message, 'info');
        });

        ui.showCostsUploadStatus('¡Los costos se han actualizado con éxito!', 'success');
        domElements.costsUploadForm.reset();
        ui.updateCostsFileName(null);
    } catch (error) {
        console.error("Error uploading costs file:", error);
        ui.showCostsUploadStatus(`Error: ${error.message}`, 'error');
    } finally {
        ui.hideLoader();
    }
});

domElements.costsSearchInput.addEventListener('keyup', () => {
    ui.filterCostsTable(domElements.costsSearchInput, domElements.costsTableBody);
});

async function handleDeleteCost(referencia) {
    ui.showLoader();
    try {
        await firestoreService.deleteCost(referencia);
        ui.showCostsUploadStatus('Costo eliminado con éxito.', 'success');
    } catch (error) {
        console.error("Error deleting cost:", error);
        ui.showCostsUploadStatus(`Error al eliminar: ${error.message}`, 'error');
    } finally {
        ui.hideLoader();
    }
}

async function handleUpdateCostItem(referencia, dataToUpdate) {
    ui.showLoader();
    try {
        await firestoreService.updateCostItem(referencia, dataToUpdate);
        ui.showCostsUploadStatus('Costo actualizado con éxito.', 'success');
    } catch (error) {
        console.error("Error updating cost item:", error);
        ui.showCostsUploadStatus(`Error al guardar: ${error.message}`, 'error');
    } finally {
        ui.hideLoader();
    }
}


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

    const filters = {
        includeDetailed: domElements.includeDetailed.checked,
        includeNationalConsolidated: domElements.includeNationalConsolidated.checked,
        includeSubinventoryConsolidated: domElements.includeSubinventoryConsolidated.checked,
        sobrantes: domElements.filterSobrantes.checked,
        faltantes: domElements.filterFaltantes.checked,
        sinDiferencia: domElements.filterSinDiferencia.checked,
        referencia: domElements.filterReferencia.value.trim(),
        localizador: domElements.filterLocalizador.value.trim(),
        subinventario: domElements.filterSubinventario.value.trim(),
    };

    if (!filters.includeDetailed && !filters.includeNationalConsolidated && !filters.includeSubinventoryConsolidated) {
        ui.showFeedback(domElements.reportStatusEl, 'Debes seleccionar al menos un tipo de reporte para generar.', 'error');
        return;
    }

    ui.showFeedback(domElements.reportStatusEl, 'Generando reportes... (Esto puede tardar unos segundos)', 'info');
    ui.showLoader();
    try {
        const audit = auditsCache.find(a => a.id === selectedAuditId);
        if (!audit) throw new Error("Auditoría no encontrada");

        // Fetch all necessary data in parallel
        const [allSystemItems, allCountSessions, allCosts] = await Promise.all([
            firestoreService.loadAllInventoryItems(selectedAuditId),
            firestoreService.getPhysicalCountsForReport(selectedAuditId),
            firestoreService.getAllCosts() // Fetch costs for reporting
        ]);

        if (allCountSessions.length === 0) {
            ui.showFeedback(domElements.reportStatusEl, 'No se han encontrado conteos físicos para esta auditoría.', 'error');
            return;
        }

        const reports = generateReportData(allSystemItems, allCountSessions, audit.subinventarios, filters, allCosts);

        const fileName = `Reporte_Auditoria_${audit.name.replace(/\s+/g, '_')}.xlsx`;
        const wb = XLSX.utils.book_new();

        if (filters.includeDetailed && reports.detailed) {
            XLSX.utils.book_append_sheet(wb, reports.detailed, 'Reporte Detallado');
        }
        if (filters.includeNationalConsolidated && reports.nationalConsolidated) {
            XLSX.utils.book_append_sheet(wb, reports.nationalConsolidated, 'ReporteNacionalConsolidado');
        }
        if (filters.includeSubinventoryConsolidated && reports.subinventoryReports) {
            reports.subinventoryReports.forEach(subReport => {
                const safeSheetName = subReport.sheetName.replace(/[^a-zA-Z0-9_]/g, '').substring(0, 31);
                XLSX.utils.book_append_sheet(wb, subReport.worksheet, safeSheetName);
            });
        }
        if (reports.financialReport) { // Add financial report
            XLSX.utils.book_append_sheet(wb, reports.financialReport, 'Informe Financiero');
        }

        XLSX.writeFile(wb, fileName);

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

function generateReportData(systemInventory, countSessions, subinventarios, filters, costs) {
    const costsMap = new Map(costs.map(c => [c.id, {
        costo: c.costo || 0,
        tecnologia: c.tecnologia || '',
        naturaleza: c.naturaleza || ''
    }]));

    // 1. Create a map of all system locations for easy lookup
    const systemLocationsMap = new Map();
    systemInventory.forEach(item => {
        const key = `${item.nombre}_${item.subinventario}`.toLowerCase();
        if (!systemLocationsMap.has(key)) {
            systemLocationsMap.set(key, []);
        }
        systemLocationsMap.get(key).push(item.ubicacion);
    });

    // 2. Sort sessions to create a sequential count number
    const sortedSessions = countSessions.sort((a, b) => a.conteoDate.toMillis() - b.conteoDate.toMillis());
    const sessionsWithCountNumber = sortedSessions.map((session, index) => ({ ...session, numeroConteo: index + 1 }));

    // 3. Flatten all physical counts and combine with session data
    const flatPhysicalCounts = sessionsWithCountNumber.flatMap(session =>
        session.items.map(item => ({
            ...item,
            auditor: session.auditor,
            subinventario: session.subinventario,
            idConteo: session.id,
            numeroConteo: session.numeroConteo
        }))
    );

    // 4. Create the detailed data map (base for all reports)
    const detailedData = {};
    systemInventory.forEach(item => {
        const key = `${item.nombre}_${item.subinventario}_${item.ubicacion}`.toLowerCase();
        detailedData[key] = {
            'ID Conteo': 'N/A',
            '# Conteo': 'N/A',
            'Auditor': 'N/A',
            'Desajuste de Localizador': 'NO',
            'Subinventario': item.subinventario,
            'Referencia': item.nombre,
            'Descripción': item.descripcion,
            'Localizador en Sistema': item.ubicacion,
            'Localizador Físico': item.ubicacion, // Initially the same
            'Cantidad Sistema': item.cantidadSistema,
            'Cantidad Física': 0,
            'Estado': 'FALTANTE',
            'ID_Documento_Firestore': 'N/A'
        };
    });

    flatPhysicalCounts.forEach(item => {
        const key = `${item.nombre}_${item.subinventario}_${item.ubicacionOriginal || item.ubicacion}`.toLowerCase();
        
        if (detailedData[key]) {
            detailedData[key]['Cantidad Física'] += item.cantidadFisica;
            detailedData[key]['ID Conteo'] = item.idConteo;
            detailedData[key]['# Conteo'] = item.numeroConteo;
            detailedData[key]['Auditor'] = item.auditor;
            
            const systemLocs = systemLocationsMap.get(`${item.nombre}_${item.subinventario}`.toLowerCase()) || [];
            const physicalLoc = item.ubicacion;
            detailedData[key]['Desajuste de Localizador'] = systemLocs.includes(physicalLoc) ? 'NO' : 'SI';
            detailedData[key]['Localizador Físico'] = physicalLoc;
            detailedData[key]['Estado'] = ''; // Clear status, will be recalculated
            detailedData[key]['ID_Documento_Firestore'] = item.idConteo;
        } else {
            const sobranteKey = `${item.nombre}_${item.subinventario}_${item.ubicacion}`.toLowerCase();
            if (!detailedData[sobranteKey]) {
                 detailedData[sobranteKey] = {
                    'ID Conteo': item.idConteo,
                    '# Conteo': item.numeroConteo,
                    'Auditor': item.auditor,
                    'Desajuste de Localizador': 'SI',
                    'Subinventario': item.subinventario,
                    'Referencia': item.nombre,
                    'Descripción': item.descripcion || '',
                    'Localizador en Sistema': 'SOBRANTE',
                    'Localizador Físico': item.ubicacion,
                    'Cantidad Sistema': 0,
                    'Cantidad Física': 0, // Accumulate below
                    'Estado': 'SOBRANTE',
                    'ID_Documento_Firestore': item.idConteo
                };
            }
            detailedData[sobranteKey]['Cantidad Física'] += item.cantidadFisica;
        }
    });

    let detailedReport = Object.values(detailedData).map(item => {
        const diferencia = item['Cantidad Física'] - item['Cantidad Sistema'];
        if (item.Estado === '') { // Recalculate status only for items that were found
            if (diferencia > 0) item.Estado = 'SOBRANTE';
            else if (diferencia < 0) item.Estado = 'FALTANTE';
            else item.Estado = 'OK';
        }
        
        const costData = costsMap.get(item.Referencia) || { costo: 0, tecnologia: '', naturaleza: '' };
        const costoUnitario = costData.costo;
        const valorSistema = item['Cantidad Sistema'] * costoUnitario;
        const valorFisico = item['Cantidad Física'] * costoUnitario;
        const valorDiferencia = diferencia * costoUnitario;

        return {
            ...item,
            'Diferencia': diferencia,
            'Tecnologia': costData.tecnologia,
            'Naturaleza': costData.naturaleza,
            'Costo Unitario': costoUnitario,
            'Valor Sistema': valorSistema,
            'Valor Físico': valorFisico,
            'Valor Diferencia': valorDiferencia
        }
    });

    // APPLY FILTERS
    if (filters.sobrantes && !filters.faltantes && !filters.sinDiferencia) {
        detailedReport = detailedReport.filter(item => item.Diferencia > 0);
    }
    if (filters.faltantes && !filters.sobrantes && !filters.sinDiferencia) {
        detailedReport = detailedReport.filter(item => item.Diferencia < 0);
    }
    if (filters.sinDiferencia && !filters.sobrantes && !filters.faltantes) {
        detailedReport = detailedReport.filter(item => item.Diferencia === 0);
    }
    if (filters.referencia) {
        detailedReport = detailedReport.filter(item => item.Referencia.toLowerCase().includes(filters.referencia.toLowerCase()));
    }
    if (filters.localizador) {
        detailedReport = detailedReport.filter(item => item['Localizador Físico'].toLowerCase().includes(filters.localizador.toLowerCase()));
    }
    if (filters.subinventario) {
        detailedReport = detailedReport.filter(item => item.Subinventario.toLowerCase().includes(filters.subinventario.toLowerCase()));
    }

    const finalReports = {};

    if (filters.includeDetailed) {
        const reportSheet = detailedReport.map(item => ({
            'ID Conteo': item['ID Conteo'],
            '# Conteo': item['# Conteo'],
            'Auditor': item.Auditor,
            'Desajuste de Localizador': item['Desajuste de Localizador'],
            'Subinventario': item.Subinventario,
            'Referencia': item.Referencia,
            'Descripción': item.Descripción,
            'Localizador en Sistema': item['Localizador en Sistema'],
            'Localizador Físico': item['Localizador Físico'],
            'Estado': item.Estado,
            'Cant. Sistema': item['Cantidad Sistema'],
            'Cant. Física': item['Cantidad Física'],
            'Diferencia': item.Diferencia,
            'Costo Unit.': item['Costo Unitario'],
            'Valor Sistema': item['Valor Sistema'],
            'Valor Físico': item['Valor Físico'],
            'Valor Diferencia': item['Valor Diferencia'],
            'ID_Documento_Firestore': item['ID_Documento_Firestore']
        }));
        finalReports.detailed = XLSX.utils.json_to_sheet(reportSheet);
    }

    if (filters.includeNationalConsolidated) {
        const nationalConsolidatedData = {};
        detailedReport.forEach(item => {
            const key = item.Referencia.toLowerCase();
            if (!nationalConsolidatedData[key]) {
                nationalConsolidatedData[key] = {
                    'Referencia': item.Referencia,
                    'Descripción': item.Descripción,
                    'Tecnologia': item.Tecnologia,
                    'Naturaleza': item.Naturaleza,
                    'Subinventarios': new Set(),
                    'Localizadores': new Set(),
                    'Desajustes': [], // To aggregate mismatch statuses
                    'Cantidad Sistema': 0,
                    'Cantidad Física': 0,
                    'Costo Unitario': item['Costo Unitario'],
                };
            }
            nationalConsolidatedData[key]['Subinventarios'].add(item.Subinventario);
            nationalConsolidatedData[key]['Localizadores'].add(item['Localizador Físico']);
            nationalConsolidatedData[key]['Desajustes'].push(item['Desajuste de Localizador']);
            nationalConsolidatedData[key]['Cantidad Sistema'] += item['Cantidad Sistema'];
            nationalConsolidatedData[key]['Cantidad Física'] += item['Cantidad Física'];
        });

        const nationalConsolidatedReport = Object.values(nationalConsolidatedData).map(item => {
            const diferencia = item['Cantidad Física'] - item['Cantidad Sistema'];
            let resumenDeEstados = 'OK';
            if (diferencia > 0) resumenDeEstados = 'SOBRANTE';
            if (diferencia < 0) resumenDeEstados = 'FALTANTE';

            const desajusteDeLocalizador = item.Desajustes.includes('SI') ? 'SI' : 'NO';

            return {
                'Referencia': item.Referencia,
                'Descripción': item.Descripción,
                'Subinventarios': [...item.Subinventarios].join(', '),
                'Localizadores': [...item.Localizadores].join(', '),
                'Tecnologia': item.Tecnologia,
                'Naturaleza': item.Naturaleza,
                'Cantidad Sistema': item['Cantidad Sistema'],
                'Cantidad Física': item['Cantidad Física'],
                'Diferencia': diferencia,
                'Resumen de Estados': resumenDeEstados,
                'Desajuste de Localizador': desajusteDeLocalizador,
                'Costo Unit.': item['Costo Unitario'],
                'Valor Sistema': item['Cantidad Sistema'] * item['Costo Unitario'],
                'Valor Físico': item['Cantidad Física'] * item['Costo Unitario'],
                'Valor Diferencia': diferencia * item['Costo Unitario'],
            };
        });

        finalReports.nationalConsolidated = XLSX.utils.json_to_sheet(nationalConsolidatedReport, {header: [
            "Referencia", "Descripción", "Subinventarios", "Localizadores", "Tecnologia", "Naturaleza", 
            "Cantidad Sistema", "Cantidad Física", "Diferencia", "Resumen de Estados", 
            "Desajuste de Localizador", "Costo Unit.", "Valor Sistema", "Valor Físico", "Valor Diferencia"
        ]});
    }

    // Financial Report
    const totalSistema = detailedReport.reduce((sum, item) => sum + item['Valor Sistema'], 0);
    const totalFisico = detailedReport.reduce((sum, item) => sum + item['Valor Físico'], 0);
    const totalSobrantes = detailedReport.filter(i => i.Estado === 'SOBRANTE').reduce((sum, item) => sum + item['Valor Diferencia'], 0);
    const totalFaltantes = detailedReport.filter(i => i.Estado === 'FALTANTE').reduce((sum, item) => sum + Math.abs(item['Valor Diferencia']), 0);

    const financialData = [
        { 'Métrica': 'Valor Total del Inventario (Según Sistema)', 'Valor': totalSistema },
        { 'Métrica': 'Valor Total del Inventario (Contado Físico)', 'Valor': totalFisico },
        { 'Métrica': 'Valor Total de la Diferencia (Neta)', 'Valor': totalFisico - totalSistema },
        { 'Métrica': ' ', 'Valor': ' ' },
        { 'Métrica': 'Valor Total en SOBRANTES', 'Valor': totalSobrantes },
        { 'Métrica': 'Valor Total en FALTANTES', 'Valor': totalFaltantes },
    ];
    finalReports.financialReport = XLSX.utils.json_to_sheet(financialData);

    return finalReports;
}