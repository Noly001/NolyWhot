/**
 * NolyWhot Server-Side Real-Money Gaming & Escrow Cloud Functions
 * Supports Paystack & Flutterwave Webhooks, HMAC Validation, Atomic Wallet Ledger,
 * Match Escrow, Platform Fee Calculation, and Withdrawal Authorization.
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const crypto = require("crypto");

admin.initializeApp();
const db = admin.database();

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || "sk_test_nolywhot_secret_key";
const FLUTTERWAVE_SECRET_HASH = process.env.FLUTTERWAVE_SECRET_HASH || "nolywhot_flutterwave_hash";
const PLATFORM_FEE_PERCENT = 0.10; // 10% Platform fee

/**
 * Paystack Webhook Handler
 * Verifies HMAC SHA512 signature before processing deposit event.
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
    if (event.event === "charge.success") {
      const data = event.data;
      const reference = data.reference;
      const amount = data.amount / 100; // Convert kobo to Naira
      const userEmail = data.customer.email;

      // Idempotency check: Ensure reference was not processed before
      const refCheck = await db.ref(`processedTransactions/${reference}`).once("value");
      if (refCheck.exists()) {
        return res.status(200).send("Transaction already processed.");
      }

      // Locate user by email
      const usersSnap = await db.ref("users").orderByChild("email").equalTo(userEmail).once("value");
      if (!usersSnap.exists()) {
        console.error("User not found for email:", userEmail);
        return res.status(404).send("User not found.");
      }

      const userId = Object.keys(usersSnap.val())[0];

      // Atomic balance update
      await db.ref(`users/${userId}/cashBalance`).transaction((current) => {
        return (current || 0) + amount;
      });

      // Record transaction history
      const txRef = db.ref(`walletTransactions/${userId}`).push();
      await txRef.set({
        type: "DEPOSIT",
        gateway: "PAYSTACK",
        reference: reference,
        amount: amount,
        status: "SUCCESS",
        timestamp: admin.database.ServerValue.TIMESTAMP
      });

      // Mark reference as processed
      await db.ref(`processedTransactions/${reference}`).set({
        userId: userId,
        amount: amount,
        processedAt: admin.database.ServerValue.TIMESTAMP
      });
    }

    return res.status(200).send("Webhook received.");
  } catch (error) {
    console.error("Paystack Webhook Error:", error);
    return res.status(500).send("Internal server error.");
  }
});

/**
 * Flutterwave Webhook Handler
 */
exports.flutterwaveWebhook = functions.https.onRequest(async (req, res) => {
  try {
    const signature = req.headers["verif-hash"];
    if (!signature || signature !== FLUTTERWAVE_SECRET_HASH) {
      return res.status(401).send("Invalid Flutterwave signature.");
    }

    const data = req.body.data;
    if (req.body.event === "charge.completed" && data.status === "successful") {
      const reference = data.tx_ref;
      const amount = data.amount;
      const userEmail = data.customer.email;

      const refCheck = await db.ref(`processedTransactions/${reference}`).once("value");
      if (refCheck.exists()) {
        return res.status(200).send("Transaction already processed.");
      }

      const usersSnap = await db.ref("users").orderByChild("email").equalTo(userEmail).once("value");
      if (!usersSnap.exists()) {
        return res.status(404).send("User not found.");
      }

      const userId = Object.keys(usersSnap.val())[0];

      await db.ref(`users/${userId}/cashBalance`).transaction((current) => {
        return (current || 0) + amount;
      });

      const txRef = db.ref(`walletTransactions/${userId}`).push();
      await txRef.set({
        type: "DEPOSIT",
        gateway: "FLUTTERWAVE",
        reference: reference,
        amount: amount,
        status: "SUCCESS",
        timestamp: admin.database.ServerValue.TIMESTAMP
      });

      await db.ref(`processedTransactions/${reference}`).set({
        userId: userId,
        amount: amount,
        processedAt: admin.database.ServerValue.TIMESTAMP
      });
    }

    return res.status(200).send("Webhook received.");
  } catch (error) {
    console.error("Flutterwave Webhook Error:", error);
    return res.status(500).send("Internal server error.");
  }
});

/**
 * Lock Match Stake Escrow
 * Triggered when a player enters a real-money match lobby.
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

  // Atomic deduction with negative balance check
  const userRef = db.ref(`users/${userId}/cashBalance`);
  const result = await userRef.transaction((currentBalance) => {
    if ((currentBalance || 0) < stakeAmount) {
      return; // Abort transaction if insufficient balance
    }
    return currentBalance - stakeAmount;
  });

  if (!result.committed) {
    throw new functions.https.HttpsError("failed-precondition", "Insufficient funds to enter match.");
  }

  // Escrow funds under match record
  await db.ref(`matchEscrow/${roomId}/${userId}`).set({
    amount: stakeAmount,
    status: "LOCKED",
    timestamp: admin.database.ServerValue.TIMESTAMP
  });

  return { success: true, message: `₦${stakeAmount} locked in escrow for match.` };
});

/**
 * Settle Real-Money Match
 * Server-side prize calculation and platform fee allocation.
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

  const totalPool = stakeAmount * 2; // 2-player match pool
  const platformFee = totalPool * PLATFORM_FEE_PERCENT;
  const winnerPrize = totalPool - platformFee;

  // Credit winner balance
  await db.ref(`users/${winnerId}/cashBalance`).transaction((current) => {
    return (current || 0) + winnerPrize;
  });

  // Record platform revenue
  await db.ref("financialMetrics/platformFees").transaction((current) => {
    return (current || 0) + platformFee;
  });

  // Mark room as settled
  await db.ref(`onlineGames/${roomId}/settled`).set(true);

  // Record transaction ledger
  await db.ref(`walletTransactions/${winnerId}`).push().set({
    type: "MATCH_WINNINGS",
    roomId: roomId,
    amount: winnerPrize,
    platformFee: platformFee,
    status: "SUCCESS",
    timestamp: admin.database.ServerValue.TIMESTAMP
  });

  return {
    success: true,
    totalPool: totalPool,
    platformFee: platformFee,
    winnerPrize: winnerPrize
  };
});

/**
 * Process Withdrawal Request
 * Owner admin authorization or automated payout dispatch.
 */
exports.requestWithdrawal = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
  }

  const userId = context.auth.uid;
  const withdrawAmount = Number(data.amount);
  const bankDetails = data.bankDetails;

  if (isNaN(withdrawAmount) || withdrawAmount < 1000) {
    throw new functions.https.HttpsError("invalid-argument", "Minimum withdrawal is ₦1,000.");
  }

  // Deduct balance atomically
  const userRef = db.ref(`users/${userId}/cashBalance`);
  const result = await userRef.transaction((current) => {
    if ((current || 0) < withdrawAmount) {
      return; // Insufficient funds
    }
    return current - withdrawAmount;
  });

  if (!result.committed) {
    throw new functions.https.HttpsError("failed-precondition", "Insufficient funds.");
  }

  // Create pending withdrawal request for admin review
  const reqRef = db.ref("pendingWithdrawals").push();
  await reqRef.set({
    userId: userId,
    amount: withdrawAmount,
    bankDetails: bankDetails,
    status: "PENDING_REVIEW",
    timestamp: admin.database.ServerValue.TIMESTAMP
  });

  return { success: true, message: "Withdrawal request submitted for review." };
});
