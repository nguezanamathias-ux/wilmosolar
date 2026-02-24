// Gestion des modals
function openModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.add('active');
}

function closeModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.remove('active');
}

window.openModal = openModal;
window.closeModal = closeModal;

// Delegate clicks on elements with data-modal attribute to open modals
document.addEventListener('click', function(e) {
    const opener = e.target.closest && e.target.closest('[data-modal]');
    if (opener) {
        const modalId = opener.getAttribute('data-modal');
        if (modalId) {
            e.preventDefault();
            openModal(modalId);
        }
    }
});

// Fallback: attach direct handlers to action-card elements
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.action-card[data-modal]').forEach(el => {
        el.addEventListener('click', function(e) {
            try {
                e.preventDefault();
                const modalId = this.getAttribute('data-modal');
                if (modalId) openModal(modalId);
            } catch (err) {
                console.error('action-card click error', err);
            }
        });
    });
});

// Close modal when clicking close button or clicking on the overlay
document.addEventListener('click', function(e) {
    const closeBtn = e.target.closest && e.target.closest('.close-modal');
    if (closeBtn) {
        const modal = closeBtn.closest('.modal');
        if (modal) {
            e.preventDefault();
            modal.classList.remove('active');
        }
        return;
    }

    // Clicking on the overlay itself (outside modal-content) should close
    const clickedModal = e.target.closest && e.target.closest('.modal');
    if (clickedModal && e.target === clickedModal) {
        clickedModal.classList.remove('active');
    }
});

// Sélection de méthode de paiement
let selectedPaymentMethod = null;

// Initialize payment method click handlers when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.payment-method').forEach(pm => {
        pm.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();

            const method = this.getAttribute('data-method');
            selectPaymentMethod(this, method);
        });
    });
});

window.selectPaymentMethod = function(el, method) {
    selectedPaymentMethod = method;

    // Remove selected class from all payment methods
    document.querySelectorAll('.payment-method').forEach(pm => {
        pm.classList.remove('selected');
    });

    // Add selected class to clicked element
    if (el && el.classList) {
        el.classList.add('selected');
    }

    // Store method in form
    const form = document.getElementById('form-recharge');
    if (form) {
        let hidden = form.querySelector('input[name="method"]');
        if (!hidden) {
            hidden = document.createElement('input');
            hidden.type = 'hidden';
            hidden.name = 'method';
            form.appendChild(hidden);
        }
        hidden.value = method;
    }
};

// Handle deposit form submission to show USSD confirmation
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('form-recharge');
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();

            // Check if payment method is selected
            if (!selectedPaymentMethod) {
                alert('⚠️ Veuillez choisir une méthode de paiement');
                return;
            }

            // Get form values
            const amount = form.querySelector('input[name="amount"]').value;
            const payment_phone = form.querySelector('input[name="payment_phone"]').value;
            const _csrf = form.querySelector('input[name="_csrf"]').value;

            console.log('Form data:', { amount, payment_phone, method: selectedPaymentMethod, _csrf });

            // Build URL-encoded params
            const params = new URLSearchParams();
            params.append('amount', amount);
            params.append('payment_phone', payment_phone);
            params.append('method', selectedPaymentMethod);
            params.append('_csrf', _csrf);

            try {
                console.log('Submitting deposit...');
                const response = await fetch('/user/deposit', {
                    method: 'POST',
                    body: params.toString(),
                    credentials: 'same-origin',
                    headers: { 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8', 'X-CSRF-Token': _csrf }
                });

                console.log('Response status:', response.status);
                const contentType = response.headers.get('content-type') || '';
                let data;
                if (contentType.indexOf('application/json') !== -1) {
                    data = await response.json();
                } else {
                    // Received HTML (probably a redirect/login page or error page)
                    const text = await response.text();
                    throw new Error('Serveur a renvoyé du HTML. Vous êtes peut-être déconnecté. Response: ' + text.slice(0, 300));
                }
                console.log('Response data:', data);

                if (response.ok && data.success) {
                    // Reset form
                    form.reset();
                    selectedPaymentMethod = null;
                    document.querySelectorAll('.payment-method').forEach(pm => pm.classList.remove('selected'));

                    // Show USSD confirmation modal
                    showUSSDConfirmation(data);
                } else {
                    alert('❌ Erreur: ' + (data.error || 'Erreur serveur'));
                }
            } catch (err) {
                console.error('Error:', err);
                alert('❌ Erreur de connexion: ' + err.message);
            }
        });
    }
});

// Retrait: statut, validation, recap des frais et soumission AJAX
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('form-retrait');
    if (!form) return;

    const MIN_WITHDRAW = 2500;
    const withdrawInput = document.getElementById('withdrawal-amount');
    const netInput = document.getElementById('withdrawal-net');
    const feedback = document.getElementById('withdrawal-feedback');
    const statusChip = document.getElementById('withdrawal-status');
    const amountEl = document.getElementById('wd-amount');
    const feeEl = document.getElementById('wd-fee');
    const netEl = document.getElementById('wd-net');
    const submitBtn = form.querySelector('button[type="submit"]');

    function formatFcfa(v) {
        return Math.round(Number(v || 0)).toLocaleString('fr-FR') + ' FCFA';
    }

    function isWithdrawWindowOpen(now) {
        const day = now.getDay();
        const hour = now.getHours();
        const isOpenDay = day >= 1 && day <= 5;
        const isOpenHour = hour >= 10 && hour < 17;
        return isOpenDay && isOpenHour;
    }

    function setWithdrawStatus() {
        const open = isWithdrawWindowOpen(new Date());
        if (statusChip) {
            statusChip.classList.remove('withdrawal-status-open', 'withdrawal-status-closed');
            statusChip.textContent = open ?'Retraits ouverts' : 'Retraits fermes';
            statusChip.classList.add(open ?'withdrawal-status-open' : 'withdrawal-status-closed');
        }
        if (!open && feedback) {
            feedback.textContent = 'Les demandes sont ouvertes de 10h a 17h (lundi a vendredi).';
            feedback.classList.add('error');
        }
        return open;
    }

    function updateWithdrawPreview() {
        const amount = parseFloat(withdrawInput && withdrawInput.value) || 0;
        const fee = amount * 0.15;
        const net = Math.max(0, amount - fee);

        if (amountEl) amountEl.textContent = formatFcfa(amount);
        if (feeEl) feeEl.textContent = formatFcfa(fee);
        if (netEl) netEl.textContent = formatFcfa(net);
        if (netInput) netInput.value = formatFcfa(net);

        if (!feedback) return;
        if (amount > 0 && amount < MIN_WITHDRAW) {
            feedback.textContent = 'Le minimum autorise est de 2 500 FCFA.';
            feedback.classList.add('error');
        } else if (setWithdrawStatus()) {
            feedback.textContent = 'Votre demande sera traitee entre 10h et 17h, du lundi au vendredi.';
            feedback.classList.remove('error');
        }
    }

    setWithdrawStatus();
    updateWithdrawPreview();
    setInterval(setWithdrawStatus, 60000);

    if (withdrawInput) {
        withdrawInput.addEventListener('input', updateWithdrawPreview);
    }

    form.addEventListener('submit', function(e) {
        e.preventDefault();

        const amount = parseFloat(withdrawInput && withdrawInput.value) || 0;
        if (amount < MIN_WITHDRAW) {
            alert('Le montant minimum de retrait est 2 500 FCFA.');
            return;
        }

        // disable button to prevent double submission and show feedback
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Envoi...';
        }

        // Fallback robuste: soumission normale du formulaire
        form.submit();
    });
});
// Copier dans le presse-papier
window.copyToClipboard = function(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            alert('✅ Lien copié !');
        }).catch(() => {
            // Fallback pour les navigateurs qui ne supportent pas la Clipboard API
            copyToClipboardFallback(text);
        });
    } else {
        // Fallback direct pour localhost/HTTP
        copyToClipboardFallback(text);
    }
};

window.copyToClipboardFallback = function(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    try {
        document.execCommand('copy');
        alert('✅ Lien copié !');
    } catch (err) {
        alert('❌ Erreur de copie');
    }
    document.body.removeChild(textArea);
};

// Déconnexion
window.logout = function() {
    window.location.href = '/logout';
};

// Show USSD Confirmation
window.showUSSDConfirmation = function(depositData) {
    closeModal('modal-recharge');

    let ussdModal = document.getElementById('modal-ussd-confirm');
    if (ussdModal) ussdModal.remove();

    ussdModal = document.createElement('div');
    ussdModal.id = 'modal-ussd-confirm';
    ussdModal.className = 'modal';
    ussdModal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <button class="close-modal ussd-close-btn" type="button">x</button>
            <h2 class="modal-header" style="color: var(--success); font-size: 1.3em;">Recharge Creee</h2>

            <div style="background: rgba(0, 255, 136, 0.15); border: 1px solid var(--success); border-radius: 10px; padding: 15px; margin: 20px 0; color: var(--success);">
                Recharge de <strong id="ussd-amount"></strong> FCFA en attente
            </div>

            <h3 id="ussd-title" style="color: var(--text-secondary); margin: 20px 0 10px; font-size: 1em;">Composez ce code :</h3>

            <div style="background: rgba(255, 107, 0, 0.15); border: 2px dashed var(--primary-color); border-radius: 15px; padding: 20px; margin: 15px 0; text-align: center;">
                <div style="font-family: monospace; font-size: 2em; color: var(--primary-color); font-weight: 700; letter-spacing: 2px; word-break: break-all; margin-bottom: 10px;" id="ussd-code"></div>
            </div>

            <div style="background: rgba(0, 217, 255, 0.1); border: 1px solid var(--accent-blue); border-radius: 10px; padding: 15px; margin: 15px 0; color: var(--accent-blue); font-size: 0.9em; line-height: 1.6;">
                <strong>Instructions :</strong>
                <div id="ussd-instructions" style="margin-top: 10px;">
                    1. Composez le code ci-dessus<br>
                    2. Entrez le montant : <strong id="method-amount"></strong> FCFA<br>
                    3. Confirmez la transaction<br>
                    4. Attendez l'ID transaction<br>
                    5. Saisissez l'ID transaction ci-dessous
                </div>
            </div>

            <form id="ussd-confirm-form">
                <input type="hidden" name="_csrf" id="csrf-token">
                <input type="hidden" name="deposit_id" id="deposit-id">
                <input type="hidden" name="amount" id="deposit-amount">
                <input type="hidden" name="method" id="deposit-method">
                <input type="hidden" name="payment_phone" id="deposit-phone">

                <div class="form-group">
                    <label class="form-label">ID Transaction (du SMS)</label>
                    <input type="text" class="form-input" name="transaction_code" placeholder="Entrez l'ID transaction" required style="font-size: 1.1em; text-align: center; letter-spacing: 2px;">
                </div>

                <div style="display: flex; gap: 10px;">
                    <button type="button" class="btn btn-secondary ussd-cancel-btn" style="flex: 1;">Annuler</button>
                    <button type="submit" class="btn btn-primary" style="flex: 1;">Valider</button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(ussdModal);

    const closeBtn = ussdModal.querySelector('.ussd-close-btn');
    const cancelBtn = ussdModal.querySelector('.ussd-cancel-btn');
    if (closeBtn) closeBtn.addEventListener('click', () => closeModal('modal-ussd-confirm'));
    if (cancelBtn) cancelBtn.addEventListener('click', () => closeModal('modal-ussd-confirm'));

    const amountNum = Number(depositData.amount) || 0;
    const isMtn = depositData.method === 'mobile_money';
    const transferNumber = String(depositData.transferNumber || '652251784');
    const orangeRecipientName = String(depositData.orangeRecipientName || '').trim();

    const ussdAmountEl = document.getElementById('ussd-amount');
    const ussdCodeEl = document.getElementById('ussd-code');
    const methodAmountEl = document.getElementById('method-amount');
    const csrfEl = document.getElementById('csrf-token');
    const depositIdEl = document.getElementById('deposit-id');
    const depositAmountEl = document.getElementById('deposit-amount');
    const depositMethodEl = document.getElementById('deposit-method');
    const depositPhoneEl = document.getElementById('deposit-phone');

    if (!ussdAmountEl || !ussdCodeEl || !methodAmountEl || !csrfEl || !depositIdEl || !depositAmountEl || !depositMethodEl || !depositPhoneEl) {
        alert("Erreur: impossible d'ouvrir la confirmation USSD. Rechargez la page.");
        return;
    }

    ussdAmountEl.textContent = amountNum.toLocaleString();
    ussdCodeEl.textContent = depositData.ussdCode;
    methodAmountEl.textContent = amountNum.toLocaleString();

    const instructionsEl = document.getElementById('ussd-instructions');
    const titleEl = document.getElementById('ussd-title');
    if (instructionsEl) {
        if (isMtn) {
            if (titleEl) titleEl.textContent = 'Pour MTN, composez :';
            instructionsEl.innerHTML = `
                1. Composez <strong>*126#</strong><br>
                2. Choisissez l'option de transfert d'argent<br>
                3. Entrez le numero destinataire : <strong>${transferNumber}</strong><br>
                4. Entrez le montant exact : <strong>${amountNum.toLocaleString()}</strong> FCFA<br>
                5. Confirmez le transfert puis saisissez l'ID transaction ci-dessous
            `;
        } else {
            if (titleEl) titleEl.textContent = 'Composez ce code :';
            instructionsEl.innerHTML = `
                1. Composez le code ci-dessus<br>
                2. Entrez le montant : <strong>${amountNum.toLocaleString()}</strong> FCFA<br>
                3. Verifiez le nom affiche : <strong>${orangeRecipientName || 'N/A'}</strong><br>
                4. Confirmez la transaction<br>
                5. Attendez l'ID transaction puis saisissez-le ci-dessous
            `;
        }
    }

    const csrfInput = document.querySelector('input[name="_csrf"]');
    csrfEl.value = csrfInput ? csrfInput.value : '';
    depositIdEl.value = depositData.depositId;
    depositAmountEl.value = depositData.amount;
    depositMethodEl.value = depositData.method;
    depositPhoneEl.value = depositData.paymentPhone;

    const ussdForm = document.getElementById('ussd-confirm-form');
    if (ussdForm && !ussdForm.dataset.bound) {
        ussdForm.addEventListener('submit', function(e) {
            submitUSSDCode(e, ussdForm);
        });
        ussdForm.dataset.bound = '1';
    }

    openModal('modal-ussd-confirm');
};

// Submit USSD code
window.submitUSSDCode = async function(e, form) {
    e.preventDefault();

    const formParams = new URLSearchParams(new FormData(form));

    try {
        // Try to read csrf token from hidden input first
        const _csrf = form.querySelector('#csrf-token') ?form.querySelector('#csrf-token').value : (form.querySelector('input[name="_csrf"]') ?form.querySelector('input[name="_csrf"]').value : '');
        const response = await fetch('/user/ussd-confirm', {
            method: 'POST',
            body: formParams.toString(),
            credentials: 'same-origin',
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8', 'X-CSRF-Token': _csrf }
        });

        const contentType = response.headers.get('content-type') || '';
        if (contentType.indexOf('application/json') !== -1) {
            const data = await response.json();
            if (response.ok && data.success) {
                alert('✅ Transaction validée !');
                closeModal('modal-ussd-confirm');
                window.location.href = '/user/dashboard';
            } else {
                alert('❌ ' + (data.error || 'Erreur serveur'));
            }
        } else {
            const text = await response.text();
            alert('❌ Réponse inattendue du serveur. Vous êtes peut-être déconnecté.');
            console.error('Unexpected HTML response:', text);
        }
    } catch (err) {
        console.error(err);
        alert('❌ Erreur de connexion');
    }
};

// Copy referral link functionality
document.addEventListener('DOMContentLoaded', function() {
    const copyBtn = document.getElementById('copy-btn');
    if (!copyBtn) return;
    
    copyBtn.addEventListener('click', function(e) {
        e.preventDefault();
        
        const input = document.getElementById('referral-link');
        if (!input) {
            console.error('Input #referral-link not found');
            return;
        }
        
        const text = input.value;
        if (!text) {
            alert('❌ Le lien est vide');
            return;
        }
        
        console.log('Copying referral link:', text);
        
        // Try Clipboard API first
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text)
                .then(() => showCopySuccess(copyBtn, text))
                .catch(err => {
                    console.error('Clipboard API failed:', err);
                    fallbackCopy(text, copyBtn);
                });
        } else {
            fallbackCopy(text, copyBtn);
        }
    });
});

function fallbackCopy(text, btn) {
    try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.top = '0';
        textarea.style.left = '0';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        
        if (success) {
            showCopySuccess(btn, text);
        } else {
            alert('❌ Erreur: Copie échouée');
        }
    } catch (err) {
        console.error('Fallback copy error:', err);
        alert('❌ Erreur: ' + err.message);
    }
}

function showCopySuccess(btn, text) {
    if (!btn) return;
    
    const originalText = btn.textContent;
    btn.textContent = '✅ Copié !';
    btn.style.background = '#4CAF50';
    btn.style.color = 'white';
    
    console.log('✅ Referral link copied successfully:', text);
    
    setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = '';
        btn.style.color = '';
    }, 2000);
}
