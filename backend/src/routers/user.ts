import nacl from "tweetnacl";
import { PrismaClient } from "@prisma/client";
import { Router } from "express";
import Jwt from "jsonwebtoken";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { JWT_SECRET_KEY, TOTAL_DECIMAL } from "../config";
import { authMiddleware } from "../middleware";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { createTaskInput } from "../types";
import { Connection, PublicKey } from "@solana/web3.js";
const connection = new Connection(
  "https://solana-devnet.g.alchemy.com/v2/KySg1IH6BJQde40b10IM9rI4Rf0ztcj_"
);
const PARENT_WALLET_ADDRESS = "DrYSBK319vz5cRGKNmodQeFavadNBpF22joguJDGsGdy";
const DEFAULT_VALUE = "Select most clickable thumbnail";

const s3Client = new S3Client({
  credentials: {
    accessKeyId: "",
    secretAccessKey: "",
  },
  region: "us-east-2",
});

const router = Router();

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

// get task
router.get("/task", authMiddleware, async (req, res) => {
  // @ts-ignore
  const taskId: string = req.query.taskId;
  // @ts-ignore
  const userId: string = req.userId;

  const taskDetails = await prismaClient.task.findFirst({
    where: {
      user_id: Number(userId),
      id: Number(taskId),
    },
    include: {
      options: true,
    },
  });

  if (!taskDetails) {
    return res.status(411).json({
      message: "You dont have access to this task",
    });
  }

  // Todo: Can u make this faster?
  const responses = await prismaClient.submission.findMany({
    where: {
      task_id: Number(taskId),
    },
    include: {
      option: true,
    },
  });

  const result: Record<
    string,
    {
      count: number;
      option: {
        imageUrl: string;
      };
    }
  > = {};

  taskDetails.options.forEach((option) => {
    result[option.id] = {
      count: 0,
      option: {
        imageUrl: option.image_url,
      },
    };
  });

  responses.forEach((r) => {
    result[r.option_id].count++;
  });

  res.json({
    result,
    taskDetails,
  });
});

// Create a task
router.post("/task", authMiddleware, async (req, res) => {
  // @ts-ignore
  const userID = req.userId;
  // Validate input from the user
  const body = req.body;
  console.log(body);
  const user = await prismaClient.user.findFirst({
    where: {
      id: userID,
    },
  });

  const parseResult = createTaskInput.safeParse(body);
  if (!parseResult.success) {
    res.status(203).json({
      message: "You've sent the wrong inputs!",
    });
  }
  console.log(parseResult);
  const transaction = await connection.getTransaction(
    // @ts-ignore
    parseResult.data.signature,
    {
      maxSupportedTransactionVersion: 1,
    }
  );
  console.log(transaction);
  if (
    (transaction?.meta?.postBalances[1] ?? 0) -
      (transaction?.meta?.preBalances[1] ?? 0) !==
    100000000
  ) {
    return res.status(400).json({
      message: "Transaction signature/amount incorrect",
    });
  }

  if (
    transaction?.transaction.message.getAccountKeys().get(1)?.toString() !==
    PARENT_WALLET_ADDRESS
  ) {
    return res.status(400).json({
      message: "Transaction sent to wrong address",
    });
  }

  if (
    transaction?.transaction.message.getAccountKeys().get(0)?.toString() !==
    user?.address
  ) {
    return res.status(400).json({
      message: "Transaction sent to wrong address",
    });
  }

  // Parse the signature here to ensure the person has paid $50

  const { title, signature, options } = parseResult.data as {
    title?: string;
    signature: string;
    options: { imageUrl: string }[];
  };

  let response = await prismaClient.$transaction(async (tx) => {
    const response = await tx.task.create({
      data: {
        title: title ?? DEFAULT_VALUE,
        amount: 0.1 * TOTAL_DECIMAL,
        signature: signature,
        user_id: userID,
      },
    });
    if (options && options.length > 0) {
      await tx.option.createMany({
        data: options.map((x: { imageUrl: any }) => ({
          image_url: x.imageUrl,
          task_id: response.id,
        })),
      });
    }
    return response;
  });
  res.json({
    id: response.id,
  });
});

// Generate Pre-SignedUrl
router.get("/presignedUrl", authMiddleware, async (req, res) => {
  // @ts-ignore
  const userID = req.userId;
  const { url, fields } = await createPresignedPost(s3Client, {
    Bucket: "decenterlized-fiver",
    Key: `fiverr/${userID}/${Math.random()}/image.jpg`,
    Conditions: [
      ["content-length-range", 0, 5 * 1024 * 1024], // 5 MB max
    ],
    Expires: 3600,
  });
  res.json({
    preSignedUrl: url,
    fields,
  });
});

// Signin using solana wallet
router.post("/signin", async (req, res) => {
  const { publicKey, signature } = req.body;
  const message = new TextEncoder().encode("Sign into mechanical turks");

  const result = nacl.sign.detached.verify(
    message,
    new Uint8Array(signature.data),
    new PublicKey(publicKey).toBytes()
  );
  const existingUser = await prismaClient.user.findFirst({
    where: {
      address: publicKey,
    },
  });
  if (existingUser) {
    const token = Jwt.sign(
      {
        userId: existingUser.id,
      },
      JWT_SECRET_KEY
      //  process.env.JWT_SECRET_KEY
    );
    res.json({
      token,
    });
  } else {
    const user = await prismaClient.user.create({
      data: {
        address: publicKey,
      },
    });
    const token = Jwt.sign(
      {
        userId: user.id,
      },
      JWT_SECRET_KEY
      //   process.env.JWT_SECRET_KEY
    );
    res.json({
      token,
    });
  }
});

export default router;
