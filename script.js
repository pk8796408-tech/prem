document.addEventListener('DOMContentLoaded', () => {

    // ── Views ──────────────────────────────────────────────────────
    const registrationView = document.getElementById('registration-view');
    const paymentView = document.getElementById('payment-view');
    const successView = document.getElementById('success-view');

    // ── Form elements ───────────────────────────────────────────────
    const form = document.getElementById('registration-form');
    const chips = document.querySelectorAll('.chip');
    const guestMinusBtn = document.getElementById('guest-minus');
    const guestPlusBtn = document.getElementById('guest-plus');
    const guestCountSpan = document.getElementById('guest-count');

    // ── Payment elements ────────────────────────────────────────────
    const payBackBtn = document.getElementById('pay-back-btn');
    const upiQrInner = document.getElementById('upi-qr-inner');
    const upiIdDisplay = document.getElementById('upi-id-display');
    const upiCopyBtn = document.getElementById('upi-copy-btn');
    const payGuestNote = document.getElementById('pay-guest-note');
    const payGuestFee = document.getElementById('pay-guest-fee');
    const payTotal = document.getElementById('pay-total');
    const utrInput = document.getElementById('utr-input');
    const utrStatus = document.getElementById('utr-status');
    const utrError = document.getElementById('utr-error');
    const confirmPayBtn = document.getElementById('confirm-pay-btn');

    // ── UPI deep-link buttons ───────────────────────────────────────
    const btnGpay = document.getElementById('btn-gpay');
    const btnPhonePe = document.getElementById('btn-phonepe');
    const btnPaytm = document.getElementById('btn-paytm');
    const btnBhim = document.getElementById('btn-bhim');

    // ── State ───────────────────────────────────────────────────────
    let guestCount = 0;
    const MAX_GUESTS = 3;
    const BASE_FEE = 149;   // delegate fee
    const GUEST_FEE = 99;    // per guest
    let pendingFormData = null; // stored between steps

    // ── Helpers: View Transitions ───────────────────────────────────
    function showView(hide, show) {
        hide.classList.add('hidden');
        hide.classList.remove('active');
        setTimeout(() => {
            show.classList.remove('hidden');
            void show.offsetWidth;
            show.classList.add('active');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 280);
    }

    // ── Chip Selection ──────────────────────────────────────────────
    chips.forEach(chip => {
        chip.addEventListener('click', () => {
            chips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
        });
    });

    // ── Guest Counter ───────────────────────────────────────────────
    function updateCounter() {
        guestCountSpan.textContent = guestCount;
        guestMinusBtn.disabled = guestCount <= 0;
        guestPlusBtn.disabled = guestCount >= MAX_GUESTS;
        updateFeeDisplay();
    }

    guestMinusBtn.addEventListener('click', () => { if (guestCount > 0) { guestCount--; updateCounter(); } });
    guestPlusBtn.addEventListener('click', () => { if (guestCount < MAX_GUESTS) { guestCount++; updateCounter(); } });

    // ── Fee Calculation ─────────────────────────────────────────────
    function updateFeeDisplay() {
        const gFee = guestCount * GUEST_FEE;
        const total = BASE_FEE + gFee;
        if (payGuestNote) payGuestNote.textContent = guestCount > 0 ? `(×${guestCount})` : '';
        if (payGuestFee) payGuestFee.textContent = `₹${gFee}`;
        if (payTotal) payTotal.textContent = `₹${total}`;
        return total;
    }

    // ── STEP 1 → 2: Form Submit ─────────────────────────────────────
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Processing… <span class="arrow">→</span>';

        pendingFormData = {
            fullName: document.getElementById('full-name').value.trim(),
            college: sessionStorage.getItem('verifiedCollege') || '',
            email: document.getElementById('email').value.trim(),
            year: document.getElementById('year').value,
            dietary: document.querySelector('.chip.active')?.dataset.value || 'none',
            guests: guestCount
        };

        // Show payment view
        updateFeeDisplay();
        showView(registrationView, paymentView);

        // Generate UPI QR
        await generateUPIQR(BASE_FEE + guestCount * GUEST_FEE);

        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Register Now <span class="arrow">→</span>';
    });

    // ── Back Button ─────────────────────────────────────────────────
    if (payBackBtn) {
        payBackBtn.addEventListener('click', () => {
            showView(paymentView, registrationView);
        });
    }

    // ── Generate UPI QR ─────────────────────────────────────────────
    async function generateUPIQR(amount) {
        if (!upiQrInner) { console.error('upi-qr-inner element not found'); return; }

        // Show spinner
        upiQrInner.innerHTML = `
            <div class="upi-qr-loading">
                <div class="upi-spinner"></div>
                <span>Generating QR…</span>
            </div>`;

        try {
            console.log('[UPI] Fetching QR for amount:', amount);
            const res = await fetch('/api/upi-qr', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount })
            });
            const data = await res.json();
            console.log('[UPI] Response success:', data.success, '| QR length:', data.qr?.length);

            if (data.success && data.qr) {
                // Only put the img inside the white QR box — no overlapping badge
                upiQrInner.innerHTML = `<img src="${data.qr}" alt="Scan & Pay" class="upi-qr-img">`;

                // Show UPI ID in the row below
                if (upiIdDisplay) upiIdDisplay.textContent = data.upiId;

                // UPI deep-links for each app (standard upi:// for BHIM, app-specific for others)
                const params = data.upiUrl.split('?')[1] || '';
                if (btnGpay) btnGpay.href = `tez://upi/pay?${params}`;
                if (btnPhonePe) btnPhonePe.href = `phonepe://pay?${params}`;
                if (btnPaytm) btnPaytm.href = `paytmmp://pay?${params}`;
                if (btnBhim) btnBhim.href = data.upiUrl;
            } else {
                throw new Error(data.error || 'API returned success=false');
            }
        } catch (err) {
            console.error('[UPI] QR generation failed:', err);
            upiQrInner.innerHTML = `<div class="upi-qr-error">⚠️ Could not load QR.<br>Pay manually to UPI ID below.</div>`;
        }
    }

    // ── Copy UPI ID ─────────────────────────────────────────────────
    if (upiCopyBtn) {
        upiCopyBtn.addEventListener('click', async () => {
            const id = upiIdDisplay?.textContent || '';
            try {
                await navigator.clipboard.writeText(id);
                upiCopyBtn.innerHTML = '✓';
                upiCopyBtn.style.color = 'var(--green)';
                setTimeout(() => {
                    upiCopyBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>`;
                    upiCopyBtn.style.color = '';
                }, 2000);
            } catch { }
        });
    }

    // ── UTR Input validation ────────────────────────────────────────
    if (utrInput) {
        utrInput.addEventListener('input', () => {
            const val = utrInput.value.trim();
            const ok = val.length >= 10;

            if (utrError) utrError.style.display = val.length > 0 && !ok ? 'block' : 'none';
            if (utrStatus) {
                utrStatus.textContent = ok ? '✓' : '';
                utrStatus.style.color = 'var(--green)';
            }
            if (confirmPayBtn) confirmPayBtn.disabled = !ok;
        });
    }

    // ── STEP 2 → 3: Confirm Payment ────────────────────────────────
    if (confirmPayBtn) {
        confirmPayBtn.addEventListener('click', async () => {
            const utr = utrInput?.value.trim();
            if (!utr || utr.length < 10) return;

            confirmPayBtn.disabled = true;
            confirmPayBtn.innerHTML = 'Verifying… <span class="arrow">⏳</span>';

            // Build payload — use pendingFormData if available, else read DOM directly
            const formPayload = pendingFormData || {
                fullName: document.getElementById('full-name')?.value?.trim() || '',
                college: sessionStorage.getItem('verifiedCollege') || '',
                email: document.getElementById('email')?.value?.trim() || '',
                year: document.getElementById('year')?.value || 'junior',
                dietary: document.querySelector('.chip.active')?.dataset?.value || 'none',
                guests: 0
            };

            const payload = {
                ...formPayload,
                utr,
                amount: BASE_FEE + (formPayload.guests || 0) * GUEST_FEE
            };

            console.log('[Payment] Sending confirm-payment payload:', payload);

            try {
                const res = await fetch('/api/confirm-payment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                // Handle HTTP-level errors
                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    throw new Error(errData.message || `Server error ${res.status}`);
                }

                const result = await res.json();
                console.log('[Payment] Confirm result:', result);

                if (result.success) {
                    await populateTicket(result);
                    showView(paymentView, successView);
                } else {
                    throw new Error(result.message || 'Payment verification failed.');
                }
            } catch (err) {
                console.error('[Payment] Confirm failed:', err);
                alert('Error: ' + err.message + '\n\nIf this persists, please contact support.');
                confirmPayBtn.disabled = false;
                confirmPayBtn.innerHTML = 'Confirm Payment <span class="arrow">→</span>';
            }
        });
    }


    // ── Populate Ticket ─────────────────────────────────────────────
    async function populateTicket(result) {
        const name = result.registrantName || pendingFormData?.fullName || '—';
        const college = result.college || pendingFormData?.college || '—';
        const ticket = result.ticketId || '—';

        // Summary card
        const summaryName = document.getElementById('summary-name');
        const summaryCollege = document.getElementById('summary-college');
        const summaryTicket = document.getElementById('summary-ticket-id');
        if (summaryName) summaryName.textContent = name;
        if (summaryCollege) summaryCollege.textContent = college;
        if (summaryTicket) summaryTicket.textContent = ticket;

        // Digital ticket
        const ticketIdEl = document.getElementById('ticket-id-el');
        const ticketNameEl = document.getElementById('ticket-name');
        const ticketCollegeEl = document.getElementById('ticket-college');
        const qrImg = document.getElementById('qr-code-img');

        if (ticketIdEl) ticketIdEl.textContent = `ENTRY PASS · ${ticket}`;
        if (ticketNameEl) ticketNameEl.textContent = name;
        if (ticketCollegeEl) ticketCollegeEl.textContent = college;

        // Generate ticket QR code
        if (qrImg) {
            qrImg.style.opacity = '0.3';
            try {
                const qrRes = await fetch('/api/qr', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ticketId: ticket,
                        name,
                        college,
                        email: result.email || pendingFormData?.email,
                        event: 'Annual Tech Symposium 2025'
                    })
                });
                const qrData = await qrRes.json();
                if (qrData.success) {
                    qrImg.src = qrData.qr;
                    qrImg.style.transition = 'opacity 0.5s ease';
                    qrImg.style.opacity = '1';
                }
            } catch (e) { console.warn('Ticket QR failed:', e); }
        }
    }

    // ── Share button ────────────────────────────────────────────────
    const shareBtn = document.getElementById('share-btn');
    if (shareBtn) {
        shareBtn.addEventListener('click', async () => {
            if (navigator.share) {
                try {
                    await navigator.share({
                        title: 'Annual Tech Symposium 2025',
                        text: "I just registered for the Annual Tech Symposium 2025! 🎉 Join me!",
                        url: window.location.href
                    });
                } catch { }
            } else {
                await navigator.clipboard.writeText(window.location.href);
                shareBtn.textContent = '✓ Link Copied!';
                setTimeout(() => { shareBtn.innerHTML = '🔗 Share with Friends'; }, 2500);
            }
        });
    }
});

async function registerUser() {

  const Name = document.getElementById("Name").value
  const email = document.getElementById("email").value
  const Department = document.getElementById("Department").value

  const { data, error } = await supabase
    .from("registrations")
    .insert([
      { Name: Name, email: email, Department: Department }
    ])

  if (error) {
    alert("Error: " + error.message)
    console.log(error)
  } else {
    alert("Registration Successful 🔥")
    console.log(data)
  }
}
document.getElementById("registration-form")
  .addEventListener("submit", async function (e) {

    e.preventDefault(); // page reload stop

    const Name = document.getElementById("Name").value;
    const email = document.getElementById("email").value;
    const Department = document.getElementById("Department").value;

    const { data, error } = await supabase
      .from("registrations")
      .insert([
        { Name: Name, email: email, Department: Department }
      ]);

    if (error) {
      alert("Error: " + error.message);
      console.log(error);
    } else {
      alert("Registration Successful 🔥");
      console.log(data);
    }

});

