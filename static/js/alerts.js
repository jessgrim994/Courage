class AlertsManager {
    constructor() {
        this.modal = document.getElementById('createAlertModal');
        this.form = document.getElementById('alertForm');
        this.createBtn = document.querySelector('.create-alert-btn');
        this.closeBtn = document.querySelector('.modal-close');
        this.alertTypeSelect = document.querySelector('select[name="alert_type"]');
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Modal controls
        this.createBtn?.addEventListener('click', () => this.openModal());
        this.closeBtn?.addEventListener('click', () => this.closeModal());
        window.addEventListener('click', (e) => {
            if (e.target === this.modal) this.closeModal();
        });

        // Form submission
        this.form?.addEventListener('submit', (e) => this.handleSubmit(e));

        // Alert type change
        this.alertTypeSelect?.addEventListener('change', () => this.toggleConditionFields());

        // Delete buttons
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleDelete(e));
        });

        // Edit buttons
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleEdit(e));
        });
    }

    openModal() {
        if (this.modal) {
            this.modal.style.display = 'block';
            document.body.style.overflow = 'hidden';
        }
    }

    closeModal() {
        if (this.modal) {
            this.modal.style.display = 'none';
            document.body.style.overflow = 'auto';
            this.form?.reset();
        }
    }

    toggleConditionFields() {
        const alertType = this.alertTypeSelect.value;
        const priceFields = document.querySelectorAll('.condition-price');
        const digitField = document.querySelector('.condition-digit');
        const streakField = document.querySelector('.condition-streak');

        // Hide all condition fields first
        [priceFields, digitField, streakField].forEach(fields => {
            if (fields instanceof NodeList) {
                fields.forEach(field => field.style.display = 'none');
            } else if (fields) {
                fields.style.display = 'none';
            }
        });

        // Show relevant fields based on alert type
        switch (alertType) {
            case 'price':
                priceFields.forEach(field => field.style.display = 'block');
                break;
            case 'digit':
                if (digitField) digitField.style.display = 'block';
                break;
            case 'streak':
                if (streakField) streakField.style.display = 'block';
                break;
        }
    }

    async handleSubmit(e) {
        e.preventDefault();
        const formData = new FormData(this.form);
        const alertData = Object.fromEntries(formData.entries());

        try {
            const response = await fetch('/api/alerts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(alertData)
            });

            if (response.ok) {
                this.closeModal();
                this.showNotification('Alert created successfully', 'success');
                // Refresh alerts list
                location.reload();
            } else {
                throw new Error('Failed to create alert');
            }
        } catch (error) {
            this.showNotification(error.message, 'error');
        }
    }

    async handleDelete(e) {
        const alertCard = e.target.closest('.alert-card');
        const alertId = alertCard.dataset.alertId;

        if (confirm('Are you sure you want to delete this alert?')) {
            try {
                const response = await fetch(`/api/alerts/${alertId}`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    alertCard.remove();
                    this.showNotification('Alert deleted successfully', 'success');
                } else {
                    throw new Error('Failed to delete alert');
                }
            } catch (error) {
                this.showNotification(error.message, 'error');
            }
        }
    }

    handleEdit(e) {
        const alertCard = e.target.closest('.alert-card');
        const alertData = {
            id: alertCard.dataset.alertId,
            pair: alertCard.querySelector('h3').textContent,
            condition: alertCard.querySelector('[data-condition]').dataset.condition,
            target_price: alertCard.querySelector('[data-price]').dataset.price
        };

        this.populateForm(alertData);
        this.openModal();
    }

    populateForm(data) {
        const form = this.form;
        if (!form) return;

        form.querySelector('[name="pair"]').value = data.pair;
        form.querySelector('[name="condition"]').value = data.condition;
        form.querySelector('[name="target_price"]').value = data.target_price;
    }

    showNotification(message, type = 'info') {
        // Assuming you have a notification system
        const event = new CustomEvent('showNotification', {
            detail: { message, type }
        });
        window.dispatchEvent(event);
    }
}

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', () => {
    window.alertsManager = new AlertsManager();
}); 