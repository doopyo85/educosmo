/**
 * Pong2 API Client
 * Connects to app.codingnplay.co.kr/api/pong2
 */

class Pong2APIClient {
    constructor() {
        this.baseUrl = window.CONFIG.API.BASE_URL;
        this.endpoints = window.CONFIG.API.ENDPOINTS;
        this.tokenKey = 'pong2_auth_token';
        this.userKey = 'pong2_user_info';
    }

    /**
     * Get Auth Header
     */
    getAuthHeaders() {
        const token = localStorage.getItem(this.tokenKey);
        const headers = { 'Content-Type': 'application/json' };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
    }

    /**
     * Login (Native Pong2 User)
     */
    async login(email, password) {
        try {
            const response = await fetch(`${this.baseUrl}${this.endpoints.LOGIN}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Login failed');
            }

            if (result.success && result.token) {
                localStorage.setItem(this.tokenKey, result.token);
                localStorage.setItem(this.userKey, JSON.stringify(result.user));
                return result.user;
            }
            return null;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    }

    /**
     * Logout
     */
    logout() {
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.userKey);
        // Also redirect to app logout if needed, but for now just local clear
        window.location.reload();
    }

    /**
     * Get Current User (Local check)
     */
    getCurrentUser() {
        const userStr = localStorage.getItem(this.userKey);
        return userStr ? JSON.parse(userStr) : null;
    }

    /**
     * Fetch Boards
     * @param {string} type - 'community', 'portfolio', 'QnA'
     * @param {number} limit 
     */
    async getBoards(type = 'community', limit = 20) {
        try {
            const url = `${this.baseUrl}${this.endpoints.BOARDS}?type=${type}&limit=${limit}`;
            const response = await fetch(url, {
                headers: this.getAuthHeaders()
            });

            if (!response.ok) throw new Error('Failed to fetch boards');
            return await response.json();
        } catch (error) {
            console.error('Fetch boards error:', error);
            return []; // Return empty array on error to prevent UI crash
        }
    }

    /**
     * Get Single Post
     */
    async getPost(id) {
        try {
            const url = `${this.baseUrl}${this.endpoints.BOARDS}/${id}`;
            const response = await fetch(url, {
                headers: this.getAuthHeaders()
            });

            if (!response.ok) throw new Error('Failed to fetch post');
            return await response.json();
        } catch (error) {
            console.error('Fetch post error:', error);
            throw error;
        }
    }

    /**
     * Get Portfolio
     */
    async getPortfolio(studentId) {
        try {
            const url = `${this.baseUrl}${this.endpoints.PORTFOLIO}/${studentId}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to fetch portfolio');
            return await response.json();
        } catch (error) {
            console.error('Fetch portfolio error:', error);
            throw error;
        }
    }
}

// Global Instance
// Google Sheets Data Fetcher (Restored for Portal/YouTube)
// Sheet ID: 1yEb5m_fjw3msbBYLFtO55ukUI0C0XkJfLurWWyfALok
const SHEET_ID = '1yEb5m_fjw3msbBYLFtO55ukUI0C0XkJfLurWWyfALok';
const GIDS = {
    PORTAL: '569181415',
    YOUTUBE: '413887796'
};

window.googleSheetsAPI = {
    /**
     * Fetch formatted data from Google Sheets (CSV)
     * @param {string} type - 'PORTAL' or 'YOUTUBE'
     */
    getData: async (type = 'PORTAL') => {
        const gid = GIDS[type] || GIDS.PORTAL;
        const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;

        try {
            const response = await fetch(csvUrl);
            const text = await response.text();
            return parseCSV(text);
        } catch (error) {
            console.error('Sheet fetch error:', error);
            return [];
        }
    },

    // Legacy alias (defaults to Portal)
    getComputerData: async () => {
        return await window.googleSheetsAPI.getData('PORTAL');
    }
};

/**
 * Simple CSV Parser
 * Handles basics, assumes standard Google Sheet export format
 */
/**
 * Robust CSV Parser
 * Handles quotes, commas inside quotes, multi-line values
 */
function parseCSV(text) {
    const rows = [];
    let currentRow = [];
    let currentVal = '';
    let insideQuote = false;

    // Normalize newlines
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (char === '"') {
            if (insideQuote && nextChar === '"') {
                // Escaped quote ("")
                currentVal += '"';
                i++;
            } else {
                // Toggle quote state
                insideQuote = !insideQuote;
            }
        } else if (char === ',' && !insideQuote) {
            // New cell
            currentRow.push(currentVal.trim());
            currentVal = '';
        } else if (char === '\n' && !insideQuote) {
            // New row
            currentRow.push(currentVal.trim());
            if (currentRow.some(c => c)) rows.push(currentRow); // Skip empty rows
            currentRow = [];
            currentVal = '';
        } else {
            currentVal += char;
        }
    }
    // Push last val/row
    if (currentVal || currentRow.length) {
        currentRow.push(currentVal.trim());
        if (currentRow.some(c => c)) rows.push(currentRow);
    }

    // Remove header row if it exists (assuming it contains "카테고리" or "Category")
    // Note: User data row 1 might be header
    if (rows.length > 0 && (rows[0][0].includes('카테고리') || rows[0][0].includes('Category'))) {
        rows.shift();
    }

    return rows;
}
