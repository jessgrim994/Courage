document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('confirmModal');
    const modalMessage = document.getElementById('modalMessage');
    const confirmButton = document.getElementById('confirmAction');
    const cancelButton = document.getElementById('cancelAction');
    
    let currentAction = null;
    let currentUserId = null;

    // Toggle Admin Status
    document.querySelectorAll('.toggle-admin').forEach(button => {
        button.addEventListener('click', function() {
            const userId = this.dataset.userId;
            const isAdmin = this.dataset.currentStatus === 'True';
            const action = isAdmin ? 'remove admin privileges from' : 'make admin';
            const username = this.closest('tr').querySelector('td').textContent;

            showModal(
                `Are you sure you want to ${action} ${username}?`,
                'toggleAdmin',
                userId
            );
        });
    });

    // Delete User
    document.querySelectorAll('.delete-user').forEach(button => {
        button.addEventListener('click', function() {
            const userId = this.dataset.userId;
            const username = this.closest('tr').querySelector('td').textContent;

            showModal(
                `Are you sure you want to delete user ${username}? This action cannot be undone.`,
                'deleteUser',
                userId
            );
        });
    });

    // Modal Functions
    function showModal(message, action, userId) {
        modalMessage.textContent = message;
        currentAction = action;
        currentUserId = userId;
        modal.style.display = 'block';
    }

    function hideModal() {
        modal.style.display = 'none';
        currentAction = null;
        currentUserId = null;
    }

    // Confirm Action
    confirmButton.addEventListener('click', function() {
        if (currentAction && currentUserId) {
            const urls = {
                toggleAdmin: `/toggle_admin/${currentUserId}`,
                deleteUser: `/delete_user/${currentUserId}`
            };

            window.location.href = urls[currentAction];
        }
        hideModal();
    });

    // Cancel Action
    cancelButton.addEventListener('click', hideModal);
    window.addEventListener('click', function(event) {
        if (event.target === modal) {
            hideModal();
        }
    });

    // Auto-hide flash messages
    const flashMessages = document.querySelectorAll('.alert');
    flashMessages.forEach(message => {
        setTimeout(() => {
            message.style.opacity = '0';
            setTimeout(() => {
                message.remove();
            }, 300);
        }, 5000);
    });

    // Table row hover effect
    document.querySelectorAll('.user-table tbody tr').forEach(row => {
        row.addEventListener('mouseenter', function() {
            this.style.backgroundColor = '#f9fafb';
        });
        row.addEventListener('mouseleave', function() {
            this.style.backgroundColor = '';
        });
    });
}); 