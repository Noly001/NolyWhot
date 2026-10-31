/**
 * NolyWhot Server-Side Real-Money Gaming, Automated Paystack Deposits & Payout Cloud Functions
 * Supports Server-to-Server Paystack Transaction Initialization, Server Verification,
 * Mandatory Bank Account Resolution, Automated Payouts, HMAC SHA512 Webhooks,
 * Idempotency Protection, Atomic Wallet Balances, Escrow Locking, and Match Settlement.
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const crypto = require("crypto");
const https = require("https");

admin.initializeApp();
const db = admin.database();

// Retrieve secrets securely from environment or functions.config()
const PAYSTACK_SECRET_KEY =
  process.env.PAYSTACK_SECRET_KEY ||
  (functions.config && functions.config().paystack ? functions.config().paystack.secret_key : null) ||
  "";

const PAYSTACK_PUBLIC_KEY =
  process.env.PAYSTACK_PUBLIC_KEY ||
  (functions.config && functions.config().paystack ? functions.config().paystack.public_key : null) ||
  "";

const FLUTTERWAVE_SECRET_HASH =
  process.env.FLUTTERWAVE_SECRET_HASH ||
  (functions.config && functions.config().flutterwave ? functions.config().flutterwave.secret_hash : null) ||
  "";

const PLATFORM_FEE_PERCENT = 0.10; // 10% Platform fee

/**
 * Public Config Callable for Frontend Integration
 */
exports.getPaystackConfig = functions.https.onCall(async (data, context) => {
  return {
    publicKey: PAYSTACK_PUBLIC_KEY
  };
});

/**
 * Helper function: Perform HTTPS Request to Paystack REST API
 */
function makePaystackRequest(path, method, data = null) {
  return new Promise((resolve, reject) => {
    if (!PAYSTACK_SECRET_KEY) {
      return reject(new Error("Paystack secret key is not configured in Cloud Functions."));
    }

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
 * Server-Side Paystack Transaction Initialization
 * Calls Paystack API: POST /transaction/initialize
 * Enforces amount, currency (NGN), and customer email on the server.
 * Creates matching pending transaction record.
 */
exports.initializePaystackTransaction = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
  }

  const userId = context.auth.uid;
  const userEmail = (context.auth.token && context.auth.token.email) || data.email;
  const amount = Number(data.amount);

  if (isNaN(amount) || amount < 100) {
    throw new functions.https.HttpsError("invalid-argument", "Minimum deposit amount is ₦100.");
  }

  if (!userEmail) {
    throw new functions.https.HttpsError("invalid-argument", "Customer email is required.");
  }

  if (!PAYSTACK_SECRET_KEY) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Paystack secret key is not configured in Firebase Cloud Functions environment. Please configure PAYSTACK_SECRET_KEY."
    );
  }

  const reference = `DEP_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

  try {
    const paystackRes = await makePaystackRequest("/transaction/initialize", "POST", {
      email: userEmail,
      amount: Math.round(amount * 100), // convert to kobo
      currency: "NGN",
      reference: reference,
      metadata: {
        userId: userId,
        custom_fields: [
          { display_name: "User ID", variable_name: "userId", value: userId }
        ]
      }
    });

    if (!paystackRes || !paystackRes.status || !paystackRes.data) {
      throw new Error(paystackRes.message || "Failed to initialize transaction with Paystack.");
    }

    // Save matching pending transaction record for server verification
    await db.ref(`pendingDeposits/${reference}`).set({
      userId: userId,
      userEmail: userEmail,
      amount: amount,
      currency: "NGN",
      status: "PENDING",
      createdAt: admin.database.ServerValue.TIMESTAMP
    });

    await db.ref(`users/${userId}/transactions/${reference}`).set({
      type: "DEPOSIT",
      amount: amount,
      currency: "NGN",
      gateway: "PAYSTACK",
      status: "PENDING",
      reference: reference,
      createdAt: admin.database.ServerValue.TIMESTAMP
    });

    return {
      success: true,
      authorization_url: paystackRes.data.authorization_url,
      access_code: paystackRes.data.access_code,
      reference: reference,
      publicKey: PAYSTACK_PUBLIC_KEY
    };

  } catch (error) {
    console.error("Paystack Initialize Error:", error);
    throw new functions.https.HttpsError("internal", error.message || "Could not initialize transaction.");
  }
});

/**
 * Server-Side Verification Callable Function for Paystack Deposits
 * Requires:
 * 1. Authenticated user
 * 2. Matching pending transaction record
 * 3. Matching user ID
 * 4. Correct NGN currency
 * 5. Exact expected amount
 * 6. Successful Paystack verification status
 * Atomic & Idempotent: credits user's cash balance exactly once.
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

  if (!PAYSTACK_SECRET_KEY) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Paystack secret key is not configured in Firebase Cloud Functions environment."
    );
  }

  // 1. Verify matching pending transaction exists
  const pendingSnap = await db.ref(`pendingDeposits/${reference}`).once("value");
  if (!pendingSnap.exists()) {
    throw new functions.https.HttpsError("not-found", "No matching pending deposit transaction found.");
  }
  const pendingTx = pendingSnap.val();

  // 2. Verify matching user ID
  if (pendingTx.userId !== userId) {
    throw new functions.https.HttpsError("permission-denied", "Transaction does not belong to authenticated user.");
  }

  // 3. Query Paystack Verification Endpoint (Server-to-Server)
  let paystackRes;
  try {
    paystackRes = await makePaystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`, "GET");
  } catch (err) {
    console.error("Paystack API Verification Request Failed:", err);
    throw new functions.https.HttpsError("internal", "Could not verify payment with gateway.");
  }

  if (!paystackRes || !paystackRes.status || !paystackRes.data) {
    throw new functions.https.HttpsError("failed-precondition", "Payment verification failed or invalid reference.");
  }

  const txData = paystackRes.data;

  // 4. Verify successful Paystack status
  if (txData.status !== "success") {
    await db.ref(`pendingDeposits/${reference}/status`).set("FAILED");
    await db.ref(`users/${userId}/transactions/${reference}/status`).set("FAILED");
    throw new functions.https.HttpsError("failed-precondition", `Payment status is ${txData.status}. Deposit not credited.`);
  }

  // 5. Verify correct NGN currency
  if (txData.currency !== "NGN" || pendingTx.currency !== "NGN") {
    throw new functions.https.HttpsError("failed-precondition", "Invalid transaction currency. Expected NGN.");
  }

  // 6. Verify exact expected amount
  const creditedAmount = txData.amount / 100; // Convert kobo to Naira
  if (creditedAmount !== pendingTx.amount) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      `Transaction amount mismatch: received ₦${creditedAmount}, expected ₦${pendingTx.amount}.`
    );
  }

  // 7. Verify metadata user ID matches
  if (txData.metadata && txData.metadata.userId && txData.metadata.userId !== userId) {
    throw new functions.https.HttpsError("permission-denied", "Paystack metadata user ID does not match authenticated user.");
  }

  // 8. Atomic & Idempotent Crediting via status transition from PENDING -> SUCCESS
  const statusRef = db.ref(`pendingDeposits/${reference}/status`);
  const statusTx = await statusRef.transaction((currentStatus) => {
    if (currentStatus === "SUCCESS") {
      return; // Already processed and credited, abort transaction
    }
    return "SUCCESS";
  });

  if (!statusTx.committed) {
    return {
      success: true,
      message: "Transaction already verified and credited.",
      amount: creditedAmount
    };
  }

  // Credit balance atomically
  await db.ref(`users/${userId}/wallet/cashBalance`).transaction((current) => {
    return (current || 0) + creditedAmount;
  });

  // Record completed transactions
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
    updatedAt: admin.database.ServerValue.TIMESTAMP
  });

  return {
    success: true,
    message: `Successfully verified deposit of ₦${creditedAmount.toLocaleString()}.`,
    amount: creditedAmount
  };
});

/**
 * Paystack Webhook Handler
 * Validates HMAC SHA512 signature and processes events idempotently.
 */
exports.paystackWebhook = functions.https.onRequest(async (req, res) => {
  try {
    const signature = req.headers["x-paystack-signature"];
    if (!signature) {
      return res.status(401).send("Missing Paystack signature.");
    }

    if (!PAYSTACK_SECRET_KEY) {
      return res.status(500).send("Paystack secret key is not configured.");
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

    // Event Idempotency Check
    const eventKey = `${eventType}_${data.id || data.reference || data.transfer_code}`;
    const eventRef = db.ref(`processedWebhookEvents/${eventKey}`);
    const eventTx = await eventRef.transaction((current) => {
      if (current) return; // already processed
      return true;
    });

    if (!eventTx.committed) {
      return res.status(200).send("Webhook event already processed.");
    }

    // A. DEPOSIT SUCCESS WEBHOOK
    if (eventType === "charge.success") {
      const reference = data.reference;
      const amount = data.amount / 100; // kobo to Naira
      const userEmail = data.customer ? data.customer.email : null;

      const statusRef = db.ref(`pendingDeposits/${reference}/status`);
      const statusTx = await statusRef.transaction((current) => {
        if (current === "SUCCESS") return;
        return "SUCCESS";
      });

      if (statusTx.committed && userEmail) {
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

    // C. TRANSFER / WITHDRAWAL FAILED OR REVERSED WEBHOOK (EXACTLY-ONCE ATOMIC REFUND)
    else if (eventType === "transfer.failed" || eventType === "transfer.reversed") {
      const transferCode = data.transfer_code || data.reference;
      const txSnap = await db.ref(`pendingWithdrawals/${transferCode}`).once("value");
      if (txSnap.exists()) {
        const withdrawData = txSnap.val();

        // Atomic status transition ensures refund executes EXACTLY ONCE
        const statusRef = db.ref(`pendingWithdrawals/${transferCode}/status`);
        const refundTx = await statusRef.transaction((current) => {
          if (current === "FAILED_REFUNDED") {
            return; // Already refunded, do not double refund!
          }
          return "FAILED_REFUNDED";
        });

        if (refundTx.committed) {
          await db.ref(`users/${withdrawData.userId}/wallet/cashBalance`).transaction((current) => {
            return (current || 0) + withdrawData.amount;
          });
          await db.ref(`users/${withdrawData.userId}/transactions/${transferCode}/status`).set("FAILED_REFUNDED");
          await db.ref(`pendingWithdrawals/${transferCode}/refundedAt`).set(admin.database.ServerValue.TIMESTAMP);
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
 * 1. Validates inputs
 * 2. Mandatory bank account resolution (rejects withdrawal if unverified)
 * 3. Atomic balance reservation
 * 4. Paystack Transfer Recipient creation (using verifiedAccountName)
 * 5. Paystack Transfer execution
 * 6. Exactly-once atomic refund if transfer fails
 */
exports.processAutomatedWithdrawal = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
  }

  const userId = context.auth.uid;
  const amount = Number(data.amount);
  const accountNumber = data.accountNumber ? String(data.accountNumber).trim() : "";
  const bankCode = data.bankCode ? String(data.bankCode).trim() : "";
  const bankName = data.bankName ? String(data.bankName).trim() : "";

  if (isNaN(amount) || amount < 500) {
    throw new functions.https.HttpsError("invalid-argument", "Minimum withdrawal amount is ₦500.");
  }

  if (accountNumber.length !== 10 || !/^\d+$/.test(accountNumber)) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid 10-digit NUBAN account number.");
  }

  if (!bankCode) {
    throw new functions.https.HttpsError("invalid-argument", "Bank selection is required.");
  }

  if (!PAYSTACK_SECRET_KEY) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Paystack secret key is not configured in Firebase Cloud Functions environment."
    );
  }

  // 1. Mandatory Bank Account Resolution with Paystack API
  let verifiedAccountName = "";
  try {
    const resolveRes = await makePaystackRequest(
      `/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
      "GET"
    );

    if (!resolveRes || !resolveRes.status || !resolveRes.data || !resolveRes.data.account_name) {
      throw new Error((resolveRes && resolveRes.message) || "Account details could not be resolved by the bank.");
    }

    verifiedAccountName = resolveRes.data.account_name;
  } catch (resolveErr) {
    console.error("Bank Account Resolution Failed:", resolveErr.message);
    throw new functions.https.HttpsError(
      "invalid-argument",
      `Mandatory bank verification failed: ${resolveErr.message || "Account cannot be verified"}. Withdrawal rejected.`
    );
  }

  // 2. Atomic Balance Reservation to Prevent Double Spending
  const balanceRef = db.ref(`users/${userId}/wallet/cashBalance`);
  const result = await balanceRef.transaction((currentBalance) => {
    if ((currentBalance || 0) < amount) {
      return; // Insufficient funds, abort transaction
    }
    return currentBalance - amount;
  });

  if (!result.committed) {
    throw new functions.https.HttpsError("failed-precondition", "Insufficient cash balance for this withdrawal.");
  }

  const txId = `WD_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

  // Save pending withdrawal record
  await db.ref(`pendingWithdrawals/${txId}`).set({
    userId: userId,
    amount: amount,
    accountNumber: accountNumber,
    accountName: verifiedAccountName,
    bankCode: bankCode,
    bankName: bankName,
    status: "PROCESSING",
    createdAt: admin.database.ServerValue.TIMESTAMP
  });

  await db.ref(`users/${userId}/transactions/${txId}`).set({
    type: "WITHDRAWAL",
    amount: amount,
    accountNumber: accountNumber,
    accountName: verifiedAccountName,
    bankName: bankName,
    status: "PROCESSING",
    reference: txId,
    createdAt: admin.database.ServerValue.TIMESTAMP
  });

  // 3. Initiate Paystack Automated Payout
  try {
    // Create Transfer Recipient with verified account holder name
    const recipientRes = await makePaystackRequest("/transferrecipient", "POST", {
      type: "nuban",
      name: verifiedAccountName,
      account_number: accountNumber,
      bank_code: bankCode,
      currency: "NGN"
    });

    if (!recipientRes.status || !recipientRes.data || !recipientRes.data.recipient_code) {
      throw new Error(recipientRes.message || "Failed to create transfer recipient.");
    }

    const recipientCode = recipientRes.data.recipient_code;

    // Initiate Transfer
    const transferRes = await makePaystackRequest("/transfer", "POST", {
      source: "balance",
      amount: Math.round(amount * 100), // Convert Naira to kobo
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
        message: `Automated withdrawal of ₦${amount.toLocaleString()} initiated to ${verifiedAccountName}.`,
        reference: txId,
        accountName: verifiedAccountName,
        status: transferStatus
      };
    } else {
      throw new Error(`Transfer rejected with status: ${transferStatus}`);
    }

  } catch (error) {
    console.error("Automated Withdrawal Transfer Execution Error:", error);

    // EXACTLY-ONCE ATOMIC REFUND ON FAILURE
    const statusRef = db.ref(`pendingWithdrawals/${txId}/status`);
    const refundTx = await statusRef.transaction((current) => {
      if (current === "FAILED_REFUNDED") return;
      return "FAILED_REFUNDED";
    });

    if (refundTx.committed) {
      await balanceRef.transaction((current) => {
        return (current || 0) + amount;
      });
      await db.ref(`users/${userId}/transactions/${txId}/status`).set("FAILED_REFUNDED");
      await db.ref(`pendingWithdrawals/${txId}/refundedAt`).set(admin.database.ServerValue.TIMESTAMP);
    }

    throw new functions.https.HttpsError(
      "internal",
      `Withdrawal failed: ${error.message || "Transfer could not be processed"}. Reserved funds have been restored to your wallet.`
    );
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
