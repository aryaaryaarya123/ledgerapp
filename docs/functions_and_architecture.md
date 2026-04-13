# Ledger App Deep Analysis & Refactoring Plan

## Background & Motivation
The application is a full-stack expense ledger with a monolithic `server.js` and a single `index.html` file. This restructuring makes the codebase maintainable, debuggable, and scalable. The database connection logic has also been isolated for robustness.

## Architecture

**Backend Structure:**
*   `server.js`: Application entry point and middleware configuration.
*   `config/db.js`: PostgreSQL connection pooling and initialization logic.
*   `routes/transactionRoutes.js`: Express router for `/api/transactions` and `/api/approve`.
*   `controllers/transactionController.js`: Business logic for handling requests.

**Frontend Structure:**
*   `public/index.html`: Skeleton HTML and layout.
*   `public/css/style.css`: Extracted CSS styles.
*   `public/js/app.js`: Extracted JavaScript logic.

## Function Documentation

### Backend Functions (`controllers/transactionController.js` & `config/db.js`)

*   **`getPoolConfig(connectionString)`**: Returns the required configuration object for the `pg` Pool based on whether the string belongs to an internal or external Render database.
*   **`connect()` / `db.js` Initialization**: Initializes the PostgreSQL connection pool using environment variables or hardcoded fallbacks.
*   **`initDB()`**: Asynchronously verifies the database connection and creates the `transactions` and `approvals` tables if they do not exist. Seeds initial data if the tables are empty. Includes a fallback mechanism to switch to an external URL if the internal one fails.
*   **`getTransactions(req, res)`**: Fetches all transactions from the database, performing a `LEFT JOIN` with the `approvals` table to aggregate the list of users who have approved each transaction.
*   **`createTransaction(req, res)`**: Creates a new transaction. Contains logic to set the status to `PENDING_APPROVAL` if it's an 'expense' and involves 'Gaurav Laudari'; otherwise, it defaults to `APPROVED`.
*   **`approveTransaction(req, res)`**: Records a user's approval. If both 'Umanga Regmi' and 'Gaurav Laudari' approve, the transaction status updates to `APPROVED`.
*   **`deleteTransaction(req, res)`**: Deletes a transaction from the database by its ID.

### Frontend Functions (`public/js/app.js`)

*   **`adToBS(ad)`**: Converts a Gregorian (AD) Date object into a Nepali (BS) date object `{y, m, d}`.
*   **`syncData()`**: Asynchronously fetches all transactions from the backend `/api/transactions` endpoint, updates the global `state`, and triggers a full UI re-render.
*   **`renderAll()`**: Orchestrator function that calls all rendering functions (`renderProfiles`, `renderStats`, `renderFeed`, `renderNetPositions`, `renderSettlements`) and initializes Lucide icons.
*   **`renderProfiles()`**: Calculates net balances and generates the HTML for the user profile cards at the top of the screen.
*   **`switchUser(name)`**: Updates the currently active user in the global state and triggers a re-render.
*   **`renderStats()`**: Calculates and updates summary statistics (Pool Balance, Monthly Spend, Pending Approvals) based on the current user and transaction state.
*   **`renderFeed()`**: Filters the transactions based on the active tab (all, pending, expenses, income) and search query, then generates the HTML for the transaction list.
*   **`computeNetBalances()`**: Core logic function. Iterates through all *approved* transactions to calculate how much each member owes or is owed. Handles complex split logic (shares) and direct debts.
*   **`renderNetPositions()`**: Uses `computeNetBalances()` to display a summarized view of each member's overall financial standing.
*   **`renderSettlements()`**: Uses `computeNetBalances()` to calculate the most efficient path to settle all debts (who should pay whom and how much) and renders this as "Smart Settlements".
*   **`window.approveTx(id)`**: Sends a PUT request to the backend to approve a transaction for the currently active user, then resyncs data.
*   **`window.deleteTx(id)`**: Prompts for confirmation and sends a DELETE request to the backend, then resyncs data.
*   **`window.handleSubmit()`**: Gathers form data based on the selected transaction type (expense, income, debt), structures the JSON payload, and sends a POST request to the backend to create a new record.
*   **`window.toggleFormFields()`**: Dynamically updates the HTML of the input form based on whether 'Expense', 'Income', or 'Manual Debt' is selected.
*   **`window.toggleSplit()`**: Dynamically shows or hides the "With Who?" dropdown when a 2-way equal split is selected for an expense.
*   **`window.setTab(tab)`**: Updates the active tab state and filters the transaction feed accordingly.
*   **`window.toggleTheme()`**: Switches the application between dark and light modes by updating a data attribute on the HTML root and saving the preference to `localStorage`.
*   **`window.exportData()`**: Serializes the current transaction state to a JSON file and triggers a browser download.
*   **`fmt(n)`**: Utility function to format raw numbers into localized currency strings.
*   **`esc(s)`**: Utility function to escape HTML characters in strings to prevent XSS.
*   **`toast(msg, type)`**: Displays a temporary notification message on the screen.
