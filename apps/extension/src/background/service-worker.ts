/**
 * ZMK Trendyol Extension — Service Worker (Background)
 * Handles authentication state and API communication
 */

const API_BASE = 'http://localhost:4000/api';

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
        case 'LOGIN':
            handleLogin(message.payload).then(sendResponse).catch((err) =>
                sendResponse({ success: false, error: err.message }),
            );
            return true; // async

        case 'CHECK_AUTH':
            checkAuth().then(sendResponse).catch((err) =>
                sendResponse({ success: false, error: err.message }),
            );
            return true;

        case 'API_REQUEST':
            makeApiRequest(message.endpoint, message.method, message.body)
                .then(sendResponse)
                .catch((err) => sendResponse({ success: false, error: err.message }));
            return true;

        case 'MATCH_PRODUCT':
            matchProduct(message.url).then(sendResponse).catch((err) =>
                sendResponse({ success: false, error: err.message }),
            );
            return true;

        case 'GET_OVERLAY_KPI':
            getOverlayKPI(message.productId).then(sendResponse).catch((err) =>
                sendResponse({ success: false, error: err.message }),
            );
            return true;

        case 'GET_COMPETITOR_DNA':
            getCompetitorDna(message.competitorId).then(sendResponse).catch((err) =>
                sendResponse({ success: false, error: err.message }),
            );
            return true;

        case 'SIMULATE_PRICE':
            simulatePrice(message.productId, message.dropAmount).then(sendResponse).catch((err) =>
                sendResponse({ success: false, error: err.message }),
            );
            return true;

        case 'LOGOUT':
            chrome.storage.session.clear();
            sendResponse({ success: true });
            return false;
    }
});

async function handleLogin(payload: { email: string; password: string }) {
    const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error('Login failed');
    const data = await res.json();

    // Store token securely in session storage (cleared on browser close)
    await chrome.storage.session.set({
        token: data.accessToken,
        user: data.user,
    });

    return { success: true, user: data.user };
}

async function checkAuth(): Promise<{ success: boolean; user?: any }> {
    const result = await chrome.storage.session.get(['token', 'user']);
    if (result.token) {
        return { success: true, user: result.user };
    }
    return { success: false };
}

async function makeApiRequest(endpoint: string, method = 'GET', body?: any) {
    const { token } = await chrome.storage.session.get('token');
    if (!token) throw new Error('Not authenticated');

    const res = await fetch(`${API_BASE}${endpoint}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
}

async function matchProduct(url: string) {
    return makeApiRequest('/extension/match', 'POST', { url });
}

async function getOverlayKPI(productId: string) {
    return makeApiRequest(`/extension/overlay-kpi?productId=${productId}`);
}

async function getCompetitorDna(competitorId: string) {
    try {
        const data = await makeApiRequest(`/intelligence/competitor-dna/${competitorId}`);
        return { success: true, data };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

async function simulatePrice(productId: string, dropAmount: number) {
    try {
        // Fetch current price logic here is tricky, so we rely on the API. First let's get the product to know its current price, or assume the API handles it without knowing current price.
        // Actually, our API takes targetPrice. If the user clicks "10TL Kır", we need the target price. Let's fetch KPI first or let the backend do it.
        // For the sake of the demo, we assume the backend simulates a 10 TL drop if we just pass a targetPrice query. 
        // Wait, the API requires targetPrice. In a real scenario, the content script reads the current price from the DOM.
        // Let's assume the current price is 100 for fallback, but we should just pass a relative drop.
        // Since the backend needs an absolute target price, let's fetch product details to get current price, then subtract.
        const kpi = await getOverlayKPI(productId);
        const currentPrice = kpi?.priceExtremes?.current || kpi?.last30Days?.revenue?.value / Math.max(kpi?.last30Days?.units?.value, 1) || 100;
        const targetPrice = Math.max(1, currentPrice - dropAmount);

        const data = await makeApiRequest(`/intelligence/war-simulator/${productId}?targetPrice=${targetPrice}`);
        return { success: true, data };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

// --- Decentralized Crawler Node / Shadow Polling ---
let isPolling = false;

async function startJobPolling() {
    if (isPolling) return;
    isPolling = true;

    // Check every 30 seconds for a new scraping job from the API
    setInterval(async () => {
        try {
            const auth = await checkAuth();
            if (!auth.success) return;

            const res = await makeApiRequest('/extension/jobs/next');
            if (res?.success && res.job) {
                console.log('Received shadow task from Command Center:', res.job);
                await executeJob(res.job);
            }
        } catch (e) {
            // Silently ignore polling errors so we don't spam the console if offline
        }
    }, 30000);
}

// Initiate polling loop
startJobPolling();

async function executeJob(job: any) {
    if (job.type === 'STOCK_PROBE') {
        // Find an active Trendyol tab to act as our "Trojan Horse"
        chrome.tabs.query({ url: "*://*.trendyol.com/*" }, (tabs) => {
            if (tabs && tabs.length > 0) {
                // Pick the first active Trendyol tab
                const targetTab = tabs[0];
                chrome.tabs.sendMessage(
                    targetTab.id!,
                    { type: 'EXECUTE_JOB', job },
                    async (response) => {
                        // Submit result back to backend Command Center
                        await makeApiRequest(`/extension/jobs/${job.id}/result`, 'POST', response || { success: false, error: 'Tab failed to respond' });
                    }
                );
            } else {
                // No open trendyol tab right now. The job will remain in_progress and eventually retry if we implement a timeout on backend.
                makeApiRequest(`/extension/jobs/${job.id}/result`, 'POST', { success: false, error: 'No active Trendyol tab available to execute crawler.' }).catch(() => { });
            }
        });
    }
}
