import { PrismaClient } from "@prisma/client";
import { Router } from "express";
import Jwt, { decode } from "jsonwebtoken";
import { PRIVATE_KEY, TOTAL_DECIMAL, WORKER_SECRET_KEY } from "../config";
import { workerMiddleware } from "../middleware";
import { getNextTask } from "../db";
import { createSubmissionInput } from "../types";
import nacl from "tweetnacl";
import bs58 from "bs58";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
const router = Router();
const connection = new Connection(
  "https://solana-devnet.g.alchemy.com/v2/KySg1IH6BJQde40b10IM9rI4Rf0ztcj_"
);
const TOTAL_SUBMISSION = 100;

const prismaClient = new PrismaClient();

// prismaClient.$transaction(
//   async (prisma) => {
//     // Code running in a transaction...
//   },
//   {
//     maxWait: 5000, // default: 2000
//     timeout: 10000, // default: 5000
//   }
// );

// Get Balance
router.get("/balance", workerMiddleware, async (req, res) => {
  // @ts-ignore
  const workerId: string = req.userId;
  const worker = await prismaClient.worker.findFirst({
    where: {
      id: Number(workerId),
    },
  });
  res.json({
    pendingAmount: worker?.pending_amount,
    lokedAmount: worker?.locked_amount,
  });
});
//Submit a task
router.post("/submission", workerMiddleware, async (req, res) => {
  // @ts-ignore
  const workerId = req.userId;
  const body = req.body;
  const parsedBody = createSubmissionInput.safeParse(body);
  if (parsedBody.success) {
    const task = await getNextTask(Number(workerId));
    if (!task || task.id !== Number(parsedBody.data.taskId)) {
      return res.status(411).json({
        message: "Incorrect Task Id",
      });
    }

    const amount = (Number(task.amount) / TOTAL_SUBMISSION).toString();
    const submission = await prismaClient.$transaction(async (tx) => {
      const submission = await tx.submission.create({
        data: {
          option_id: Number(parsedBody.data.selection),
          worker_id: workerId,
          task_id: Number(parsedBody.data.taskId),
          amount,
        },
      });

      await tx.worker.update({
        where: {
          id: workerId,
        },
        data: {
          pending_amount: {
            increment: Number(amount),
          },
        },
      });
      return submission;
    });
    const nextTask = await getNextTask(Number(workerId));
    res.json({
      nextTask,
      amount,
    });
  } else {
  }
});

// Assign new task to worker
router.get("/nextTask", workerMiddleware, async (req, res) => {
  // @ts-ignore
  const workerId: string = req.userId;

  const task = await getNextTask(Number(workerId));
  if (!task) {
    res.status(204).json({
      message: "No more tasks left for you to review",
    });
  } else {
    res.json({
      task,
    });
  }
});

// Worker Signin
router.post("/signin", async (req, res) => {
  const { publicKey, signature } = req.body;
  const message = new TextEncoder().encode(
    "Sign into mechanical turks as a worker"
  );

  const result = nacl.sign.detached.verify(
    message,
    new Uint8Array(signature.data),
    new PublicKey(publicKey).toBytes()
  );

  const existingUser = await prismaClient.worker.findFirst({
    where: {
      address: publicKey,
    },
  });
  if (existingUser) {
    const token = Jwt.sign(
      {
        userId: existingUser.id,
      },
      WORKER_SECRET_KEY
      //  process.env.JWT_SECRET_KEY
    );
    res.json({
      token,
      amount: existingUser.pending_amount / TOTAL_DECIMAL,
    });
  } else {
    const user = await prismaClient.worker.create({
      data: {
        address: publicKey,
        pending_amount: 0,
        locked_amount: 0,
      },
    });
    const token = Jwt.sign(
      {
        userId: user.id,
      },
      WORKER_SECRET_KEY
      //   process.env.JWT_SECRET_KEY
    );
    res.json({
      token,
      amount: 0,
    });
  }
});

// Payout
// router.post("/payout", workerMiddleware, async (req, res) => {
//   // @ts-ignore
//   const workerId: string = req.userId;
//   const worker = await prismaClient.worker.findFirst({
//     where: {
//       id: Number(workerId),
//     },
//   });
//   if (!worker) {
//     return res.status(403).json({
//       message: "User not found",
//     });
//   }
//   const address = worker.address;

//   const transaction = new Transaction().add(
//     SystemProgram.transfer({
//       fromPubkey: new PublicKey("DrYSBK319vz5cRGKNmodQeFavadNBpF22joguJDGsGdy"),
//       toPubkey: new PublicKey(address),
//       lamports: (1000_000_000 * worker.pending_amount) / TOTAL_DECIMAL,
//     })
//   );

//   const decodedKey = bs58.decode(PRIVATE_KEY);
//   // const uint8ArrayKey = new Uint8Array(Buffer.from(decodedKey, "base64"));
//   // const keypair = Keypair.fromSecretKey(uint8ArrayKey);
//   const keypair = Keypair.fromSecretKey(decodedKey);
//   const signature = await sendAndConfirmTransaction(connection, transaction, [
//     keypair,
//   ]);
//   console.log(signature);
//   // We should add a lock here
//   await prismaClient.$transaction(async (tx) => {
//     await tx.worker.update({
//       where: {
//         id: Number(workerId),
//       },
//       data: {
//         pending_amount: {
//           decrement: worker.pending_amount,
//         },
//         locked_amount: {
//           increment: worker.pending_amount,
//         },
//       },
//     });

//     await tx.payouts.create({
//       data: {
//         user_id: Number(workerId),
//         amount: worker.pending_amount,
//         status: "Processing",
//         signature: signature,
//       },
//     });
//   });

//   //send the txn to the solana blockchain

//   res.json({
//     message:
//       "Processing your payout. It will take some time to reflect into your account",
//     amount: worker.pending_amount,
//   });
// });

router.post("/payout", workerMiddleware, async (req, res) => {
  // @ts-ignore
  const userId: string = req.userId;
  const worker = await prismaClient.worker.findFirst({
    where: { id: Number(userId) },
  });

  if (!worker) {
    return res.status(403).json({
      message: "User not found",
    });
  }

  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: new PublicKey("DrYSBK319vz5cRGKNmodQeFavadNBpF22joguJDGsGdy"),
      toPubkey: new PublicKey(worker.address),
      lamports: (1000_000_000 * worker.pending_amount) / TOTAL_DECIMAL,
    })
  );

  const decodedKey = bs58.decode(PRIVATE_KEY);
  //   // const uint8ArrayKey = new Uint8Array(Buffer.from(decodedKey, "base64"));
  //   // const keypair = Keypair.fromSecretKey(uint8ArrayKey);
  const keypair = Keypair.fromSecretKey(decodedKey);

  // TODO: There's a double spending problem here
  // The user can request the withdrawal multiple times
  // Can u figure out a way to fix it?
  let signature = "";
  try {
    signature = await sendAndConfirmTransaction(connection, transaction, [
      keypair,
    ]);
  } catch (e) {
    return res.json({
      message: "Transaction failed",
    });
  }

  // We should add a lock here
  await prismaClient.$transaction(async (tx) => {
    await tx.worker.update({
      where: {
        id: Number(userId),
      },
      data: {
        pending_amount: {
          decrement: worker.pending_amount,
        },
        locked_amount: {
          increment: worker.pending_amount,
        },
      },
    });

    await tx.payouts.create({
      data: {
        worker_id: Number(userId),
        amount: worker.pending_amount,
        status: "Processing",
        signature: signature,
      },
    });
  });

  res.json({
    message: "Processing payout",
    amount: worker.pending_amount,
  });
});
export default router;
