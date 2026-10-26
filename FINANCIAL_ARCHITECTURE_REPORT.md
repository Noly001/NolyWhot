# NolyWhot Financial Features & Real-Money Gaming Architecture Assessment Report

## Executive Summary
This report presents the architectural, security, legal, and backend requirements for introducing a **User Wallet, Real-Money Wagering, and Owner Earnings Dashboard** into the **NolyWhot** game application.

Currently, NolyWhot relies purely on client-side state synchronized through Firebase Realtime Database and anonymous/client-side Firebase Authentication. **Real-money gaming must NEVER rely solely on Firebase Realtime Database directly modified from the client.** All financial balances, deposits, match escrow, and payouts must be processed by an isolated, secure server-side backend service.

---

## 1. Backend Architecture & Security Requirements

### Current Backend Inspection
- **Firebase Realtime Database:** Accessible via client Web SDK. Client code directly reads/writes match state and game properties.
- **Security Deficit for Financials:** If wallet balances or match stakes are stored in Firebase RTDB without server-side validation or custom Firebase Security Rules/Cloud Functions, malicious users could alter balance fields using browser dev tools or custom API requests.
- **Verdict:** The current frontend cannot support secure financial accounting without dedicated server infrastructure or Cloud Functions with double-entry ledger database controls.

### Proposed Architecture for Secure Wallet Accounting
1. **Isolated Server / Serverless Backend (Node.js/Express or Firebase Cloud Functions):**
   - Handles all deposit initializations, payment webhooks, withdrawal requests, and match stake escrow.
2. **Double-Entry Transaction Ledger DB (PostgreSQL / Firebase Firestore with ACD transactions):**
   - **Ledger Entries Table:** Records `user_id`, `amount`, `type` (`DEPOSIT`, `WITHDRAWAL`, `MATCH_STAKE_ESCROW`, `MATCH_WINNING_PAYOUT`, `PLATFORM_FEE`), `status` (`PENDING`, `COMPLETED`, `FAILED`), and `timestamp`.
   - **User Balance:** Calculated as `SUM(credits) - SUM(debits)` or managed via ACID transactions with row-level locks to prevent double-spending or negative balances.
3. **Demo vs. Real Balance Isolation:**
   - Real Cash Balance (`real_balance`) and Practice Coin Balance (`demo_balance`) must be strictly segregated in database schemas and UI displays. Demo coins can never be converted or withdrawn as real cash.

---

## 2. User Wallet & Betting Flow

### User Wallet Interface & Controls
- **Display:** Separate panels displaying `Available Cash Balance` (in NGN - ₦) and `Demo Coins`.
- **Deposit Flow:**
  - User selects deposit amount (e.g., ₦1,000).
  - Backend creates a transaction reference and calls Paystack/Flutterwave API to generate a secure checkout link or mobile checkout modal.
  - Upon user authorization, payment provider sends a signed webhook (`x-paystack-signature` or `verif-hash`).
  - Backend verifies signature via HMAC SHA512 using the webhook secret, verifies the transaction status directly with Paystack/Flutterwave REST API, and atomically credits the user's wallet ledger.
- **Withdrawal Flow:**
  - User requests withdrawal to a verified Nigerian Bank Account (NIN/BVN verified).
  - System checks available unencumbered balance (`available_balance = total_balance - active_match_escrow`).
  - Account undergoes automated fraud/velocity check (e.g. daily withdrawal limits, suspicious win patterns).
  - Approved withdrawals are disbursed via Paystack Transfers API or Flutterwave Transfers API, and marked `COMPLETED` upon webhook confirmation.

### Real-Money Betting & Match Escrow
- **Pre-Match Disclosure:**
  - Before entering a paid match (e.g. ₦1,000 Entry Fee), the UI clearly displays:
    - **Entry Fee:** ₦1,000 per player
    - **Total Pot:** ₦2,000
    - **Platform Fee (House Commission - e.g. 10%):** ₦200
    - **Winner Net Prize:** ₦1,800
- **Match Security & Anti-Cheating:**
  - Both players' funds are locked in `MATCH_STAKE_ESCROW` by the backend before the match begins.
  - Server validates card moves or match outcomes (server-authoritative game engine) to prevent match manipulation or malicious disconnects.
  - If a player abandons or loses connection beyond the timeout threshold, the server awards the match to the active player.

---

## 3. Owner Earnings Dashboard & Financial Separation

### Platform Revenue vs. Customer Funds
- **Separation of Funds:** Customer wallet deposits must be stored in a dedicated, segregated merchant account. Deposits are **custodial liabilities** and must **NEVER** be categorized as company earnings or profit.
- **Platform Earnings Calculation:**
  - **Company Revenue:** Earned strictly when a real-money match finishes and the platform fee (e.g. 10%) is collected from the match pot.
  - **Dashboard Metrics:**
    - `Total Platform Fees Collected` (Net Gross Revenue)
    - `Total Custodial Customer Wallet Balances` (Liabilities)
    - `Pending Withdrawals`
    - `Total Deposits Processed`
    - `Operating Expenses` (Payment Gateway processing fees: ~1.5% capped at ₦2,000 per deposit)

---

## 4. Payment Security & Fraud Prevention

1. **Client Trust Zero:**
   - No payment details or card numbers are stored or processed on NolyWhot servers.
   - Balance amounts sent from client requests are ignored. Balance calculations are performed strictly on the server.
2. **Duplicate & Replay Attack Safeguards:**
   - Webhook idempotency key checks using payment reference ID (`reference`). Duplicate webhook calls will be discarded without double-crediting balances.
3. **Negative Balance Safeguards:**
   - All debit operations execute within database isolation locks (`SELECT ... FOR UPDATE` or database transactions).

---

## 5. Nigerian Legal, Regulatory, & Compliance Requirements

Before enabling real-money gaming in Nigeria, the following unresolved requirements must be fulfilled:

1. **National Lottery Regulatory Commission (NLRC) License:**
   - Real-money skill gaming / wagering requires approval or a permit from NLRC or relevant state lotteries boards (e.g., Lagos State Lotteries and Gaming Authority - LSLGA).
2. **Payment Provider Approval:**
   - Paystack and Flutterwave strictly prohibit real-money gaming/gambling transactions without proof of an explicit Gaming/Lottery License from the appropriate Nigerian regulatory authority.
3. **KYC / AML (Know Your Customer & Anti-Money Laundering):**
   - Mandatory verification of BVN (Bank Verification Number) / NIN (National Identification Number) and phone number prior to real-money deposits or withdrawals (CBN regulatory requirement).
4. **Age Restrictions & Anti-Gambling Safeguards:**
   - Age verification ensuring all cash players are 18+ years old.

---

## 6. Implementation Safety Status

- **Real-money betting remains DISABLED in the client application until legal licensing, payment gateway approvals, and server-side infrastructure are fully provisioned.**
- All current gameplay uses free-to-play mode / demo balances.
