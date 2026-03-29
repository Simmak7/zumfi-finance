import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
    baseURL: API_BASE,
});

// Token refresh interceptor — set up by AuthContext
let refreshInterceptorAttached = false;
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach(({ resolve, reject }) => {
        if (error) reject(error);
        else resolve(token);
    });
    failedQueue = [];
};

export function setupAuthInterceptor(getRefreshToken, onRefreshed, onLogout) {
    if (refreshInterceptorAttached) return;
    refreshInterceptorAttached = true;

    api.interceptors.response.use(
        (response) => response,
        async (error) => {
            const originalRequest = error.config;

            // Only intercept 401s, not for refresh/login/register endpoints
            if (
                error.response?.status !== 401 ||
                originalRequest._retry ||
                originalRequest.url?.includes('/auth/refresh') ||
                originalRequest.url?.includes('/auth/login') ||
                originalRequest.url?.includes('/auth/register')
            ) {
                return Promise.reject(error);
            }

            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then((token) => {
                    originalRequest.headers['Authorization'] = `Bearer ${token}`;
                    return api(originalRequest);
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            const refreshToken = getRefreshToken();
            if (!refreshToken) {
                isRefreshing = false;
                onLogout();
                return Promise.reject(error);
            }

            try {
                const { data } = await api.post('/auth/refresh', { refresh_token: refreshToken });
                const newAccessToken = data.access_token;
                onRefreshed(data.access_token, data.refresh_token);
                api.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
                processQueue(null, newAccessToken);
                originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
                return api(originalRequest);
            } catch (refreshError) {
                processQueue(refreshError, null);
                onLogout();
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }
    );
}

// --- Auth ---
export const authLogin = (email, password) =>
    api.post('/auth/login', { email, password });

export const authRegister = (email, password, display_name) =>
    api.post('/auth/register', { email, password, display_name });

export const authRefresh = (refresh_token) =>
    api.post('/auth/refresh', { refresh_token });

export const authLogout = (refresh_token) =>
    api.post('/auth/logout', { refresh_token });

export const authChangePassword = (current_password, new_password) =>
    api.post('/auth/change-password', { current_password, new_password });

export const authGetMe = () => api.get('/auth/me');

// --- Google OAuth ---
export const getGoogleLoginUrl = () => api.get('/auth/google/login');
export const exchangeGoogleCode = (code) => api.post('/auth/google/callback', { code });
export const linkGoogleAccount = (code) => api.post('/auth/google/link', { code });

// --- 2FA ---
export const setup2FA = () => api.post('/auth/2fa/setup');
export const confirm2FA = (code) => api.post('/auth/2fa/confirm', { code });
export const disable2FA = (code) => api.post('/auth/2fa/disable', { code });
export const verify2FA = (two_factor_token, totp_code) =>
    api.post('/auth/verify-2fa', { two_factor_token, totp_code });

// --- Forgot Password ---
export const forgotPassword = (email) => api.post('/auth/forgot-password', { email });
export const resetPasswordVerify = (reset_token, totp_code) =>
    api.post('/auth/reset-password-verify', { reset_token, totp_code });
export const resetPassword = (password_reset_token, new_password) =>
    api.post('/auth/reset-password', { password_reset_token, new_password });

// --- Dashboard ---
export const getLastDataMonth = async () => {
    const response = await api.get('/dashboard/last-data-month');
    return response.data;
};

export const getDashboardSummary = async (month) => {
    const params = month ? { month } : {};
    const response = await api.get('/dashboard/summary', { params });
    return response.data;
};

export const getMonthlyHistory = async (months = 6) => {
    const response = await api.get('/dashboard/monthly-history', { params: { months } });
    return response.data;
};

export const getCategoryTrends = async (month, months = 12) => {
    const params = {};
    if (month) params.month = month;
    if (months) params.months = months;
    const response = await api.get('/dashboard/category-trends', { params });
    return response.data;
};

export const getMonthCloseData = async (month) => {
    const response = await api.get('/dashboard/month-close', { params: { month } });
    return response.data;
};

// --- Transactions ---
export const getTransactions = async (status) => {
    const params = status ? { status } : {};
    const response = await api.get('/transactions', { params });
    return response.data;
};

export const updateTransaction = async (id, data) => {
    const response = await api.put(`/transactions/${id}`, data);
    return response.data;
};

export const searchTransactions = async (params) => {
    const response = await api.get('/transactions/search', { params });
    return response.data;
};

export const bulkUpdateTransactions = async (data) => {
    const response = await api.post('/transactions/bulk-update', data);
    return response.data;
};

export const categorizeSimilar = async (data) => {
    const response = await api.post('/transactions/categorize-similar', data);
    return response.data;
};

// --- Goals ---
export const getGoals = async () => {
    const response = await api.get('/goals/');
    return response.data;
};

export const addGoal = async (goal) => {
    const response = await api.post('/goals/', goal);
    return response.data;
};

export const updateGoal = async (id, goal) => {
    const response = await api.put(`/goals/${id}`, goal);
    return response.data;
};

export const deleteGoal = async (id) => {
    const response = await api.delete(`/goals/${id}`);
    return response.data;
};

export const getSurplus = async (month) => {
    const response = await api.get('/goals/surplus', { params: { month } });
    return response.data;
};

export const getAllocationSuggestions = async (month) => {
    const response = await api.get('/goals/allocation-suggestions', { params: { month } });
    return response.data;
};

export const allocateToGoals = async (data) => {
    const response = await api.post('/goals/allocate', data);
    return response.data;
};

export const getAllocationDetails = async (month) => {
    const response = await api.get('/goals/allocation-details', { params: { month } });
    return response.data;
};

export const getGoalsWithDeltas = async () => {
    const response = await api.get('/goals/with-deltas');
    return response.data;
};

export const getGoalHistory = async (goalId, months = 12) => {
    const response = await api.get(`/goals/${goalId}/history`, { params: { months } });
    return response.data;
};

// --- Categories ---
export const getCategories = async () => {
    const response = await api.get('/categories/');
    return response.data;
};

export const seedCategories = async () => {
    const response = await api.post('/categories/seed-defaults');
    return response.data;
};

export const createCategory = async (data) => {
    const response = await api.post('/categories/', data);
    return response.data;
};

export const updateCategory = async (categoryId, data) => {
    const response = await api.put(`/categories/${categoryId}`, data);
    return response.data;
};

export const deleteCategory = async (categoryId) => {
    const response = await api.delete(`/categories/${categoryId}`);
    return response.data;
};

export const reorderCategories = async (categoryIds) => {
    const response = await api.put('/categories/reorder', { category_ids: categoryIds });
    return response.data;
};

export const getCategoryMappings = async (categoryId) => {
    const response = await api.get(`/categories/${categoryId}/mappings`);
    return response.data;
};

export const addCategoryMapping = async (data) => {
    const response = await api.post('/categories/mappings', data);
    return response.data;
};

export const updateCategoryMapping = async (mappingId, data) => {
    const response = await api.put(`/categories/mappings/${mappingId}`, data);
    return response.data;
};

export const deleteCategoryMapping = async (mappingId) => {
    const response = await api.delete(`/categories/mappings/${mappingId}`);
    return response.data;
};

// --- Analysis (Smart Features) ---
export const getTrends = async () => {
    const response = await api.get('/analysis/trends');
    return response.data;
};

export const getAnomalies = async (month) => {
    const params = month ? { month } : {};
    const response = await api.get('/analysis/anomalies', { params });
    return response.data;
};

export const getRecurring = async () => {
    const response = await api.get('/analysis/recurring');
    return response.data;
};

export const getTopCategories = async (month) => {
    const params = month ? { month } : {};
    const response = await api.get('/analysis/top-categories', { params });
    return response.data;
};

export const getForecast = async () => {
    const response = await api.get('/analysis/forecast');
    return response.data;
};

export const getAiSummary = async () => {
    const response = await api.get('/analysis/summary');
    return response.data;
};

export const getZumiInsight = async (data) => {
    const response = await api.post('/analysis/zumi-insight', data);
    return response.data;
};

// Backwards-compatible alias
export const getZumfiInsight = getZumiInsight;

// --- Bills ---
export const getBills = async () => {
    const response = await api.get('/bills/');
    return response.data;
};

export const getBillStatus = async (month) => {
    const response = await api.get('/bills/status', { params: { month } });
    return response.data;
};

export const addBill = async (bill) => {
    const response = await api.post('/bills/', bill);
    return response.data;
};

export const updateBill = async (id, bill) => {
    const response = await api.put(`/bills/${id}`, bill);
    return response.data;
};

export const deleteBill = async (id) => {
    const response = await api.delete(`/bills/${id}`);
    return response.data;
};

export const autoDetectBills = async () => {
    const response = await api.get('/bills/auto-detect');
    return response.data;
};

export const autofillBills = async (month) => {
    const params = month ? { month } : {};
    const response = await api.post('/bills/autofill', null, { params });
    return response.data;
};

export const getMissingBills = async (month) => {
    const response = await api.get('/bills/missing', { params: { month } });
    return response.data;
};

// --- Mortgages ---
export const getMortgages = async () => {
    const response = await api.get('/bills/mortgages');
    return response.data;
};

export const getMortgageStatus = async (month) => {
    const response = await api.get('/bills/mortgages/status', { params: { month } });
    return response.data;
};

export const createMortgage = async (data) => {
    const response = await api.post('/bills/mortgages', data);
    return response.data;
};

export const updateMortgage = async (id, data) => {
    const response = await api.put(`/bills/mortgages/${id}`, data);
    return response.data;
};

export const deleteMortgage = async (id) => {
    const response = await api.delete(`/bills/mortgages/${id}`);
    return response.data;
};

export const getMortgageSchedule = async (id) => {
    const response = await api.get(`/bills/mortgages/${id}/schedule`);
    return response.data;
};

export const getMortgage = async (id) => {
    const response = await api.get(`/bills/mortgages/${id}`);
    return response.data;
};

// --- Mortgage Events ---
export const getMortgageEvents = async (mortgageId) => {
    const response = await api.get(`/bills/mortgages/${mortgageId}/events`);
    return response.data;
};

export const createMortgageEvent = async (mortgageId, data) => {
    const response = await api.post(`/bills/mortgages/${mortgageId}/events`, data);
    return response.data;
};

export const updateMortgageEvent = async (eventId, data) => {
    const response = await api.put(`/bills/mortgages/events/${eventId}`, data);
    return response.data;
};

export const deleteMortgageEvent = async (eventId) => {
    const response = await api.delete(`/bills/mortgages/events/${eventId}`);
    return response.data;
};

// --- Mortgage Payments ---
export const getMortgagePayments = async (mortgageId) => {
    const response = await api.get(`/bills/mortgages/${mortgageId}/payments`);
    return response.data;
};

export const confirmMortgagePayment = async (mortgageId, data) => {
    const response = await api.post(`/bills/mortgages/${mortgageId}/payments`, data);
    return response.data;
};

export const deleteMortgagePayment = async (mortgageId, paymentId) => {
    const response = await api.delete(`/bills/mortgages/${mortgageId}/payments/${paymentId}`);
    return response.data;
};

// --- Budgets ---
export const getBudgets = async (month) => {
    const response = await api.get('/budgets/', { params: { month } });
    return response.data;
};

export const createOrUpdateBudget = async (budget) => {
    const response = await api.post('/budgets/', budget);
    return response.data;
};

export const deleteBudget = async (id) => {
    const response = await api.delete(`/budgets/${id}`);
    return response.data;
};

export const deleteBudgetByCategory = async (categoryId, month) => {
    const response = await api.delete(`/budgets/category/${categoryId}`, { params: { month } });
    return response.data;
};

export const getBudgetSummary = async (month) => {
    const response = await api.get('/budgets/summary', { params: { month } });
    return response.data;
};

export const copyPreviousBudget = async (month) => {
    const response = await api.post(`/budgets/copy-previous?month=${month}`);
    return response.data;
};

export const getBudgetSuggestions = async (months = 3) => {
    const response = await api.get('/budgets/suggestions', { params: { months } });
    return response.data;
};

export const getSmartBudgetSuggestions = async (months = 6) => {
    const response = await api.get('/budgets/smart-suggestions', { params: { months } });
    return response.data;
};

// --- Imports ---
export const uploadImportFile = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/imports/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
};

export const previewImport = async (data) => {
    const response = await api.post('/imports/preview', data);
    return response.data;
};

export const executeImport = async (data) => {
    const response = await api.post('/imports/execute', data);
    return response.data;
};

export const cleanupImportFile = async (filename) => {
    const response = await api.delete(`/imports/temp/${filename}`);
    return response.data;
};

export const importExcelHistory = async (file, year) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(`/imports/excel-history?year=${year}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
};

// --- Upload ---
export const uploadStatement = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
};

// --- Statements Management ---
export const getStatements = async () => {
    const response = await api.get('/statements');
    return response.data;
};

export const deleteStatement = async (statementId) => {
    const response = await api.delete(`/statements/${statementId}`);
    return response.data;
};

export const updateStatement = async (statementId, periodStart, periodEnd) => {
    const response = await api.put(`/statements/${statementId}`, null, {
        params: { period_start: periodStart, period_end: periodEnd }
    });
    return response.data;
};

export const updateStatementType = async (statementId, statementType) => {
    const response = await api.put(`/statements/${statementId}/type`, {
        statement_type: statementType,
    });
    return response.data;
};

export const openStatementFile = async (statementId) => {
    const response = await api.get(`/statements/${statementId}/file`, {
        responseType: 'blob',
    });
    const blob = new Blob([response.data], { type: response.headers['content-type'] });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
};

// --- Settings ---
export const getSettings = async () => {
    const response = await api.get('/settings');
    return response.data;
};

export const updateSettings = async (data) => {
    const response = await api.put('/settings', data);
    return response.data;
};

// --- Portfolio ---
export const getPortfolioSummary = async (month) => {
    const params = month ? { month } : {};
    const response = await api.get('/portfolio/summary', { params });
    return response.data;
};

export const getSavingsHistory = async (months = 12, endMonth = null) => {
    const params = { months };
    if (endMonth) params.end_month = endMonth;
    const response = await api.get('/portfolio/savings-history', { params });
    return response.data;
};

export const getPortfolioHistory = async (months = 12, endMonth = null) => {
    const params = { months };
    if (endMonth) params.end_month = endMonth;
    const response = await api.get('/portfolio/portfolio-history', { params });
    return response.data;
};

export const getStockHoldingsHistory = async (months = 12, endMonth = null) => {
    const params = { months };
    if (endMonth) params.end_month = endMonth;
    const response = await api.get('/portfolio/stock-history', { params });
    return response.data;
};

export const getStockDetailHistory = async (ticker, currency, months = 60) => {
    const response = await api.get(`/portfolio/stocks/${encodeURIComponent(ticker)}/history`, {
        params: { currency, months },
    });
    return response.data;
};

export const getStockBreakdown = async (months = 12, month = null) => {
    const params = { months };
    if (month) params.month = month;
    const response = await api.get('/portfolio/stock-breakdown', { params });
    return response.data;
};

export const getStockPnl = async (month) => {
    const params = month ? { month } : {};
    const response = await api.get('/portfolio/stock-pnl', { params });
    return response.data;
};

export const getSavingsAccounts = async () => {
    const response = await api.get('/portfolio/savings');
    return response.data;
};

export const createSavingsAccount = async (data) => {
    const response = await api.post('/portfolio/savings', data);
    return response.data;
};

export const updateSavingsAccount = async (id, data, month) => {
    const response = await api.put(`/portfolio/savings/${id}`, data, {
        params: month ? { month } : undefined,
    });
    return response.data;
};

export const deleteSavingsAccount = async (id) => {
    const response = await api.delete(`/portfolio/savings/${id}`);
    return response.data;
};

export const getInvestments = async () => {
    const response = await api.get('/portfolio/investments');
    return response.data;
};

export const createInvestment = async (data) => {
    const response = await api.post('/portfolio/investments', data);
    return response.data;
};

export const updateInvestment = async (id, data) => {
    const response = await api.put(`/portfolio/investments/${id}`, data);
    return response.data;
};

export const deleteInvestment = async (id) => {
    const response = await api.delete(`/portfolio/investments/${id}`);
    return response.data;
};

// --- Property Investments ---
export const getPropertyInvestments = async () => {
    const response = await api.get('/portfolio/properties');
    return response.data;
};

export const createPropertyInvestment = async (data) => {
    const response = await api.post('/portfolio/properties', data);
    return response.data;
};

export const updatePropertyInvestment = async (id, data) => {
    const response = await api.put(`/portfolio/properties/${id}`, data);
    return response.data;
};

export const deletePropertyInvestment = async (id) => {
    const response = await api.delete(`/portfolio/properties/${id}`);
    return response.data;
};

export const getPropertyHistory = async (propertyId, months = 24) => {
    const response = await api.get(`/portfolio/properties/${propertyId}/history`, {
        params: { months },
    });
    return response.data;
};

export const getPropertiesHistory = async (months = 24) => {
    const response = await api.get('/portfolio/properties-history', {
        params: { months },
    });
    return response.data;
};

export const getPropertyBasePrices = async () => {
    const response = await api.get('/portfolio/properties/base-prices');
    return response.data;
};

// --- Stock Holdings ---
export const getStockHoldings = async () => {
    const response = await api.get('/portfolio/stocks');
    return response.data;
};

export const createStockHolding = async (data) => {
    const response = await api.post('/portfolio/stocks', data);
    return response.data;
};

export const updateStockHolding = async (id, data) => {
    const response = await api.put(`/portfolio/stocks/${id}`, data);
    return response.data;
};

export const deleteStockHolding = async (id) => {
    const response = await api.delete(`/portfolio/stocks/${id}`);
    return response.data;
};

// --- Donate ---
export const getDonateConfig = async () => {
    const response = await api.get('/donate/config');
    return response.data;
};

export const createDonateCheckout = async (tier, successUrl, cancelUrl) => {
    const response = await api.post('/donate/create-checkout-session', {
        tier,
        success_url: successUrl,
        cancel_url: cancelUrl,
    });
    return response.data;
};

export default api;
