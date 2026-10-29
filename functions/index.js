/**
 * NolyWhot Server-Side Real-Money Gaming, Automated Paystack Deposits & Payout Cloud Functions
 * Supports Server-to-Server Paystack Verification, Automatic Bank Withdrawals, HMAC SHA512 Webhooks,
 * Idempotency Protection, Atomic Wallet Balances, Escrow Locking, and Match Settlement.
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const crypto = require("crypto");
const https = require("https");

admin.initializeApp();
const db = admin.database();

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || "sk_test_nolywhot_secret_key";
const FLUTTERWAVE_SECRET_HASH = process.env.FLUTTERWAVE_SECRET_HASH || "nolywhot_flutterwave_hash";
const PLATFORM_FEE_PERCENT = 0.10; // 10% Platform fee

/**
 * Helper function: Perform HTTPS Request to Paystack REST API
 */
function makePaystackRequest(path, method, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.paystack.co",
      port: 443,
      path: path,
      method: method,
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json"
      }
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(body);
          resolve(parsed);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on("error", (err) => reject(err));
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

/**
 * Server-Side Verification Callable Function for Paystack Deposits
 * Client sends reference. Server queries Paystack API, verifies amount, currency, and status,
 * and atomically credits user's cash balance if valid.
 */
exports.verifyPaystackDeposit = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
  }

  const userId = context.auth.uid;
  const reference = data.reference;

  if (!reference) {
    throw new functions.https.HttpsError("invalid-argument", "Transaction reference is required.");
  }

  // 1. Idempotency Check
  const refCheck = await db.ref(`processedTransactions/${reference}`).once("value");
  if (refCheck.exists()) {
    const existing = refCheck.val();
    return {
      success: true,
      message: "Transaction already processed and credited.",
      amount: existing.amount
    };
  }

  // 2. Query Paystack Verification Endpoint (Server-to-Server)
  let paystackRes;
  try {
    paystackRes = await makePaystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`, "GET");
  } catch (err) {
    console.error("Paystack API Request Failed:", err);
    throw new functions.https.HttpsError("internal", "Could not verify payment with gateway.");
  }

  if (!paystackRes || !paystackRes.status || !paystackRes.data) {
    throw new functions.https.HttpsError("failed-precondition", "Payment verification failed or invalid reference.");
  }

  const txData = paystackRes.data;

  // 3. Verify Payment Criteria
  if (txData.status !== "success") {
    // Record failed attempt
    await db.ref(`users/${userId}/transactions/${reference}`).set({
      type: "DEPOSIT",
      amount: txData.amount ? txData.amount / 100 : 0,
      currency: txData.currency || "NGN",
      status: "FAILED",
      reference: reference,
      createdAt: admin.database.ServerValue.TIMESTAMP
    });
    throw new functions.https.HttpsError("failed-precondition", `Payment status is ${txData.status}. Deposit not credited.`);
  }

  if (txData.currency !== "NGN") {
    throw new functions.https.HttpsError("failed-precondition", "Invalid transaction currency.");
  }

  const creditedAmount = txData.amount / 100; // Convert kobo to Naira

  // 4. Atomic Balance Update in Realtime Database
  await db.ref(`users/${userId}/wallet/cashBalance`).transaction((current) => {
    return (current || 0) + creditedAmount;
  });

  // 5. Save Idempotency & Transaction Ledger Record
  await db.ref(`processedTransactions/${reference}`).set({
    userId: userId,
    amount: creditedAmount,
    gateway: "PAYSTACK",
    processedAt: admin.database.ServerValue.TIMESTAMP
  });

  await db.ref(`users/${userId}/transactions/${reference}`).set({
    type: "DEPOSIT",
    amount: creditedAmount,
    currency: "NGN",
    gateway: "PAYSTACK",
    status: "SUCCESS",
    reference: reference,
    createdAt: admin.database.ServerValue.TIMESTAMP
  });

  return {
    success: true,
    message: `Successfully verified deposit of ₦${creditedAmount.toLocaleString()}.`,
    amount: creditedAmount
  };
});

/**
 * Paystack Webhook Handler
 * Processes async charge and transfer notifications with HMAC SHA512 signature validation.
 */
exports.paystackWebhook = functions.https.onRequest(async (req, res) => {
  try {
    const signature = req.headers["x-paystack-signature"];
    if (!signature) {
      return res.status(401).send("Missing Paystack signature.");
    }

    const hash = crypto
      .createHmac("sha512", PAYSTACK_SECRET_KEY)
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (hash !== signature) {
      console.error("Invalid Paystack webhook signature.");
      return res.status(400).send("Invalid signature.");
    }

    const event = req.body;
    const eventType = event.event;
    const data = event.data;

    // A. DEPOSIT SUCCESS WEBHOOK
    if (eventType === "charge.success") {
      const reference = data.reference;
      const amount = data.amount / 100; // kobo to Naira
      const userEmail = data.customer ? data.customer.email : null;

      const refCheck = await db.ref(`processedTransactions/${reference}`).once("value");
      if (!refCheck.exists() && userEmail) {
        const usersSnap = await db.ref("users").orderByChild("email").equalTo(userEmail).once("value");
        if (usersSnap.exists()) {
          const userId = Object.keys(usersSnap.val())[0];

          await db.ref(`users/${userId}/wallet/cashBalance`).transaction((current) => {
            return (current || 0) + amount;
          });

          await db.ref(`processedTransactions/${reference}`).set({
            userId: userId,
            amount: amount,
            gateway: "PAYSTACK_WEBHOOK",
            processedAt: admin.database.ServerValue.TIMESTAMP
          });

          await db.ref(`users/${userId}/transactions/${reference}`).set({
            type: "DEPOSIT",
            amount: amount,
            currency: "NGN",
            gateway: "PAYSTACK_WEBHOOK",
            status: "SUCCESS",
            reference: reference,
            createdAt: admin.database.ServerValue.TIMESTAMP
          });
        }
      }
    }

    // B. TRANSFER / WITHDRAWAL SUCCESS WEBHOOK
    else if (eventType === "transfer.success") {
      const transferCode = data.transfer_code || data.reference;
      const txSnap = await db.ref(`pendingWithdrawals/${transferCode}`).once("value");
      if (txSnap.exists()) {
        const withdrawData = txSnap.val();
        await db.ref(`pendingWithdrawals/${transferCode}/status`).set("SUCCESS");
        await db.ref(`users/${withdrawData.userId}/transactions/${transferCode}/status`).set("SUCCESS");
      }
    }

    // C. TRANSFER / WITHDRAWAL FAILED OR REVERSED WEBHOOK (AUTOMATIC REFUND)
    else if (eventType === "transfer.failed" || eventType === "transfer.reversed") {
      const transferCode = data.transfer_code || data.reference;
      const txSnap = await db.ref(`pendingWithdrawals/${transferCode}`).once("value");
      if (txSnap.exists()) {
        const withdrawData = txSnap.val();
        if (withdrawData.status !== "REFUNDED") {
          // Refund reserved amount back to user's cash balance
          await db.ref(`users/${withdrawData.userId}/wallet/cashBalance`).transaction((current) => {
            return (current || 0) + withdrawData.amount;
          });

          await db.ref(`pendingWithdrawals/${transferCode}/status`).set("REFUNDED");
          await db.ref(`users/${withdrawData.userId}/transactions/${transferCode}/status`).set("FAILED_REFUNDED");
        }
      }
    }

    return res.status(200).send("Webhook handled successfully.");
  } catch (error) {
    console.error("Paystack Webhook Processing Error:", error);
    return res.status(500).send("Internal server error.");
  }
});

/**
 * Automated Bank Withdrawal Function
 * Deducts/reserves user balance atomically, creates Paystack Transfer Recipient,
 * initiates Paystack Automated Transfer, and handles success or automatic refund.
 */
exports.processAutomatedWithdrawal = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
  }

  const userId = context.auth.uid;
  const amount = Number(data.amount);
  const accountNumber = data.accountNumber ? String(data.accountNumber).trim() : "";
  const bankCode = data.bankCode ? String(data.bankCode).trim() : "";
  const accountName = data.accountName ? String(data.accountName).trim() : "NolyWhot Player";

  if (isNaN(amount) || amount < 500) {
    throw new functions.https.HttpsError("invalid-argument", "Minimum withdrawal amount is ₦500.");
  }

  if (accountNumber.length !== 10 || !/^\d+$/.test(accountNumber)) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid 10-digit NUBAN account number.");
  }

  if (!bankCode) {
    throw new functions.https.HttpsError("invalid-argument", "Bank code is required.");
  }

  // 1. Reserve / Deduct Balance Atomically to Prevent Double Spending
  const balanceRef = db.ref(`users/${userId}/wallet/cashBalance`);
  const result = await balanceRef.transaction((currentBalance) => {
    if ((currentBalance || 0) < amount) {
      return; // Abort if insufficient funds
    }
    return currentBalance - amount;
  });

  if (!result.committed) {
    throw new functions.https.HttpsError("failed-precondition", "Insufficient cash balance for this withdrawal.");
  }

  const txId = `WD_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

  // Log pending withdrawal
  await db.ref(`pendingWithdrawals/${txId}`).set({
    userId: userId,
    amount: amount,
    accountNumber: accountNumber,
    bankCode: bankCode,
    status: "PROCESSING",
    createdAt: admin.database.ServerValue.TIMESTAMP
  });

  await db.ref(`users/${userId}/transactions/${txId}`).set({
    type: "WITHDRAWAL",
    amount: amount,
    accountNumber: accountNumber,
    status: "PROCESSING",
    reference: txId,
    createdAt: admin.database.ServerValue.TIMESTAMP
  });

  // 2. Initiate Paystack Automated Payout
  try {
    // Step A: Create Transfer Recipient
    const recipientRes = await makePaystackRequest("/transferrecipient", "POST", {
      type: "nuban",
      name: accountName,
      account_number: accountNumber,
      bank_code: bankCode,
      currency: "NGN"
    });

    if (!recipientRes.status || !recipientRes.data || !recipientRes.data.recipient_code) {
      throw new Error(recipientRes.message || "Failed to create transfer recipient.");
    }

    const recipientCode = recipientRes.data.recipient_code;

    // Step B: Initiate Transfer
    const transferRes = await makePaystackRequest("/transfer", "POST", {
      source: "balance",
      amount: amount * 100, // Convert Naira to kobo
      recipient: recipientCode,
      reason: "NolyWhot Wallet Withdrawal",
      reference: txId
    });

    if (!transferRes.status || !transferRes.data) {
      throw new Error(transferRes.message || "Payout initiation failed.");
    }

    const transferStatus = transferRes.data.status;

    if (transferStatus === "success" || transferStatus === "pending" || transferStatus === "processing") {
      await db.ref(`pendingWithdrawals/${txId}/status`).set(transferStatus === "success" ? "SUCCESS" : "PROCESSING");
      await db.ref(`users/${userId}/transactions/${txId}/status`).set(transferStatus === "success" ? "SUCCESS" : "PROCESSING");

      return {
        success: true,
        message: `Automated withdrawal of ₦${amount.toLocaleString()} initiated successfully.`,
        reference: txId,
        status: transferStatus
      };
    } else {
      throw new Error(`Transfer status: ${transferStatus}`);
    }

  } catch (error) {
    console.error("Automated Withdrawal Error:", error);

    // RESTORE RESERVED BALANCE AUTOMATICALLY ON FAILURE
    await balanceRef.transaction((current) => {
      return (current || 0) + amount;
    });

    await db.ref(`pendingWithdrawals/${txId}/status`).set("FAILED_REFUNDED");
    await db.ref(`users/${userId}/transactions/${txId}/status`).set("FAILED_REFUNDED");

    throw new functions.https.HttpsError("internal", `Withdrawal failed: ${error.message || "Could not process transfer"}. Funds have been restored to your wallet.`);
  }
});

/**
 * Lock Match Stake Escrow
 */
exports.lockMatchStake = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
  }

  const userId = context.auth.uid;
  const stakeAmount = Number(data.stakeAmount);
  const roomId = data.roomId;

  if (isNaN(stakeAmount) || stakeAmount <= 0) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid stake amount.");
  }

  const userRef = db.ref(`users/${userId}/wallet/cashBalance`);
  const result = await userRef.transaction((currentBalance) => {
    if ((currentBalance || 0) < stakeAmount) {
      return;
    }
    return currentBalance - stakeAmount;
  });

  if (!result.committed) {
    throw new functions.https.HttpsError("failed-precondition", "Insufficient cash balance to enter match.");
  }

  await db.ref(`matchEscrow/${roomId}/${userId}`).set({
    amount: stakeAmount,
    status: "LOCKED",
    timestamp: admin.database.ServerValue.TIMESTAMP
  });

  return { success: true, message: `₦${stakeAmount} locked in escrow for match.` };
});

/**
 * Settle Real-Money Match
 */
exports.settleMatch = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
  }

  const roomId = data.roomId;
  const winnerId = data.winnerId;

  const roomSnap = await db.ref(`onlineGames/${roomId}`).once("value");
  if (!roomSnap.exists()) {
    throw new functions.https.HttpsError("not-found", "Match room not found.");
  }

  const room = roomSnap.val();
  if (room.settled) {
    throw new functions.https.HttpsError("already-exists", "Match already settled.");
  }

  const stakeAmount = room.stakeAmount || 0;
  if (stakeAmount <= 0) {
    return { success: true, message: "Practice match - no monetary payout required." };
  }

  const totalPool = stakeAmount * 2;
  const platformFee = totalPool * PLATFORM_FEE_PERCENT;
  const winnerPrize = totalPool - platformFee;

  await db.ref(`users/${winnerId}/wallet/cashBalance`).transaction((current) => {
    return (current || 0) + winnerPrize;
  });

  await db.ref("financialMetrics/platformFees").transaction((current) => {
    return (current || 0) + platformFee;
  });

  await db.ref(`onlineGames/${roomId}/settled`).set(true);

  await db.ref(`users/${winnerId}/transactions/WIN_${roomId}`).set({
    type: "MATCH_WINNINGS",
    roomId: roomId,
    amount: winnerPrize,
    platformFee: platformFee,
    status: "SUCCESS",
    createdAt: admin.database.ServerValue.TIMESTAMP
  });

  return {
    success: true,
    totalPool: totalPool,
    platformFee: platformFee,
    winnerPrize: winnerPrize
  };
});
