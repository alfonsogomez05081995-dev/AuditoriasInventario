export function showFeedback(element, message, type) {
    element.textContent = message;
    element.className = `feedback ${type}`;
}

export function renderConteoTable(conteoTableBody, conteoFisico, deleteCallback) {
    conteoTableBody.innerHTML = '';
    conteoFisico.forEach((item, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.nombre}</td>
            <td>${item.descripcion}</td>
            <td>${item.ubicacion}</td>
            <td>${item.cantidadFisica}</td>
            <td><button class="btn-delete" data-index="${index}">✖</button></td>
        `;
        row.querySelector('.btn-delete').addEventListener('click', () => deleteCallback(index));
        conteoTableBody.appendChild(row);
    });
}

export function populateSubinventarioSelect(subinventarioSelect, subinventarios) {
    subinventarioSelect.innerHTML = '<option value="">-- Elige un subinventario --</option>';
    if (!subinventarios || subinventarios.length === 0) return;

    subinventarios.forEach(sub => {
        const option = document.createElement('option');
        option.value = sub;
        option.textContent = sub;
        subinventarioSelect.appendChild(option);
    });
}

export function updateFileName(fileNameEl, file) {
    fileNameEl.textContent = file ? file.name : 'Ningún archivo seleccionado';
}

export function clearSelectedAuditUI(
    selectedAuditInfoConteo,
    selectedAuditInfoReporte,
    conteoWrapper,
    reporteWrapper,
    conteoTab,
    reporteTab
) {
    document.querySelectorAll('.audit-item').forEach(el => el.classList.remove('active'));
    selectedAuditInfoConteo.innerHTML = '<p>No hay ninguna auditoría seleccionada.</p>';
    selectedAuditInfoReporte.innerHTML = '<p>Selecciona una auditoría desde la pestaña de gestión para ver esta sección.</p>';
    conteoWrapper.classList.add('hidden');
    reporteWrapper.classList.add('hidden');
    conteoTab.disabled = true;
    reporteTab.disabled = true;
}

export function selectAuditUI(
    audit,
    selectedAuditInfoConteo,
    selectedAuditInfoReporte,
    conteoWrapper,
    reporteWrapper,
    conteoTab,
    reporteTab,
    finalizeAuditButton,
    subinventarioSelect,
    conteoFormSection
) {
    document.querySelectorAll('.audit-item').forEach(el => el.classList.remove('active'));
    const auditElement = document.querySelector(`.select-audit-btn[data-id="${audit.id}"]`)?.closest('.audit-item');
    if(auditElement) auditElement.classList.add('active');

    const auditInfoHTML = `<h3>Auditoría Seleccionada: <span class="highlight">${audit.name}</span></h3>`;
    selectedAuditInfoConteo.innerHTML = auditInfoHTML;
    selectedAuditInfoReporte.innerHTML = auditInfoHTML;

    conteoWrapper.classList.remove('hidden');
    reporteWrapper.classList.remove('hidden');
    conteoTab.disabled = false;
    reporteTab.disabled = false;

    populateSubinventarioSelect(subinventarioSelect, audit.subinventarios || []);
    conteoFormSection.classList.add('hidden');

    if (audit.status === 'completed') {
        finalizeAuditButton.disabled = true;
        conteoWrapper.classList.add('hidden');
    } else {
        finalizeAuditButton.disabled = false;
    }
}

export function renderAudits(auditsListEl, audits, selectAuditCallback, archiveAuditCallback) {
    auditsListEl.innerHTML = '';
    if (audits.length === 0) {
        auditsListEl.innerHTML = '<p>No hay auditorías activas. ¡Crea la primera!</p>';
        return;
    }

    audits.forEach(audit => {
        const auditEl = document.createElement('div');
        auditEl.className = `audit-item status-${audit.status}`;
        auditEl.innerHTML = `
            <div class="audit-info">
                <span class="audit-name">${audit.name}</span>
                <span class="audit-meta">Creada por ${audit.createdBy} el ${new Date(audit.createdAt.seconds * 1000).toLocaleDateString()}</span>
                <span class="audit-meta">(${audit.itemCount} artículos)</span>
            </div>
            <div class="audit-actions">
                <span class="audit-status">${audit.status === 'in-progress' ? 'En Progreso' : 'Finalizada'}</span>
                <button class="btn btn-secondary btn-sm select-audit-btn" data-id="${audit.id}">Seleccionar</button>
                <button class="btn btn-warning btn-sm archive-audit-btn" data-id="${audit.id}">Archivar</button>
            </div>
        `;
        auditsListEl.appendChild(auditEl);
    });

    document.querySelectorAll('.select-audit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => selectAuditCallback(e.target.dataset.id));
    });

    document.querySelectorAll('.archive-audit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => archiveAuditCallback(e.target.dataset.id));
    });
}

export function showLoader() {
    document.getElementById('loader-overlay').classList.remove('hidden');
}

export function hideLoader() {
    document.getElementById('loader-overlay').classList.add('hidden');
}
